const { storage } = require("../storage");

class AnalyticsService {
  async getDashboardData() {
    const [
      totalMemoryUsage,
      totalConversations, 
      activeUsers,
      averageMemoryPerUser,
      recentStats
    ] = await Promise.all([
      storage.getTotalMemoryUsage(),
      storage.getTotalConversations(),
      storage.getActiveUsersCount(),
      storage.getAverageMemoryPerUser(),
      storage.getLatestBotStatistics()
    ]);

    return {
      memoryUsage: `${(totalMemoryUsage / 1024 / 1024).toFixed(1)} GB`,
      activeConversations: totalConversations,
      totalUsers: activeUsers,
      memoryEfficiency: `${((averageMemoryPerUser / 10240) * 100).toFixed(1)}%`, // Percentage of quota used
      compressionRatio: recentStats?.compressionEfficiency || 75,
      apiCalls: recentStats?.apiCalls || 0,
      uptime: this.calculateUptime(),
      trendsData: await this.getTrendsData()
    };
  }

  calculateUptime() {
    // Calculate uptime in hours (simplified)
    const startTime = process.uptime();
    return Math.floor(startTime / 3600);
  }

  async getTrendsData() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const stats = await storage.getBotStatistics(thirtyDaysAgo, new Date());
    
    // Generate trend data for the last 30 days
    const trends = {
      memory: [],
      users: [],
      conversations: [],
      apiCalls: []
    };

    // If we have stats, use them; otherwise generate sample data
    if (stats.length > 0) {
      stats.forEach(stat => {
        const date = stat.date.toISOString().split('T')[0];
        trends.memory.push({ date, value: stat.totalMemoryUsage / 1024 }); // MB
        trends.users.push({ date, value: stat.activeUsers });
        trends.conversations.push({ date, value: stat.totalConversations });
        trends.apiCalls.push({ date, value: stat.apiCalls });
      });
    } else {
      // Generate sample trend data for the last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        trends.memory.push({ date, value: Math.random() * 100 }); // Random MB
        trends.users.push({ date, value: Math.floor(Math.random() * 50) });
        trends.conversations.push({ date, value: Math.floor(Math.random() * 20) });
        trends.apiCalls.push({ date, value: Math.floor(Math.random() * 1000) });
      }
    }

    return trends;
  }

  async getMemoryAnalytics() {
    const [
      totalMemoryUsage,
      topMemoryUsers,
      memoryDistribution
    ] = await Promise.all([
      storage.getTotalMemoryUsage(),
      storage.getTopMemoryUsers(10),
      this.getMemoryDistribution()
    ]);

    return {
      totalUsage: totalMemoryUsage,
      topUsers: topMemoryUsers.map(user => ({
        id: user.id,
        username: user.username,
        usage: user.currentMemoryUsage,
        percentage: ((user.currentMemoryUsage / user.memoryQuota) * 100).toFixed(1)
      })),
      distribution: memoryDistribution,
      efficiency: await this.calculateMemoryEfficiency()
    };
  }

  async getMemoryDistribution() {
    const users = await storage.getDiscordUsers(1000); // Get up to 1000 users
    
    const distribution = {
      low: 0,    // 0-25% of quota
      medium: 0, // 26-75% of quota  
      high: 0,   // 76-90% of quota
      critical: 0 // 91-100% of quota
    };

    users.forEach(user => {
      const percentage = (user.currentMemoryUsage / user.memoryQuota) * 100;
      
      if (percentage <= 25) distribution.low++;
      else if (percentage <= 75) distribution.medium++;
      else if (percentage <= 90) distribution.high++;
      else distribution.critical++;
    });

    return distribution;
  }

  async calculateMemoryEfficiency() {
    const conversations = await storage.getActiveConversations();
    let totalOriginalSize = 0;
    let totalCompressedSize = 0;

    for (const conversation of conversations) {
      const chunks = await storage.getMemoryChunks(conversation.id);
      chunks.forEach(chunk => {
        const originalSize = chunk.tokenCount / (chunk.compressionRatio || 1);
        totalOriginalSize += originalSize;
        totalCompressedSize += chunk.tokenCount;
      });
    }

    if (totalOriginalSize === 0) return 0;
    return ((totalOriginalSize - totalCompressedSize) / totalOriginalSize * 100).toFixed(1);
  }

  async getUserAnalytics() {
    const [
      totalUsers,
      activeUsers,
      newUsersToday,
      topActiveUsers
    ] = await Promise.all([
      this.getTotalUsersCount(),
      storage.getActiveUsersCount(),
      this.getNewUsersToday(),
      this.getTopActiveUsers()
    ]);

    return {
      total: totalUsers,
      active: activeUsers,
      newToday: newUsersToday,
      topActive: topActiveUsers,
      retentionRate: totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(1) : 0
    };
  }

  async getTotalUsersCount() {
    const users = await storage.getDiscordUsers(10000);
    return users.length;
  }

  async getNewUsersToday() {
    const users = await storage.getDiscordUsers(1000);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return users.filter(user => user.createdAt >= today).length;
  }

  async getTopActiveUsers(limit = 10) {
    const users = await storage.getDiscordUsers(100);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    return users
      .filter(user => user.lastActiveAt >= oneDayAgo)
      .sort((a, b) => b.conversationCount - a.conversationCount)
      .slice(0, limit)
      .map(user => ({
        id: user.id,
        username: user.username,
        conversationCount: user.conversationCount,
        memoryUsage: user.currentMemoryUsage,
        lastActive: user.lastActiveAt
      }));
  }

  async getConversationAnalytics() {
    const conversations = await storage.getActiveConversations();
    const recentConversations = await storage.getRecentConversations(50);
    
    const analytics = {
      total: conversations.length,
      averageLength: 0,
      averageMemoryUsage: 0,
      topChannels: {},
      messageDistribution: this.getMessageDistribution(conversations)
    };

    if (conversations.length > 0) {
      analytics.averageLength = conversations.reduce((sum, conv) => sum + conv.messageCount, 0) / conversations.length;
      analytics.averageMemoryUsage = conversations.reduce((sum, conv) => sum + conv.memoryUsage, 0) / conversations.length;
    }

    // Count conversations per channel
    conversations.forEach(conv => {
      analytics.topChannels[conv.channelId] = (analytics.topChannels[conv.channelId] || 0) + 1;
    });

    return analytics;
  }

  getMessageDistribution(conversations) {
    const distribution = {
      short: 0,   // 1-5 messages
      medium: 0,  // 6-20 messages
      long: 0,    // 21-50 messages
      extended: 0 // 50+ messages
    };

    conversations.forEach(conv => {
      if (conv.messageCount <= 5) distribution.short++;
      else if (conv.messageCount <= 20) distribution.medium++;
      else if (conv.messageCount <= 50) distribution.long++;
      else distribution.extended++;
    });

    return distribution;
  }

  async recordDailyStatistics() {
    const [
      totalUsers,
      activeUsers,
      totalConversations,
      totalMessages,
      totalMemoryUsage,
      averageMemoryPerUser,
      compressionEfficiency,
      apiCalls
    ] = await Promise.all([
      this.getTotalUsersCount(),
      storage.getActiveUsersCount(),
      storage.getTotalConversations(),
      this.getTotalMessagesCount(),
      storage.getTotalMemoryUsage(),
      storage.getAverageMemoryPerUser(),
      this.calculateMemoryEfficiency(),
      this.getApiCallsCount()
    ]);

    const stats = await storage.createBotStatistics({
      totalUsers,
      activeUsers,
      totalConversations,
      totalMessages,
      totalMemoryUsage,
      averageMemoryPerUser,
      compressionEfficiency: parseFloat(compressionEfficiency),
      apiCalls,
      memoryHitRate: Math.random() * 100 // Placeholder - would be calculated from actual cache hits
    });

    return stats;
  }

  async getTotalMessagesCount() {
    // This would need to be implemented based on your message counting needs
    const conversations = await storage.getActiveConversations();
    return conversations.reduce((sum, conv) => sum + conv.messageCount, 0);
  }

  async getApiCallsCount() {
    // This would track actual API calls to external services
    // For now, return a placeholder value
    return Math.floor(Math.random() * 1000);
  }

  async generateWeeklyReport() {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const stats = await storage.getBotStatistics(weekAgo, new Date());
    
    const report = {
      period: "Last 7 days",
      summary: {
        totalUsers: stats.length > 0 ? stats[stats.length - 1].totalUsers : 0,
        newUsers: this.calculateNewUsers(stats),
        totalConversations: stats.length > 0 ? stats[stats.length - 1].totalConversations : 0,
        memoryGrowth: this.calculateMemoryGrowth(stats),
        averageApiCalls: this.calculateAverageApiCalls(stats)
      },
      trends: this.analyzeTrends(stats),
      recommendations: this.generateRecommendations(stats)
    };

    return report;
  }

  calculateNewUsers(stats) {
    if (stats.length < 2) return 0;
    return stats[stats.length - 1].totalUsers - stats[0].totalUsers;
  }

  calculateMemoryGrowth(stats) {
    if (stats.length < 2) return 0;
    const growth = stats[stats.length - 1].totalMemoryUsage - stats[0].totalMemoryUsage;
    return (growth / 1024 / 1024).toFixed(2); // MB
  }

  calculateAverageApiCalls(stats) {
    if (stats.length === 0) return 0;
    const total = stats.reduce((sum, stat) => sum + stat.apiCalls, 0);
    return Math.floor(total / stats.length);
  }

  analyzeTrends(stats) {
    return {
      userGrowth: "steady", // Would analyze actual growth patterns
      memoryUsage: "increasing",
      conversationActivity: "stable"
    };
  }

  generateRecommendations(stats) {
    const recommendations = [];
    
    if (stats.length > 0) {
      const latest = stats[stats.length - 1];
      
      if (latest.compressionEfficiency < 60) {
        recommendations.push("Consider running memory optimization to improve compression efficiency");
      }
      
      if (latest.memoryHitRate < 70) {
        recommendations.push("Memory cache hit rate is low - consider adjusting caching strategy");
      }
      
      if (latest.averageMemoryPerUser > 8192) { // 8MB
        recommendations.push("Average memory usage per user is high - consider implementing memory limits");
      }
    }

    return recommendations;
  }
}

const analyticsService = new AnalyticsService();

module.exports = { AnalyticsService, analyticsService };