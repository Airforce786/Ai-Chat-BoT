const axios = require('axios');
const Logger = require('../utils/logger');
const TokenCounter = require('../utils/tokenCounter');
const config = require('../config/settings.json');

class GroqService {
    constructor() {
        this.apiKey = process.env.GROQ_API_KEY || 'default_groq_key';
        this.baseURL = 'https://api.groq.com/openai/v1';
        this.model = 'llama-3.1-8b-instant'; // Fast Groq model
        this.logger = new Logger();
        this.tokenCounter = new TokenCounter();
        
        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: 30000,
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            }
        });
    }

    async generateResponse(messages) {
        try {
            // Trim context if too many tokens
            const trimmedMessages = this.trimContext(messages);
            
            const requestData = {
                model: this.model,
                messages: trimmedMessages,
                max_tokens: Math.min(config.maxTokensPerRequest, 4000),
                temperature: 0.7,
                top_p: 0.9,
                stream: false
            };

            this.logger.debug('Groq API request:', { 
                model: this.model, 
                messageCount: trimmedMessages.length 
            });

            const response = await this.client.post('/chat/completions', requestData);
            
            if (response.data && response.data.choices && response.data.choices[0]) {
                const choice = response.data.choices[0];
                const content = choice.message.content.trim();
                
                this.logger.info('Groq response generated successfully', {
                    model: this.model,
                    inputTokens: response.data.usage?.prompt_tokens || 0,
                    outputTokens: response.data.usage?.completion_tokens || 0,
                    finishReason: choice.finish_reason
                });

                return {
                    content: content,
                    model: this.model,
                    usage: response.data.usage
                };
            } else {
                throw new Error('Invalid response format from Groq API');
            }

        } catch (error) {
            if (error.response) {
                const status = error.response.status;
                const data = error.response.data;
                
                // Handle specific error cases
                if (status === 429) {
                    this.logger.warn('Groq rate limit exceeded');
                    throw new Error('Rate limit exceeded');
                } else if (status === 401) {
                    this.logger.error('Groq API authentication failed');
                    throw new Error('Authentication failed');
                } else if (status >= 500) {
                    this.logger.error('Groq API server error:', data);
                    throw new Error('Server error');
                } else {
                    this.logger.error('Groq API error:', { status, data });
                    throw new Error(`API error: ${status}`);
                }
            } else if (error.code === 'ECONNABORTED') {
                this.logger.warn('Groq API request timeout');
                throw new Error('Request timeout');
            } else {
                this.logger.error('Groq service error:', error.message);
                throw error;
            }
        }
    }

    trimContext(messages) {
        // Keep system message and limit user/assistant pairs
        const systemMessages = messages.filter(m => m.role === 'system');
        const conversationMessages = messages.filter(m => m.role !== 'system');
        
        // Calculate token count and trim if necessary
        let totalTokens = this.tokenCounter.countTokens(systemMessages);
        const maxContextTokens = config.maxTokensPerRequest * 0.7; // Leave room for response
        
        let trimmedConversation = [];
        for (let i = conversationMessages.length - 1; i >= 0; i--) {
            const message = conversationMessages[i];
            const messageTokens = this.tokenCounter.countTokens([message]);
            
            if (totalTokens + messageTokens <= maxContextTokens) {
                trimmedConversation.unshift(message);
                totalTokens += messageTokens;
            } else {
                break;
            }
        }
        
        return [...systemMessages, ...trimmedConversation];
    }

    async testConnection() {
        try {
            const testMessages = [
                { role: 'user', content: 'Hello, are you working?' }
            ];
            
            const response = await this.generateResponse(testMessages);
            return response !== null;
        } catch (error) {
            this.logger.error('Groq connection test failed:', error.message);
            return false;
        }
    }

    getModelInfo() {
        return {
            name: 'Groq LLaMA 3.1',
            provider: 'Groq',
            model: this.model,
            features: ['Ultra-fast inference', 'Sub-millisecond latency', '128K context'],
            limits: '1,000 requests/day'
        };
    }
}

module.exports = GroqService;
