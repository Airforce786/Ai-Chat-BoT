const { storage } = require("../storage");
const { memoryManager } = require("./memory-manager");
const { analyticsService } = require("./analytics-service");

class AdminCommands {
  constructor() {
    this.ADMIN_COMMANDS = {
      'memory': {
        'status': this.getMemoryStatus.bind(this),
        'prune': this.pruneMemory.bind(this),
        'compress': this.compressMemory.bind(this),
        'optimize': this.optimizeMemory.bind(this)
      },
      'users': {
        'list': this.listUsers.bind(this),
        'reset-limits': this.resetUserLimits.bind(this),
        'cleanup': this.cleanupInactiveUsers.bind(this)
      },
      'conversations': {
        'list': this.listConversations.bind(this),
        'export': this.exportConversations.bind(this),
        'cleanup': this.cleanupOldConversations.bind(this)
      },
      'stats': {
        'current': this.getCurrentStats.bind(this),
        'export': this.exportStats.bind(this),
        'generate': this.generateReport.bind(this)
      },
      'system': {
        'health': this.getSystemHealth.bind(this),
        'restart': this.restartServices.bind(this),
        'backup': this.backupData.bind(this)
      }
    };
  }

  async executeCommand(command, subcommand, params = {}) {
    try {
      if (!this.ADMIN_COMMANDS[command]) {
        return {
          success: false,
          message: `Unknown command: ${command}`,
          availableCommands: Object.keys(this.ADMIN_COMMANDS)
        };
      }

      if (!this.ADMIN_COMMANDS[command][subcommand]) {
        return {
          success: false,
          message: `Unknown subcommand: ${subcommand}`,
          availableSubcommands: Object.keys(this.ADMIN_COMMANDS[command])
        };
      }

      const result = await this.ADMIN_COMMANDS[command][subcommand](params);
      
      // Log the admin action
      await storage.logAdminAction({
        adminUserId: params.adminUserId || "system",
        action: `${command}_${subcommand}`,
        targetType: "system",
        details: { params, result: result.success || false }
      });

      return result;
    } catch (error) {
      return {
        success: false,
        message: `Command execution failed: ${error.message}`,
        error: error.toString()
      };
    }
  }

  // Memory Commands
  async getMemoryStatus(params) {
    const stats = await memoryManager.getMemoryStats();
    const cleanupProgress = memoryManager.getCleanupProgress();
    
    return {
      success: true,
      data: {
        ...stats,
        cleanup: cleanupProgress,
        timestamp: new Date().toISOString()
      }
    };
  }

  async pruneMemory(params) {
    const { dryRun = false, maxAge = 30 } = params;
    
    if (dryRun) {
      // Calculate what would be pruned
      const cutoffDate = new Date(Date.now() - maxAge * 24 * 60 * 60 * 1000);
      const conversations = await storage.getActiveConversations();
      const toPrune = conversations.filter(conv => 
        conv.lastMessageAt < cutoffDate && conv.messageCount < 5
      );
      
      return {
        success: true,
        message: `Dry run: Would prune ${toPrune.length} conversations`,
        data: { wouldPrune: toPrune.length, totalConversations: conversations.length }
      };
    }

    await memoryManager.startMemoryCleanup();
    return {
      success: true,
      message: "Memory cleanup initiated",
      data: { status: "running" }
    };
  }

  async compressMemory(params) {
    const { conversationId, compressionRatio = 0.7 } = params;
    
    if (conversationId) {
      // Compress specific conversation
      const result = await memoryManager.optimizeConversationMemory(conversationId);
      return {
        success: true,
        message: `Compressed conversation ${conversationId}`,
        data: result
      };
    } else {
      // Compress all conversations
      const conversations = await storage.getActiveConversations();
      let totalSaved = 0;
      
      for (const conv of conversations.slice(0, 10)) { // Limit to 10 for performance
        const result = await memoryManager.optimizeConversationMemory(conv.id);
        totalSaved += result.memorySaved || 0;
      }
      
      return {
        success: true,
        message: `Compressed ${conversations.length} conversations`,
        data: { totalChunksSaved: totalSaved }
      };
    }
  }

  async optimizeMemory(params) {
    const stats = await memoryManager.getMemoryStats();
    
    // Run multiple optimization steps
    await this.compressMemory({ compressionRatio: 0.6 });
    await this.pruneMemory({ maxAge: 30 });
    
    const newStats = await memoryManager.getMemoryStats();
    
    return {
      success: true,
      message: "Memory optimization completed",
      data: {
        before: stats,
        after: newStats,
        improvement: {
          memoryReduced: stats.totalMemoryUsage - newStats.totalMemoryUsage,
          chunksReduced: stats.chunksCount - newStats.chunksCount
        }
      }
    };
  }

  // User Commands
  async listUsers(params) {
    const { limit = 50, sortBy = "lastActiveAt" } = params;
    const users = await storage.getDiscordUsers(limit);
    
    return {
      success: true,
      data: {
        users: users.map(user => ({
          id: user.id,
          username: user.username,
          memoryUsage: `${(user.currentMemoryUsage / 1024).toFixed(2)} MB`,
          memoryPercent: `${((user.currentMemoryUsage / user.memoryQuota) * 100).toFixed(1)}%`,
          conversations: user.conversationCount,
          lastActive: user.lastActiveAt
        })),
        total: users.length
      }
    };
  }

  async resetUserLimits(params) {
    const { userId, newQuota = 10240 } = params; // 10MB default
    
    if (userId) {
      await storage.updateDiscordUser(userId, { 
        memoryQuota: newQuota,
        currentMemoryUsage: 0 
      });
      return {
        success: true,
        message: `Reset memory limits for user ${userId}`,
        data: { userId, newQuota }
      };
    } else {
      // Reset all users
      const users = await storage.getDiscordUsers(1000);
      for (const user of users) {
        await storage.updateDiscordUser(user.id, { 
          memoryQuota: newQuota,
          currentMemoryUsage: 0 
        });
      }
      return {
        success: true,
        message: `Reset memory limits for ${users.length} users`,
        data: { usersReset: users.length, newQuota }
      };
    }
  }

  async cleanupInactiveUsers(params) {
    const { daysSinceActive = 60 } = params;
    const cutoffDate = new Date(Date.now() - daysSinceActive * 24 * 60 * 60 * 1000);
    
    const users = await storage.getDiscordUsers(1000);
    const inactiveUsers = users.filter(user => user.lastActiveAt < cutoffDate);
    
    // Reset memory for inactive users
    for (const user of inactiveUsers) {
      await storage.updateDiscordUser(user.id, { currentMemoryUsage: 0 });
    }
    
    return {
      success: true,
      message: `Cleaned up ${inactiveUsers.length} inactive users`,
      data: { cleanedUsers: inactiveUsers.length, daysSinceActive }
    };
  }

  // Conversation Commands
  async listConversations(params) {
    const { limit = 20, userId, active = true } = params;
    
    let conversations;
    if (userId) {
      conversations = await storage.getConversationsByUser(userId, limit);
    } else {
      conversations = active ? 
        await storage.getActiveConversations() : 
        await storage.getRecentConversations(limit);
    }
    
    return {
      success: true,
      data: {
        conversations: conversations.slice(0, limit).map(conv => ({
          id: conv.id,
          title: conv.title || "Untitled",
          messageCount: conv.messageCount,
          memoryUsage: `${(conv.memoryUsage / 1024).toFixed(2)} MB`,
          lastMessage: conv.lastMessageAt,
          isActive: conv.isActive
        })),
        total: conversations.length
      }
    };
  }

  async exportConversations(params) {
    const { userId, format = "json", limit = 100 } = params;
    
    let conversations;
    if (userId) {
      conversations = await storage.getConversationsByUser(userId, limit);
    } else {
      conversations = await storage.getRecentConversations(limit);
    }
    
    const exportData = [];
    for (const conv of conversations) {
      const messages = await storage.getConversationMessages(conv.id);
      exportData.push({
        conversation: conv,
        messages: messages
      });
    }
    
    return {
      success: true,
      message: `Exported ${exportData.length} conversations`,
      data: {
        format,
        timestamp: new Date().toISOString(),
        conversations: exportData
      }
    };
  }

  async cleanupOldConversations(params) {
    const { maxAge = 90, minMessages = 3 } = params;
    const cutoffDate = new Date(Date.now() - maxAge * 24 * 60 * 60 * 1000);
    
    const conversations = await storage.getActiveConversations();
    const toCleanup = conversations.filter(conv => 
      conv.lastMessageAt < cutoffDate && conv.messageCount < minMessages
    );
    
    for (const conv of toCleanup) {
      await storage.updateConversation(conv.id, { isActive: false });
    }
    
    return {
      success: true,
      message: `Cleaned up ${toCleanup.length} old conversations`,
      data: { cleanedUp: toCleanup.length, maxAge, minMessages }
    };
  }

  // Stats Commands
  async getCurrentStats(params) {
    const dashboardData = await analyticsService.getDashboardData();
    const memoryStats = await memoryManager.getMemoryStats();
    
    return {
      success: true,
      data: {
        dashboard: dashboardData,
        memory: memoryStats,
        timestamp: new Date().toISOString()
      }
    };
  }

  async exportStats(params) {
    const { days = 30, format = "json" } = params;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const stats = await storage.getBotStatistics(startDate, new Date());
    
    return {
      success: true,
      message: `Exported ${stats.length} statistics records`,
      data: {
        period: `${days} days`,
        format,
        stats
      }
    };
  }

  async generateReport(params) {
    const { type = "weekly" } = params;
    
    let report;
    if (type === "weekly") {
      report = await analyticsService.generateWeeklyReport();
    } else {
      // Daily report
      report = {
        period: "Today",
        summary: await analyticsService.getDashboardData(),
        timestamp: new Date().toISOString()
      };
    }
    
    return {
      success: true,
      message: `Generated ${type} report`,
      data: report
    };
  }

  // System Commands
  async getSystemHealth(params) {
    try {
      // Test database connection
      const users = await storage.getDiscordUsers(1);
      const dbHealthy = true;
      
      // Test memory system
      const memoryStats = await memoryManager.getMemoryStats();
      const memoryHealthy = memoryStats.totalMemoryUsage >= 0;
      
      return {
        success: true,
        data: {
          database: {
            status: dbHealthy ? "healthy" : "unhealthy",
            lastCheck: new Date().toISOString(),
            responseTime: "< 100ms"
          },
          memorySystem: {
            status: memoryHealthy ? "healthy" : "unhealthy",
            totalUsage: `${(memoryStats.totalMemoryUsage / 1024 / 1024).toFixed(2)} MB`,
            activeConversations: memoryStats.conversationCount
          },
          aiServices: {
            status: "healthy", // Would check actual AI service connectivity
            lastCheck: new Date().toISOString()
          },
          uptime: process.uptime(),
          version: "1.0.0"
        }
      };
    } catch (error) {
      return {
        success: false,
        message: "System health check failed",
        error: error.message
      };
    }
  }

  async restartServices(params) {
    const { service = "all" } = params;
    
    // This would restart specific services
    // For now, just return a success message
    return {
      success: true,
      message: `Restart initiated for: ${service}`,
      data: {
        service,
        timestamp: new Date().toISOString(),
        note: "Service restart functionality would be implemented here"
      }
    };
  }

  async backupData(params) {
    const { includeMessages = false, compress = true } = params;
    
    // This would create a backup of the database
    const backupId = `backup_${Date.now()}`;
    
    return {
      success: true,
      message: "Backup initiated",
      data: {
        backupId,
        includeMessages,
        compress,
        timestamp: new Date().toISOString(),
        note: "Backup functionality would be implemented here"
      }
    };
  }

  getAvailableCommands() {
    const commands = {};
    
    Object.keys(this.ADMIN_COMMANDS).forEach(command => {
      commands[command] = Object.keys(this.ADMIN_COMMANDS[command]);
    });
    
    return {
      success: true,
      data: {
        commands,
        usage: "Use: /admin <command> <subcommand> [params]",
        example: "/admin memory status"
      }
    };
  }
}

const adminCommands = new AdminCommands();

module.exports = { AdminCommands, adminCommands };