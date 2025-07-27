const Logger = require('../utils/logger');
const config = require('../config/settings.json');

class ConversationManager {
    constructor() {
        this.conversations = new Map();
        this.logger = new Logger();
        this.maxContextMessages = config.maxContextMessages || 10;
        this.conversationTimeout = config.conversationTimeout || 3600000; // 1 hour
        
        // Cleanup old conversations every 10 minutes
        setInterval(() => this.cleanupOldConversations(), 600000);
    }

    getContext(userId) {
        const conversation = this.conversations.get(userId);
        
        if (!conversation) {
            return [];
        }

        // Check if conversation has expired
        const now = Date.now();
        if (now - conversation.lastActivity > this.conversationTimeout) {
            this.conversations.delete(userId);
            return [];
        }

        // Update last activity
        conversation.lastActivity = now;
        
        // Return only the message history, not metadata
        return conversation.messages || [];
    }

    addMessage(userId, role, content) {
        let conversation = this.conversations.get(userId);
        
        if (!conversation) {
            conversation = {
                messages: [],
                lastActivity: Date.now(),
                messageCount: 0
            };
            this.conversations.set(userId, conversation);
        }

        // Add new message
        conversation.messages.push({
            role: role,
            content: content
        });

        conversation.messageCount++;
        conversation.lastActivity = Date.now();

        // Trim context if it gets too long
        if (conversation.messages.length > this.maxContextMessages) {
            // Remove oldest user/assistant pairs, keep system messages
            const systemMessages = conversation.messages.filter(m => m.role === 'system');
            const otherMessages = conversation.messages.filter(m => m.role !== 'system');
            
            // Keep only the most recent messages
            const keepCount = this.maxContextMessages - systemMessages.length;
            const recentMessages = otherMessages.slice(-keepCount);
            
            conversation.messages = [...systemMessages, ...recentMessages];
        }

        this.logger.debug(`Added message for user ${userId}`, {
            role: role,
            messageCount: conversation.messageCount,
            contextLength: conversation.messages.length
        });
    }

    clearContext(userId) {
        const conversation = this.conversations.get(userId);
        if (conversation) {
            const messageCount = conversation.messageCount;
            this.conversations.delete(userId);
            
            this.logger.info(`Cleared conversation context for user ${userId}`, {
                totalMessages: messageCount
            });
            
            return true;
        }
        return false;
    }

    getConversationStats(userId) {
        const conversation = this.conversations.get(userId);
        if (!conversation) {
            return null;
        }

        const now = Date.now();
        const activeTime = now - (conversation.lastActivity - this.conversationTimeout);
        
        return {
            messageCount: conversation.messageCount,
            contextLength: conversation.messages.length,
            lastActivity: conversation.lastActivity,
            activeTime: Math.max(0, activeTime),
            isActive: (now - conversation.lastActivity) < this.conversationTimeout
        };
    }

    getAllStats() {
        const stats = {
            totalConversations: this.conversations.size,
            activeConversations: 0,
            totalMessages: 0,
            avgMessagesPerConversation: 0
        };

        const now = Date.now();
        
        for (const [userId, conversation] of this.conversations) {
            stats.totalMessages += conversation.messageCount;
            
            if ((now - conversation.lastActivity) < this.conversationTimeout) {
                stats.activeConversations++;
            }
        }

        if (stats.totalConversations > 0) {
            stats.avgMessagesPerConversation = Math.round(stats.totalMessages / stats.totalConversations);
        }

        return stats;
    }

    cleanupOldConversations() {
        const now = Date.now();
        let cleanedCount = 0;

        for (const [userId, conversation] of this.conversations) {
            if ((now - conversation.lastActivity) > this.conversationTimeout) {
                this.conversations.delete(userId);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            this.logger.info(`Cleaned up ${cleanedCount} old conversations`);
        }
    }

    // Admin functions
    forceCleanup() {
        const count = this.conversations.size;
        this.conversations.clear();
        this.logger.info(`Force cleaned ${count} conversations`);
        return count;
    }

    getActiveUsers() {
        const now = Date.now();
        const activeUsers = [];

        for (const [userId, conversation] of this.conversations) {
            if ((now - conversation.lastActivity) < this.conversationTimeout) {
                activeUsers.push({
                    userId: userId,
                    messageCount: conversation.messageCount,
                    lastActivity: conversation.lastActivity,
                    contextLength: conversation.messages.length
                });
            }
        }

        return activeUsers.sort((a, b) => b.lastActivity - a.lastActivity);
    }
}

module.exports = ConversationManager;
