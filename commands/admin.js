const Logger = require('../utils/logger');

class AdminCommands {
    constructor(bot) {
        this.bot = bot;
        this.logger = new Logger();
        this.adminUsers = process.env.ADMIN_USERS ? process.env.ADMIN_USERS.split(',') : [];
    }

    async handleAdminCommand(interaction) {
        // Check if user has admin permissions
        if (!this.isAdmin(interaction.user.id) && !interaction.member?.permissions.has('Administrator')) {
            await interaction.reply('❌ You need administrator permissions to use this command.');
            return;
        }

        const action = interaction.options.getString('action');
        const value = interaction.options.getString('value');

        try {
            switch (action) {
                case 'stats':
                    await this.handleStatsCommand(interaction);
                    break;
                case 'reset-limits':
                    await this.handleResetLimitsCommand(interaction, value);
                    break;
                case 'force-model':
                    await this.handleForceModelCommand(interaction, value);
                    break;
                default:
                    await interaction.reply('❌ Unknown admin action.');
            }
        } catch (error) {
            this.logger.error('Admin command error:', error);
            await interaction.reply('❌ An error occurred while executing the admin command.');
        }
    }

    async handleStatsCommand(interaction) {
        const botStats = this.bot.stats;
        const conversationStats = this.bot.conversationManager.getAllStats();
        const rateLimitStats = this.bot.rateLimiter.getAllStats();
        const activeUsers = this.bot.conversationManager.getActiveUsers();

        const uptime = Date.now() - botStats.startTime;
        const uptimeDays = Math.floor(uptime / (1000 * 60 * 60 * 24));
        const uptimeHours = Math.floor((uptime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const uptimeMinutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));

        const embed = {
            title: '🔧 Admin Statistics',
            color: 0xff0000,
            fields: [
                {
                    name: '⏱️ Uptime',
                    value: `${uptimeDays}d ${uptimeHours}h ${uptimeMinutes}m`,
                    inline: true
                },
                {
                    name: '🧠 Current Model',
                    value: this.bot.currentModel === 'groq' ? '⚡ Groq' : '🤗 HuggingFace',
                    inline: true
                },
                {
                    name: '📊 Messages Processed',
                    value: botStats.totalMessages.toString(),
                    inline: true
                },
                {
                    name: '⚡ Groq Requests',
                    value: `${rateLimitStats.groq.requests}/${rateLimitStats.groq.limit} (${rateLimitStats.groq.percentage}%)`,
                    inline: true
                },
                {
                    name: '🤗 HF Requests',
                    value: botStats.hfRequests.toString(),
                    inline: true
                },
                {
                    name: '❌ Errors',
                    value: botStats.errors.toString(),
                    inline: true
                },
                {
                    name: '💬 Active Conversations',
                    value: `${conversationStats.activeConversations}/${conversationStats.totalConversations}`,
                    inline: true
                },
                {
                    name: '📝 Total Context Messages',
                    value: conversationStats.totalMessages.toString(),
                    inline: true
                },
                {
                    name: '👥 Rate Limited Users',
                    value: rateLimitStats.activeUserLimits.toString(),
                    inline: true
                }
            ],
            timestamp: new Date().toISOString()
        };

        // Add top active users if any
        if (activeUsers.length > 0) {
            const topUsers = activeUsers.slice(0, 5).map((user, index) => {
                const userId = user.userId.length > 10 ? `${user.userId.substring(0, 10)}...` : user.userId;
                return `${index + 1}. ${userId} (${user.messageCount} msgs)`;
            }).join('\n');

            embed.fields.push({
                name: '🏆 Top Active Users',
                value: topUsers,
                inline: false
            });
        }

        // Add Groq reset time
        const resetTime = new Date(rateLimitStats.groq.resetTime);
        const timeUntilReset = Math.ceil(rateLimitStats.groq.timeUntilReset / (1000 * 60 * 60));
        
        embed.fields.push({
            name: '🔄 Groq Limit Reset',
            value: `${timeUntilReset}h (${resetTime.toLocaleString()})`,
            inline: false
        });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    async handleResetLimitsCommand(interaction, value) {
        let result;
        
        switch (value) {
            case 'groq':
                result = this.bot.rateLimiter.resetGroqLimit();
                await interaction.reply(`✅ Reset Groq limits. Previous count: ${result}`, { ephemeral: true });
                break;
            case 'users':
                const userCount = this.bot.rateLimiter.userLimits.size;
                this.bot.rateLimiter.userLimits.clear();
                await interaction.reply(`✅ Reset all user rate limits. Cleared: ${userCount} users`, { ephemeral: true });
                break;
            case 'conversations':
                const convCount = this.bot.conversationManager.forceCleanup();
                await interaction.reply(`✅ Cleared all conversations. Removed: ${convCount} conversations`, { ephemeral: true });
                break;
            case 'all':
                const stats = this.bot.rateLimiter.resetAllLimits();
                const convStats = this.bot.conversationManager.forceCleanup();
                await interaction.reply(`✅ Reset everything:\n- Users: ${stats.userCount}\n- Groq: ${stats.groqCount}\n- Conversations: ${convStats}`, { ephemeral: true });
                break;
            default:
                await interaction.reply('❌ Invalid reset target. Use: groq, users, conversations, or all', { ephemeral: true });
        }
    }

    async handleForceModelCommand(interaction, value) {
        const validModels = ['groq', 'huggingface', 'auto'];
        
        if (!validModels.includes(value)) {
            await interaction.reply(`❌ Invalid model. Use: ${validModels.join(', ')}`, { ephemeral: true });
            return;
        }

        const oldModel = this.bot.currentModel;
        
        if (value === 'auto') {
            // Reset to automatic switching
            this.bot.currentModel = 'groq';
            await interaction.reply(`✅ Model switching set to automatic. Current: ${this.bot.currentModel}`, { ephemeral: true });
        } else {
            this.bot.currentModel = value;
            await interaction.reply(`✅ Forced model change: ${oldModel} → ${value}`, { ephemeral: true });
        }

        // Update bot status
        this.bot.updateBotStatus();
        
        this.logger.info(`Admin forced model change: ${oldModel} → ${this.bot.currentModel}`, {
            adminId: interaction.user.id,
            guildId: interaction.guildId
        });
    }

    isAdmin(userId) {
        return this.adminUsers.includes(userId);
    }

    async testServices(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const results = {
            groq: false,
            huggingface: false
        };

        try {
            results.groq = await this.bot.groqService.testConnection();
        } catch (error) {
            this.logger.error('Groq test failed:', error);
        }

        try {
            results.huggingface = await this.bot.huggingfaceService.testConnection();
        } catch (error) {
            this.logger.error('HuggingFace test failed:', error);
        }

        const embed = {
            title: '🔧 Service Health Check',
            color: results.groq || results.huggingface ? 0x00ff00 : 0xff0000,
            fields: [
                {
                    name: '⚡ Groq Service',
                    value: results.groq ? '✅ Online' : '❌ Offline',
                    inline: true
                },
                {
                    name: '🤗 HuggingFace Service',
                    value: results.huggingface ? '✅ Online' : '❌ Offline',
                    inline: true
                }
            ],
            timestamp: new Date().toISOString()
        };

        await interaction.editReply({ embeds: [embed] });
    }
}

module.exports = AdminCommands;
