const { Client, GatewayIntentBits, Collection, REST, Routes, ActivityType } = require('discord.js');
const express = require('express');
const GroqService = require('./services/groqService');
const HuggingFaceService = require('./services/huggingfaceService');
const ConversationManager = require('./services/conversationManager');
const RateLimiter = require('./services/rateLimiter');
const AdminCommands = require('./commands/admin');
const Logger = require('./utils/logger');
const config = require('./config/settings.json');
const { promptStorage } = require('./server/storage');

class DiscordAIBot {
    constructor() {
        // Initialize Discord client with basic intents
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.DirectMessages
            ]
        });

        // Initialize services
        this.groqService = new GroqService();
        this.huggingfaceService = new HuggingFaceService();
        this.conversationManager = new ConversationManager();
        this.rateLimiter = new RateLimiter();
        this.adminCommands = new AdminCommands(this);
        this.logger = new Logger();
        this.promptStorage = promptStorage;

        // Bot state
        this.currentModel = 'groq';
        this.stats = {
            groqRequests: 0,
            hfRequests: 0,
            totalMessages: 0,
            errors: 0,
            startTime: Date.now()
        };

        this.setupEventHandlers();
        this.setupSlashCommands();
    }

    setupEventHandlers() {
        this.client.on('ready', () => {
            this.logger.info(`Bot logged in as ${this.client.user.tag}`);
            this.updateBotStatus();
            
            // Update status every 5 minutes
            setInterval(() => this.updateBotStatus(), 300000);
        });

        this.client.on('messageCreate', async (message) => {
            if (message.author.bot) return;
            
            // Check if message mentions the bot or is in DM
            const isMentioned = message.mentions.has(this.client.user);
            const isDM = message.channel.type === 1; // DM channel type
            
            if (!isMentioned && !isDM) return;

            await this.handleMessage(message);
        });

        this.client.on('interactionCreate', async (interaction) => {
            if (!interaction.isChatInputCommand()) return;
            await this.handleSlashCommand(interaction);
        });

        this.client.on('error', (error) => {
            this.logger.error('Discord client error:', error);
        });
    }

    async setupSlashCommands() {
        const commands = [
            {
                name: 'status',
                description: 'Get bot status and statistics'
            },
            {
                name: 'reset',
                description: 'Reset conversation context'
            },
            {
                name: 'model',
                description: 'Get current AI model information'
            },
            {
                name: 'chat',
                description: 'Chat with the AI bot',
                options: [
                    {
                        name: 'message',
                        description: 'Your message to the AI',
                        type: 3, // STRING
                        required: true
                    }
                ]
            },
            {
                name: 'configure',
                description: 'Set a custom system prompt for your interactions',
                options: [
                    {
                        name: 'prompt',
                        description: 'Your custom system prompt (leave empty to reset to default)',
                        type: 3, // STRING
                        required: false
                    }
                ]
            },
            {
                name: 'admin',
                description: 'Admin commands (requires admin permissions)',
                options: [
                    {
                        name: 'action',
                        description: 'Admin action to perform',
                        type: 3, // STRING
                        required: true,
                        choices: [
                            { name: 'stats', value: 'stats' },
                            { name: 'reset-limits', value: 'reset-limits' },
                            { name: 'force-model', value: 'force-model' }
                        ]
                    },
                    {
                        name: 'value',
                        description: 'Value for the action (if needed)',
                        type: 3, // STRING
                        required: false
                    }
                ]
            }
        ];

        try {
            const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
            await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
            this.logger.info('Slash commands registered successfully');
        } catch (error) {
            this.logger.error('Failed to register slash commands:', error);
        }
    }

    async handleMessage(message) {
        try {
            this.stats.totalMessages++;
            
            // Clean message content (remove mentions)
            let content = message.content.replace(/<@!?\d+>/g, '').trim();
            if (!content) {
                content = "Hello! How can I help you?";
            }

            // Check rate limits
            const userId = message.author.id;
            if (!this.rateLimiter.checkUserLimit(userId)) {
                await message.reply('⏰ You\'re sending messages too quickly. Please wait a moment before trying again.');
                return;
            }

            // Show typing indicator
            await message.channel.sendTyping();

            // Get conversation context
            const context = this.conversationManager.getContext(userId);
            
            // Try to get AI response
            const response = await this.getAIResponse(content, context, userId);
            
            if (response) {
                // Update conversation context
                this.conversationManager.addMessage(userId, 'user', content);
                this.conversationManager.addMessage(userId, 'assistant', response.content);
                
                // Send response with model indicator
                const modelEmoji = this.currentModel === 'groq' ? '⚡' : '🤗';
                await message.reply(`${modelEmoji} ${response.content}`);
            } else {
                await message.reply('❌ Sorry, I\'m having trouble connecting to the AI services right now. Please try again later.');
                this.stats.errors++;
            }

        } catch (error) {
            this.logger.error('Error handling message:', error);
            this.stats.errors++;
            await message.reply('❌ An error occurred while processing your message. Please try again.');
        }
    }

    async handleSlashCommand(interaction) {
        try {
            const { commandName, options } = interaction;

            switch (commandName) {
                case 'status':
                    await this.handleStatusCommand(interaction);
                    break;
                case 'reset':
                    await this.handleResetCommand(interaction);
                    break;
                case 'model':
                    await this.handleModelCommand(interaction);
                    break;
                case 'chat':
                    await this.handleChatCommand(interaction);
                    break;
                case 'configure':
                    await this.handleConfigureCommand(interaction);
                    break;
                case 'admin':
                    await this.adminCommands.handleAdminCommand(interaction);
                    break;
                default:
                    await interaction.reply('Unknown command.');
            }
        } catch (error) {
            this.logger.error('Error handling slash command:', error);
            await interaction.reply('❌ An error occurred while processing the command.');
        }
    }

    async getAIResponse(content, context, userId) {
        // Get custom user prompt if available
        let systemPrompt = config.systemPrompt;
        try {
            const userPrompt = await this.promptStorage.getUserPrompt(userId);
            if (userPrompt && userPrompt.customPrompt) {
                systemPrompt = userPrompt.customPrompt;
            }
        } catch (error) {
            this.logger.warn('Failed to get user prompt:', error.message);
        }
        
        // Prepare messages with context
        const messages = [
            { role: 'system', content: systemPrompt },
            ...context,
            { role: 'user', content: content }
        ];

        // Try Groq first
        if (this.currentModel === 'groq' && this.rateLimiter.checkGroqLimit()) {
            try {
                const response = await this.groqService.generateResponse(messages);
                if (response) {
                    this.stats.groqRequests++;
                    this.rateLimiter.incrementGroq();
                    return response;
                }
            } catch (error) {
                this.logger.warn('Groq service failed, falling back to Hugging Face:', error.message);
            }
        }

        // Fallback to Hugging Face
        try {
            this.currentModel = 'huggingface';
            const response = await this.huggingfaceService.generateResponse(messages);
            if (response) {
                this.stats.hfRequests++;
                return response;
            }
        } catch (error) {
            this.logger.error('Hugging Face service failed:', error);
        }

        return null;
    }

    async handleStatusCommand(interaction) {
        const uptime = Date.now() - this.stats.startTime;
        const uptimeHours = Math.floor(uptime / (1000 * 60 * 60));
        const uptimeMinutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
        
        const embed = {
            title: '🤖 Bot Status',
            color: 0x00ff00,
            fields: [
                {
                    name: '🧠 Current Model',
                    value: this.currentModel === 'groq' ? '⚡ Groq (LLaMA 3.1)' : '🤗 Hugging Face',
                    inline: true
                },
                {
                    name: '⏱️ Uptime',
                    value: `${uptimeHours}h ${uptimeMinutes}m`,
                    inline: true
                },
                {
                    name: '📊 Total Messages',
                    value: this.stats.totalMessages.toString(),
                    inline: true
                },
                {
                    name: '⚡ Groq Requests',
                    value: `${this.stats.groqRequests}/1000 (daily)`,
                    inline: true
                },
                {
                    name: '🤗 HF Requests',
                    value: this.stats.hfRequests.toString(),
                    inline: true
                },
                {
                    name: '❌ Errors',
                    value: this.stats.errors.toString(),
                    inline: true
                }
            ],
            timestamp: new Date().toISOString()
        };

        await interaction.reply({ embeds: [embed] });
    }

    async handleResetCommand(interaction) {
        const userId = interaction.user.id;
        this.conversationManager.clearContext(userId);
        await interaction.reply('🔄 Your conversation context has been reset.');
    }

    async handleModelCommand(interaction) {
        const modelInfo = this.currentModel === 'groq' 
            ? '⚡ **Groq** - Ultra-fast LLaMA 3.1 inference (Primary)\n- Speed: Sub-millisecond latency\n- Limit: 1,000 requests/day\n- Context: 128K tokens'
            : '🤗 **Hugging Face** - Inference API (Fallback)\n- Models: Multiple LLaMA variants\n- Speed: Standard inference\n- Context: Variable';

        const embed = {
            title: '🧠 Current AI Model',
            description: modelInfo,
            color: this.currentModel === 'groq' ? 0x00ff00 : 0xff9900,
            timestamp: new Date().toISOString()
        };

        await interaction.reply({ embeds: [embed] });
    }

    async handleChatCommand(interaction) {
        try {
            const message = interaction.options.getString('message');
            const userId = interaction.user.id;

            // Check rate limits
            if (!this.rateLimiter.checkUserLimit(userId)) {
                await interaction.reply('⏰ You\'re sending messages too quickly. Please wait a moment before trying again.');
                return;
            }

            // Defer reply since AI response might take time
            await interaction.deferReply();

            // Get conversation context
            const context = this.conversationManager.getContext(userId);
            
            // Try to get AI response
            const response = await this.getAIResponse(message, context, userId);
            
            if (response) {
                // Update conversation context and stats
                this.conversationManager.addMessage(userId, 'user', message);
                this.conversationManager.addMessage(userId, 'assistant', response.content);
                this.stats.totalMessages++;
                
                // Send response with model indicator
                const modelEmoji = this.currentModel === 'groq' ? '⚡' : '🤗';
                await interaction.editReply(`${modelEmoji} ${response.content}`);
            } else {
                await interaction.editReply('❌ Sorry, I\'m having trouble connecting to the AI services right now. Please try again later.');
                this.stats.errors++;
            }

        } catch (error) {
            this.logger.error('Error handling chat command:', error);
            this.stats.errors++;
            await interaction.editReply('❌ An error occurred while processing your message. Please try again.');
        }
    }

    async handleConfigureCommand(interaction) {
        try {
            const prompt = interaction.options.getString('prompt');
            const userId = interaction.user.id;

            if (!prompt) {
                // Reset to default prompt
                try {
                    const deleted = await this.promptStorage.deleteUserPrompt(userId);
                    if (deleted) {
                        await interaction.reply('✅ Your custom prompt has been reset to the default system prompt.');
                    } else {
                        await interaction.reply('ℹ️ You don\'t have a custom prompt set. Using the default system prompt.');
                    }
                } catch (error) {
                    this.logger.error('Error deleting user prompt:', error);
                    await interaction.reply('❌ An error occurred while resetting your prompt. Please try again.');
                }
                return;
            }

            // Set custom prompt
            try {
                await this.promptStorage.setUserPrompt(userId, prompt);
                
                const embed = {
                    title: '✅ Custom Prompt Set',
                    description: 'Your custom system prompt has been saved and will be used for all future interactions.',
                    color: 0x00ff00,
                    fields: [
                        {
                            name: '🎯 Your Custom Prompt',
                            value: prompt.length > 1000 ? prompt.substring(0, 1000) + '...' : prompt,
                            inline: false
                        },
                        {
                            name: 'ℹ️ Note',
                            value: 'This prompt will persist across all your conversations. Use `/configure` without a prompt to reset to default.',
                            inline: false
                        }
                    ],
                    timestamp: new Date().toISOString()
                };

                await interaction.reply({ embeds: [embed], ephemeral: true });
                
                this.logger.info(`User ${userId} set custom prompt`, {
                    promptLength: prompt.length,
                    preview: prompt.substring(0, 100)
                });

            } catch (error) {
                this.logger.error('Error setting user prompt:', error);
                await interaction.reply('❌ An error occurred while saving your prompt. Please try again.');
            }

        } catch (error) {
            this.logger.error('Error handling configure command:', error);
            await interaction.reply('❌ An error occurred while processing the command.');
        }
    }

    updateBotStatus() {
        const statusText = `${this.currentModel === 'groq' ? '⚡ Groq' : '🤗 HF'} | ${this.stats.totalMessages} msgs`;
        this.client.user.setActivity(statusText, { type: ActivityType.Watching });
    }

    async start() {
        try {
            await this.client.login(process.env.DISCORD_TOKEN);
            this.logger.info('Discord bot started successfully');
            
            // Start monitoring server
            const MonitoringServer = require('./server');
            const server = new MonitoringServer(this);
            server.start();
            
        } catch (error) {
            this.logger.error('Failed to start Discord bot:', error);
            this.logger.error('Error details:', error.message);
            
            // Don't exit, keep the monitoring server running for debugging
            const MonitoringServer = require('./server');
            const server = new MonitoringServer(null);
            server.start();
        }
    }
}

// Start the bot
const bot = new DiscordAIBot();
bot.start();

module.exports = DiscordAIBot;
