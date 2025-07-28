const { storage } = require("../storage");

class ConversationService {
  async createConversation(discordUserId, channelId, guildId, initialMessage) {
    // Create or get user
    let user = await storage.getDiscordUser(discordUserId);
    if (!user) {
      user = await storage.createDiscordUser({
        id: discordUserId,
        username: "Unknown User",
        displayName: initialMessage.author?.username || "Unknown"
      });
    }

    // Create conversation
    const conversation = await storage.createConversation({
      discordUserId,
      channelId,
      guildId,
      title: this.generateConversationTitle(initialMessage.content),
      messageCount: 1,
      memoryUsage: Math.floor(initialMessage.content.length / 1024) // Rough KB estimate
    });

    // Add initial message
    await storage.addConversationMessage({
      conversationId: conversation.id,
      discordMessageId: initialMessage.id,
      authorId: discordUserId,
      content: initialMessage.content,
      role: "user",
      tokenCount: this.estimateTokenCount(initialMessage.content),
      memorySize: initialMessage.content.length
    });

    return conversation;
  }

  async addMessageToConversation(conversationId, message, role = "user") {
    const conversation = await storage.getConversation(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Add message
    const conversationMessage = await storage.addConversationMessage({
      conversationId,
      discordMessageId: message.id,
      authorId: message.author?.id || "system",
      content: message.content,
      role,
      tokenCount: this.estimateTokenCount(message.content),
      memorySize: message.content.length
    });

    // Update conversation stats
    const memorySize = message.content.length;
    if (conversation) {
      await storage.updateConversation(conversationId, {
        messageCount: conversation.messageCount + 1,
        memoryUsage: conversation.memoryUsage + Math.floor(memorySize / 1024) // Convert to KB
      });

      // Update user stats
      const user = await storage.getDiscordUser(conversation.discordUserId);
      if (user) {
        await storage.updateDiscordUser(user.id, {
          currentMemoryUsage: user.currentMemoryUsage + Math.floor(memorySize / 1024),
          lastActiveAt: new Date()
        });
      }
    }

    // Create memory chunk for important messages
    if (this.shouldCreateMemoryChunk(message.content, role)) {
      await this.createMemoryChunk(conversationId, message.content, role);
    }

    return conversationMessage;
  }

  shouldCreateMemoryChunk(content, role) {
    // Create memory chunks for:
    // 1. Long messages (>200 characters)
    // 2. Assistant responses
    // 3. Messages with specific keywords
    
    if (content.length > 200) return true;
    if (role === "assistant") return true;
    
    const keywords = ["remember", "important", "note", "save", "later"];
    return keywords.some(keyword => content.toLowerCase().includes(keyword));
  }

  async createMemoryChunk(conversationId, content, role) {
    const chunks = await storage.getMemoryChunks(conversationId);
    const chunkIndex = chunks.length;
    
    const importance = this.calculateImportance(content, role);
    const summary = this.generateSummary(content);
    
    await storage.createMemoryChunk({
      conversationId,
      chunkIndex,
      content,
      summary,
      importance,
      tokenCount: this.estimateTokenCount(content),
      compressionRatio: 1.0, // Initially uncompressed
      tags: this.extractTags(content)
    });
  }

  calculateImportance(content, role) {
    let importance = 0.5; // Base importance
    
    // Assistant responses are generally more important
    if (role === "assistant") importance += 0.3;
    
    // Longer content is often more important
    if (content.length > 500) importance += 0.2;
    
    // Content with questions or instructions
    if (content.includes("?") || content.includes("please") || content.includes("how")) {
      importance += 0.1;
    }
    
    // Cap at 1.0
    return Math.min(1.0, importance);
  }

  generateSummary(content) {
    // Simple summary generation - take first sentence or first 100 characters
    const sentences = content.split(/[.!?]+/);
    if (sentences.length > 0 && sentences[0].length > 0) {
      return sentences[0].trim() + (sentences.length > 1 ? "..." : "");
    }
    
    return content.length > 100 ? content.substring(0, 100) + "..." : content;
  }

  extractTags(content) {
    const tags = [];
    
    // Simple tag extraction based on keywords
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes("code") || lowerContent.includes("programming")) tags.push("coding");
    if (lowerContent.includes("help") || lowerContent.includes("question")) tags.push("help");
    if (lowerContent.includes("error") || lowerContent.includes("problem")) tags.push("troubleshooting");
    if (lowerContent.includes("thank") || lowerContent.includes("appreciate")) tags.push("positive");
    
    return tags;
  }

  generateConversationTitle(firstMessage) {
    // Generate a title from the first message
    const words = firstMessage.split(" ").slice(0, 6); // First 6 words
    let title = words.join(" ");
    
    if (firstMessage.length > title.length) {
      title += "...";
    }
    
    return title || "New Conversation";
  }

  estimateTokenCount(text) {
    // Rough token estimation: ~4 characters per token on average
    return Math.ceil(text.length / 4);
  }

  async getConversationContext(conversationId, maxTokens = 4000) {
    const messages = await storage.getConversationMessages(conversationId);
    const chunks = await storage.getMemoryChunks(conversationId);
    
    let context = "";
    let tokenCount = 0;
    
    // Add memory chunks first (most important context)
    const sortedChunks = chunks.sort((a, b) => b.importance - a.importance);
    for (const chunk of sortedChunks) {
      if (tokenCount + chunk.tokenCount > maxTokens) break;
      context += `[Memory: ${chunk.summary}]\n`;
      tokenCount += chunk.tokenCount;
    }
    
    // Add recent messages
    const recentMessages = messages.slice(-10); // Last 10 messages
    for (const message of recentMessages) {
      if (tokenCount + message.tokenCount > maxTokens) break;
      context += `${message.role}: ${message.content}\n`;
      tokenCount += message.tokenCount;
    }
    
    return {
      context,
      tokenCount,
      messageCount: messages.length,
      chunkCount: chunks.length
    };
  }

  async summarizeConversation(conversationId) {
    const messages = await storage.getConversationMessages(conversationId);
    const conversation = await storage.getConversation(conversationId);
    
    if (!conversation || messages.length === 0) {
      return "Empty conversation";
    }
    
    // Simple summarization - extract key points
    const userMessages = messages.filter(m => m.role === "user");
    const assistantMessages = messages.filter(m => m.role === "assistant");
    
    const topics = this.extractTopics(messages.map(m => m.content).join(" "));
    
    const summary = `Conversation with ${userMessages.length} user messages and ${assistantMessages.length} responses. Topics: ${topics.join(", ")}`;
    
    // Update conversation with summary
    await storage.updateConversation(conversationId, { summary });
    
    return summary;
  }

  extractTopics(text) {
    // Simple topic extraction based on common words
    const words = text.toLowerCase().split(/\W+/);
    const wordCount = {};
    
    // Count word frequency (ignore common words)
    const stopWords = new Set(["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "is", "are", "was", "were", "be", "been", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "can", "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them", "my", "your", "his", "her", "its", "our", "their"]);
    
    words.forEach(word => {
      if (word.length > 3 && !stopWords.has(word)) {
        wordCount[word] = (wordCount[word] || 0) + 1;
      }
    });
    
    // Get top 5 most frequent words as topics
    return Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word);
  }

  async archiveConversation(conversationId) {
    const conversation = await storage.getConversation(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }
    
    // Generate final summary
    await this.summarizeConversation(conversationId);
    
    // Mark as inactive
    await storage.updateConversation(conversationId, { isActive: false });
    
    // Log the action
    await storage.logAdminAction({
      adminUserId: "system",
      action: "archive_conversation",
      targetType: "conversation",
      targetId: conversationId,
      details: { automated: true }
    });
    
    return conversation;
  }
}

const conversationService = new ConversationService();

module.exports = { ConversationService, conversationService };