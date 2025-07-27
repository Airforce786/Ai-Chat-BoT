class TokenCounter {
    constructor() {
        // Rough estimation: 1 token ≈ 4 characters for English text
        this.avgCharsPerToken = 4;
        
        // Special token patterns and their approximate token counts
        this.specialTokens = {
            '<|begin_of_text|>': 1,
            '<|start_header_id|>': 1,
            '<|end_header_id|>': 1,
            '<|eot_id|>': 1,
            'system': 1,
            'user': 1,
            'assistant': 1
        };
    }

    countTokens(messages) {
        if (!Array.isArray(messages)) {
            return this.estimateTokens(messages.toString());
        }

        let totalTokens = 0;
        
        for (const message of messages) {
            if (message && message.content) {
                totalTokens += this.estimateTokens(message.content);
                
                // Add overhead for message structure
                totalTokens += 3; // role + formatting tokens
            }
        }
        
        return totalTokens;
    }

    estimateTokens(text) {
        if (!text || typeof text !== 'string') {
            return 0;
        }

        // Count special tokens
        let specialTokenCount = 0;
        let cleanText = text;
        
        for (const [token, count] of Object.entries(this.specialTokens)) {
            const regex = new RegExp(token.replace(/[|<>]/g, '\\$&'), 'g');
            const matches = (text.match(regex) || []).length;
            specialTokenCount += matches * count;
            cleanText = cleanText.replace(regex, '');
        }

        // Estimate tokens for remaining text
        const textTokens = Math.ceil(cleanText.length / this.avgCharsPerToken);
        
        return specialTokenCount + textTokens;
    }

    estimateResponseTokens(inputTokens, maxTokens = 4000) {
        // Conservative estimate: response is typically 10-50% of input
        const minResponse = Math.min(50, maxTokens * 0.1);
        const estimatedResponse = Math.min(inputTokens * 0.3, maxTokens * 0.4);
        
        return Math.max(minResponse, estimatedResponse);
    }

    checkTokenLimit(messages, maxTokens = 4000) {
        const inputTokens = this.countTokens(messages);
        const estimatedResponse = this.estimateResponseTokens(inputTokens, maxTokens);
        const totalEstimate = inputTokens + estimatedResponse;
        
        return {
            inputTokens,
            estimatedResponse,
            totalEstimate,
            withinLimit: totalEstimate <= maxTokens,
            remainingTokens: Math.max(0, maxTokens - totalEstimate)
        };
    }

    trimToTokenLimit(messages, maxTokens = 4000) {
        const tokenCheck = this.checkTokenLimit(messages, maxTokens);
        
        if (tokenCheck.withinLimit) {
            return messages;
        }

        // Keep system messages and trim conversation history
        const systemMessages = messages.filter(m => m.role === 'system');
        const conversationMessages = messages.filter(m => m.role !== 'system');
        
        let trimmedMessages = [...systemMessages];
        let currentTokens = this.countTokens(systemMessages);
        const responseBuffer = this.estimateResponseTokens(currentTokens, maxTokens);
        const availableTokens = maxTokens - responseBuffer - currentTokens;
        
        // Add conversation messages from most recent, working backwards
        for (let i = conversationMessages.length - 1; i >= 0; i--) {
            const message = conversationMessages[i];
            const messageTokens = this.countTokens([message]);
            
            if (currentTokens + messageTokens <= maxTokens - responseBuffer) {
                trimmedMessages.push(message);
                currentTokens += messageTokens;
            } else {
                break;
            }
        }
        
        // Restore chronological order for conversation messages
        const systemCount = systemMessages.length;
        const conversationPart = trimmedMessages.slice(systemCount);
        trimmedMessages = [...systemMessages, ...conversationPart.reverse()];
        
        return trimmedMessages;
    }

    getTokenStats(text) {
        const tokens = this.estimateTokens(text);
        const characters = text.length;
        const words = text.split(/\s+/).length;
        
        return {
            tokens,
            characters,
            words,
            avgCharsPerToken: characters / tokens,
            avgTokensPerWord: tokens / words
        };
    }

    // Utility method for debugging token usage
    analyzeMessages(messages) {
        const analysis = {
            totalMessages: messages.length,
            totalTokens: 0,
            messageBreakdown: [],
            roleDistribution: {}
        };

        for (const message of messages) {
            const tokens = this.countTokens([message]);
            const messageInfo = {
                role: message.role,
                tokens: tokens,
                characters: message.content.length,
                content: message.content.substring(0, 100) + (message.content.length > 100 ? '...' : '')
            };
            
            analysis.messageBreakdown.push(messageInfo);
            analysis.totalTokens += tokens;
            
            if (!analysis.roleDistribution[message.role]) {
                analysis.roleDistribution[message.role] = { count: 0, tokens: 0 };
            }
            
            analysis.roleDistribution[message.role].count++;
            analysis.roleDistribution[message.role].tokens += tokens;
        }

        return analysis;
    }
}

module.exports = TokenCounter;
