const { storage } = require("../storage");

class MemoryManager {
  constructor() {
    this.isCleanupRunning = false;
    this.cleanupProgress = 0;
  }

  async getMemoryStats() {
    const totalMemoryUsage = await storage.getTotalMemoryUsage();
    const conversationCount = await storage.getTotalConversations();
    const activeUsers = await storage.getActiveUsersCount();
    const averageMemoryPerUser = await storage.getAverageMemoryPerUser();

    return {
      totalMemoryUsage,
      conversationCount,
      activeUsers,
      averageMemoryPerUser,
      compressionRatio: await this.calculateCompressionRatio(),
      chunksCount: await this.getTotalChunksCount()
    };
  }

  async calculateCompressionRatio() {
    // This would calculate actual compression ratio from memory chunks
    // For now, return a placeholder value
    return 0.75; // 75% compression ratio
  }

  async getTotalChunksCount() {
    // Count total memory chunks across all conversations
    const conversations = await storage.getActiveConversations();
    let totalChunks = 0;
    
    for (const conversation of conversations) {
      const chunks = await storage.getMemoryChunks(conversation.id);
      totalChunks += chunks.length;
    }
    
    return totalChunks;
  }

  async startMemoryCleanup() {
    if (this.isCleanupRunning) {
      throw new Error("Memory cleanup is already in progress");
    }

    this.isCleanupRunning = true;
    this.cleanupProgress = 0;

    try {
      // Step 1: Clean up old conversations (25%)
      await this.cleanupOldConversations();
      this.cleanupProgress = 25;

      // Step 2: Compress memory chunks (50%)
      await this.compressMemoryChunks();
      this.cleanupProgress = 50;

      // Step 3: Remove duplicate chunks (75%)
      await this.removeDuplicateChunks();
      this.cleanupProgress = 75;

      // Step 4: Update user memory usage (100%)
      await this.updateUserMemoryUsage();
      this.cleanupProgress = 100;

      // Log the cleanup action
      await storage.logAdminAction({
        adminUserId: "system",
        action: "memory_cleanup",
        targetType: "system",
        details: { automated: true, timestamp: new Date() }
      });

    } finally {
      this.isCleanupRunning = false;
      setTimeout(() => {
        this.cleanupProgress = 0;
      }, 5000); // Reset progress after 5 seconds
    }
  }

  async cleanupOldConversations() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const oldConversations = await storage.getActiveConversations();
    
    const conversationsToCleanup = oldConversations.filter(
      conv => conv.lastMessageAt < thirtyDaysAgo && conv.messageCount < 5
    );

    for (const conversation of conversationsToCleanup) {
      await storage.updateConversation(conversation.id, { isActive: false });
    }
  }

  async compressMemoryChunks() {
    const conversations = await storage.getActiveConversations();
    
    for (const conversation of conversations) {
      const chunks = await storage.getMemoryChunks(conversation.id);
      
      // Compress chunks with low importance scores
      const lowImportanceChunks = chunks.filter(chunk => chunk.importance < 0.3);
      
      for (const chunk of lowImportanceChunks) {
        // Simulate compression by reducing content length and updating compression ratio
        const compressedContent = chunk.content.substring(0, Math.floor(chunk.content.length * 0.7));
        await storage.updateMemoryChunk(chunk.id, {
          content: compressedContent,
          compressionRatio: 0.7,
          tokenCount: Math.floor(chunk.tokenCount * 0.7)
        });
      }
    }
  }

  async removeDuplicateChunks() {
    const conversations = await storage.getActiveConversations();
    
    for (const conversation of conversations) {
      const chunks = await storage.getMemoryChunks(conversation.id);
      const seenContent = new Set();
      
      for (const chunk of chunks) {
        const contentHash = chunk.content.substring(0, 100); // Simple hash
        if (seenContent.has(contentHash)) {
          await storage.deleteMemoryChunk(chunk.id);
        } else {
          seenContent.add(contentHash);
        }
      }
    }
  }

  async updateUserMemoryUsage() {
    const users = await storage.getDiscordUsers();
    
    for (const user of users) {
      const userConversations = await storage.getConversationsByUser(user.id);
      const totalMemoryUsage = userConversations.reduce((sum, conv) => sum + conv.memoryUsage, 0);
      
      await storage.updateDiscordUser(user.id, {
        currentMemoryUsage: totalMemoryUsage,
        conversationCount: userConversations.length
      });
    }
  }

  getCleanupProgress() {
    return {
      isRunning: this.isCleanupRunning,
      progress: this.cleanupProgress,
      message: this.getProgressMessage()
    };
  }

  getProgressMessage() {
    if (!this.isCleanupRunning) return "Idle";
    
    if (this.cleanupProgress < 25) return "Cleaning old conversations...";
    if (this.cleanupProgress < 50) return "Compressing memory chunks...";
    if (this.cleanupProgress < 75) return "Removing duplicates...";
    if (this.cleanupProgress < 100) return "Updating user statistics...";
    return "Cleanup complete";
  }

  async optimizeConversationMemory(conversationId) {
    const chunks = await storage.getMemoryChunks(conversationId);
    const conversation = await storage.getConversation(conversationId);
    
    if (!conversation) return;

    // Merge similar chunks and increase importance of frequently accessed ones
    const optimizedChunks = await this.mergeAndOptimizeChunks(chunks);
    
    // Update conversation memory usage
    const totalMemoryUsage = optimizedChunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0);
    await storage.updateConversation(conversationId, {
      memoryUsage: Math.floor(totalMemoryUsage / 1024) // Convert to KB
    });

    return {
      originalChunks: chunks.length,
      optimizedChunks: optimizedChunks.length,
      memorySaved: chunks.length - optimizedChunks.length
    };
  }

  async mergeAndOptimizeChunks(chunks) {
    // Simple optimization: merge chunks with similar content
    const optimizedChunks = [];
    const processed = new Set();

    for (let i = 0; i < chunks.length; i++) {
      if (processed.has(i)) continue;

      const chunk = chunks[i];
      let mergedContent = chunk.content;
      let mergedTokenCount = chunk.tokenCount;

      // Look for similar chunks to merge
      for (let j = i + 1; j < chunks.length; j++) {
        if (processed.has(j)) continue;

        const similarityScore = this.calculateSimilarity(chunk.content, chunks[j].content);
        if (similarityScore > 0.7) { // 70% similarity threshold
          mergedContent += " " + chunks[j].content;
          mergedTokenCount += chunks[j].tokenCount;
          processed.add(j);
        }
      }

      optimizedChunks.push({
        ...chunk,
        content: mergedContent,
        tokenCount: mergedTokenCount,
        importance: Math.min(1.0, chunk.importance * 1.1) // Slightly increase importance
      });
      processed.add(i);
    }

    return optimizedChunks;
  }

  calculateSimilarity(text1, text2) {
    // Simple similarity calculation based on common words
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    const commonWords = words1.filter(word => words2.includes(word));
    
    return commonWords.length / Math.max(words1.length, words2.length);
  }
}

const memoryManager = new MemoryManager();

module.exports = { MemoryManager, memoryManager };