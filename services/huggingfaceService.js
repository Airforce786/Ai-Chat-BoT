const axios = require('axios');
const Logger = require('../utils/logger');
const TokenCounter = require('../utils/tokenCounter');
const config = require('../config/settings.json');

class HuggingFaceService {
    constructor() {
        this.apiKey = process.env.HUGGINGFACE_API_KEY || 'default_hf_key';
        this.baseURL = 'https://api-inference.huggingface.co';
        
        // Use Groq provider via Hugging Face for consistency
        this.model = 'meta-llama/Llama-3.1-8B-Instruct';
        this.provider = 'groq'; // Use Groq as provider for ultra-fast inference
        
        this.logger = new Logger();
        this.tokenCounter = new TokenCounter();
        
        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: 60000, // Longer timeout for HF
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
            
            // Convert messages to text format for HF
            const prompt = this.messagesToPrompt(trimmedMessages);
            
            const requestData = {
                inputs: prompt,
                parameters: {
                    max_new_tokens: Math.min(config.maxTokensPerRequest, 2000),
                    temperature: 0.7,
                    top_p: 0.9,
                    do_sample: true,
                    return_full_text: false
                },
                options: {
                    wait_for_model: true,
                    use_cache: false
                }
            };

            // Add provider if using Groq via HF
            if (this.provider === 'groq') {
                requestData.provider = 'groq';
            }

            this.logger.debug('HuggingFace API request:', { 
                model: this.model,
                provider: this.provider,
                promptLength: prompt.length
            });

            const response = await this.client.post(`/models/${this.model}`, requestData);
            
            if (response.data && Array.isArray(response.data) && response.data[0]) {
                const generatedText = response.data[0].generated_text;
                
                // Clean up the response
                const content = this.cleanResponse(generatedText);
                
                this.logger.info('HuggingFace response generated successfully', {
                    model: this.model,
                    provider: this.provider,
                    responseLength: content.length
                });

                return {
                    content: content,
                    model: this.model,
                    provider: this.provider
                };
            } else {
                throw new Error('Invalid response format from HuggingFace API');
            }

        } catch (error) {
            if (error.response) {
                const status = error.response.status;
                const data = error.response.data;
                
                // Handle specific error cases
                if (status === 429) {
                    this.logger.warn('HuggingFace rate limit exceeded');
                    throw new Error('Rate limit exceeded');
                } else if (status === 401) {
                    this.logger.error('HuggingFace API authentication failed');
                    throw new Error('Authentication failed');
                } else if (status === 503) {
                    this.logger.warn('HuggingFace model loading:', data);
                    throw new Error('Model loading, please try again');
                } else if (status >= 500) {
                    this.logger.error('HuggingFace API server error:', data);
                    throw new Error('Server error');
                } else {
                    this.logger.error('HuggingFace API error:', { status, data });
                    throw new Error(`API error: ${status}`);
                }
            } else if (error.code === 'ECONNABORTED') {
                this.logger.warn('HuggingFace API request timeout');
                throw new Error('Request timeout');
            } else {
                this.logger.error('HuggingFace service error:', error.message);
                throw error;
            }
        }
    }

    messagesToPrompt(messages) {
        // Convert OpenAI-style messages to LLaMA prompt format
        let prompt = '';
        
        for (const message of messages) {
            if (message.role === 'system') {
                prompt += `<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n${message.content}<|eot_id|>`;
            } else if (message.role === 'user') {
                prompt += `<|start_header_id|>user<|end_header_id|>\n${message.content}<|eot_id|>`;
            } else if (message.role === 'assistant') {
                prompt += `<|start_header_id|>assistant<|end_header_id|>\n${message.content}<|eot_id|>`;
            }
        }
        
        // Add assistant header for response
        prompt += `<|start_header_id|>assistant<|end_header_id|>\n`;
        
        return prompt;
    }

    cleanResponse(text) {
        // Clean up the generated response
        let cleaned = text.trim();
        
        // Remove any remaining special tokens
        cleaned = cleaned.replace(/<\|.*?\|>/g, '');
        cleaned = cleaned.replace(/<\|eot_id\|>/g, '');
        
        // Remove leading/trailing whitespace and newlines
        cleaned = cleaned.trim();
        
        return cleaned;
    }

    trimContext(messages) {
        // Keep system message and limit user/assistant pairs
        const systemMessages = messages.filter(m => m.role === 'system');
        const conversationMessages = messages.filter(m => m.role !== 'system');
        
        // Calculate approximate token count and trim if necessary
        let totalLength = systemMessages.reduce((acc, m) => acc + m.content.length, 0);
        const maxContextLength = config.maxTokensPerRequest * 3; // Rough character to token ratio
        
        let trimmedConversation = [];
        for (let i = conversationMessages.length - 1; i >= 0; i--) {
            const message = conversationMessages[i];
            
            if (totalLength + message.content.length <= maxContextLength) {
                trimmedConversation.unshift(message);
                totalLength += message.content.length;
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
            this.logger.error('HuggingFace connection test failed:', error.message);
            return false;
        }
    }

    getModelInfo() {
        return {
            name: 'HuggingFace LLaMA 3.1',
            provider: this.provider === 'groq' ? 'Groq via HuggingFace' : 'HuggingFace',
            model: this.model,
            features: ['Multiple model access', 'Reliable fallback', 'Open source'],
            limits: 'Variable based on usage'
        };
    }
}

module.exports = HuggingFaceService;
