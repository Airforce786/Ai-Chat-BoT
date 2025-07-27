const express = require('express');
const path = require('path');
const Logger = require('./utils/logger');

class MonitoringServer {
    constructor(bot) {
        this.bot = bot;
        this.app = express();
        this.logger = new Logger();
        this.port = 5000;
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.static('public'));
        
        // Basic logging middleware
        this.app.use((req, res, next) => {
            this.logger.debug(`${req.method} ${req.path}`, { 
                ip: req.ip,
                userAgent: req.get('User-Agent') 
            });
            next();
        });
    }

    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            const health = {
                status: 'ok',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                bot: this.bot ? {
                    connected: this.bot.client.isReady(),
                    guilds: this.bot.client.guilds.cache.size,
                    users: this.bot.client.users.cache.size
                } : {
                    connected: false,
                    guilds: 0,
                    users: 0
                }
            };
            
            res.json(health);
        });

        // Bot statistics endpoint
        this.app.get('/api/stats', (req, res) => {
            if (!this.bot) {
                return res.json({
                    error: 'Bot not available',
                    timestamp: new Date().toISOString()
                });
            }
            
            const stats = {
                bot: this.bot.stats,
                conversations: this.bot.conversationManager.getAllStats(),
                rateLimits: this.bot.rateLimiter.getAllStats(),
                currentModel: this.bot.currentModel,
                timestamp: new Date().toISOString()
            };
            
            res.json(stats);
        });

        // Detailed bot info
        this.app.get('/api/info', (req, res) => {
            const info = {
                bot: {
                    username: this.bot.client.user?.username,
                    discriminator: this.bot.client.user?.discriminator,
                    id: this.bot.client.user?.id,
                    avatar: this.bot.client.user?.displayAvatarURL(),
                    guilds: this.bot.client.guilds.cache.size,
                    channels: this.bot.client.channels.cache.size,
                    users: this.bot.client.users.cache.size
                },
                services: {
                    groq: this.bot.groqService.getModelInfo(),
                    huggingface: this.bot.huggingfaceService.getModelInfo()
                },
                currentModel: this.bot.currentModel,
                uptime: {
                    process: process.uptime(),
                    bot: (Date.now() - this.bot.stats.startTime) / 1000
                }
            };
            
            res.json(info);
        });

        // Service status endpoint
        this.app.get('/api/services/status', async (req, res) => {
            const status = {
                groq: { status: 'unknown', error: null },
                huggingface: { status: 'unknown', error: null }
            };

            try {
                const groqTest = await this.bot.groqService.testConnection();
                status.groq.status = groqTest ? 'online' : 'offline';
            } catch (error) {
                status.groq.status = 'error';
                status.groq.error = error.message;
            }

            try {
                const hfTest = await this.bot.huggingfaceService.testConnection();
                status.huggingface.status = hfTest ? 'online' : 'offline';
            } catch (error) {
                status.huggingface.status = 'error';
                status.huggingface.error = error.message;
            }

            res.json(status);
        });

        // Rate limit info
        this.app.get('/api/limits', (req, res) => {
            const limits = {
                groq: this.bot.rateLimiter.getGroqLimitInfo(),
                activeUsers: this.bot.rateLimiter.userLimits.size,
                totalUserRequests: Array.from(this.bot.rateLimiter.userLimits.values())
                    .reduce((sum, limit) => sum + limit.count, 0)
            };
            
            res.json(limits);
        });

        // Simple dashboard
        this.app.get('/', (req, res) => {
            res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Discord AI Bot Dashboard</title>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <style>
                        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
                        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                        .header { text-align: center; margin-bottom: 30px; }
                        .status { display: flex; justify-content: space-around; margin: 20px 0; }
                        .status-item { text-align: center; padding: 15px; background: #f8f9fa; border-radius: 8px; }
                        .status-item h3 { margin: 0 0 10px 0; color: #333; }
                        .status-item p { margin: 0; font-size: 18px; font-weight: bold; }
                        .online { color: #28a745; }
                        .offline { color: #dc3545; }
                        .warning { color: #ffc107; }
                        .api-links { margin-top: 30px; }
                        .api-links a { display: inline-block; margin: 5px 10px; padding: 8px 15px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; }
                        .api-links a:hover { background: #0056b3; }
                        .refresh { text-align: center; margin: 20px 0; }
                        .refresh button { padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🤖 Discord AI Bot Dashboard</h1>
                            <p>Real-time monitoring and statistics</p>
                        </div>
                        
                        <div class="status">
                            <div class="status-item">
                                <h3>Bot Status</h3>
                                <p id="bot-status">Loading...</p>
                            </div>
                            <div class="status-item">
                                <h3>Current Model</h3>
                                <p id="current-model">Loading...</p>
                            </div>
                            <div class="status-item">
                                <h3>Total Messages</h3>
                                <p id="total-messages">Loading...</p>
                            </div>
                        </div>

                        <div class="status">
                            <div class="status-item">
                                <h3>Groq Usage</h3>
                                <p id="groq-usage">Loading...</p>
                            </div>
                            <div class="status-item">
                                <h3>Active Conversations</h3>
                                <p id="active-conversations">Loading...</p>
                            </div>
                            <div class="status-item">
                                <h3>Errors</h3>
                                <p id="error-count">Loading...</p>
                            </div>
                        </div>

                        <div class="refresh">
                            <button onclick="loadStats()">🔄 Refresh Data</button>
                        </div>

                        <div class="api-links">
                            <h3>API Endpoints:</h3>
                            <a href="/health" target="_blank">Health Check</a>
                            <a href="/api/stats" target="_blank">Statistics</a>
                            <a href="/api/info" target="_blank">Bot Info</a>
                            <a href="/api/services/status" target="_blank">Services Status</a>
                            <a href="/api/limits" target="_blank">Rate Limits</a>
                        </div>
                    </div>

                    <script>
                        async function loadStats() {
                            try {
                                const response = await fetch('/api/stats');
                                const stats = await response.json();
                                
                                document.getElementById('bot-status').textContent = 'Online';
                                document.getElementById('bot-status').className = 'online';
                                
                                document.getElementById('current-model').textContent = 
                                    stats.currentModel === 'groq' ? '⚡ Groq' : '🤗 HuggingFace';
                                
                                document.getElementById('total-messages').textContent = stats.bot.totalMessages;
                                
                                document.getElementById('groq-usage').textContent = 
                                    stats.rateLimits.groq.requests + '/' + stats.rateLimits.groq.limit + 
                                    ' (' + stats.rateLimits.groq.percentage + '%)';
                                
                                document.getElementById('active-conversations').textContent = 
                                    stats.conversations.activeConversations;
                                
                                document.getElementById('error-count').textContent = stats.bot.errors;
                                
                            } catch (error) {
                                console.error('Failed to load stats:', error);
                                document.getElementById('bot-status').textContent = 'Error';
                                document.getElementById('bot-status').className = 'offline';
                            }
                        }

                        // Load stats on page load and refresh every 30 seconds
                        loadStats();
                        setInterval(loadStats, 30000);
                    </script>
                </body>
                </html>
            `);
        });
    }

    start() {
        this.app.listen(this.port, '0.0.0.0', () => {
            this.logger.info(`Monitoring server running on http://0.0.0.0:${this.port}`);
        });
    }
}

// Export for use in main bot file
module.exports = MonitoringServer;

// Start server if this file is run directly
if (require.main === module) {
    const server = new MonitoringServer(null);
    server.start();
}
