const express = require("express");
const { 
  insertDiscordUserSchema,
  insertConversationSchema,
  insertConversationMessageSchema,
  insertMemoryChunkSchema,
  insertUserCustomPromptSchema,
  insertBotStatisticsSchema,
  insertAdminActionSchema 
} = require("../shared/schema");
const { storage } = require("./storage");
const { memoryManager } = require("./services/memory-manager");
const { analyticsService } = require("./services/analytics-service");
const { adminCommands } = require("./services/admin-commands");

async function registerRoutes(app) {
  // Discord Users routes
  app.get("/api/discord-users", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const users = await storage.getDiscordUsers(limit);
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get("/api/discord-users/top-memory", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const users = await storage.getTopMemoryUsers(limit);
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch top memory users" });
    }
  });

  app.get("/api/discord-users/:id", async (req, res) => {
    try {
      const user = await storage.getDiscordUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post("/api/discord-users", async (req, res) => {
    try {
      const userData = insertDiscordUserSchema.parse(req.body);
      const user = await storage.createDiscordUser(userData);
      res.status(201).json(user);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid user data" });
    }
  });

  app.patch("/api/discord-users/:id", async (req, res) => {
    try {
      const updates = req.body;
      const user = await storage.updateDiscordUser(req.params.id, updates);
      res.json(user);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to update user" });
    }
  });

  // Conversations routes
  app.get("/api/conversations", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 20;
      const userId = req.query.userId;
      
      let conversations;
      if (userId) {
        conversations = await storage.getConversationsByUser(userId, limit);
      } else {
        conversations = await storage.getRecentConversations(limit);
      }
      
      res.json(conversations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.get("/api/conversations/active", async (req, res) => {
    try {
      const conversations = await storage.getActiveConversations();
      res.json(conversations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch active conversations" });
    }
  });

  app.get("/api/conversations/:id", async (req, res) => {
    try {
      const conversation = await storage.getConversation(req.params.id);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      res.json(conversation);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch conversation" });
    }
  });

  app.get("/api/conversations/:id/messages", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 100;
      const messages = await storage.getConversationMessages(req.params.id, limit);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post("/api/conversations", async (req, res) => {
    try {
      const conversationData = insertConversationSchema.parse(req.body);
      const conversation = await storage.createConversation(conversationData);
      res.status(201).json(conversation);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid conversation data" });
    }
  });

  app.patch("/api/conversations/:id", async (req, res) => {
    try {
      const updates = req.body;
      const conversation = await storage.updateConversation(req.params.id, updates);
      res.json(conversation);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid conversation data" });
    }
  });

  app.delete("/api/conversations/:id", async (req, res) => {
    try {
      const { id } = req.params;
      // Soft delete by marking inactive
      const conversation = await storage.getConversation(id);
      if (conversation) {
        await storage.updateConversation(id, { isActive: false });
      }
      res.json({ message: "Conversation deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete conversation" });
    }
  });

  // Messages routes
  app.post("/api/conversations/:id/messages", async (req, res) => {
    try {
      const messageData = insertConversationMessageSchema.parse({
        ...req.body,
        conversationId: req.params.id
      });
      const message = await storage.addConversationMessage(messageData);
      res.status(201).json(message);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid message data" });
    }
  });

  // Memory Chunks routes
  app.get("/api/conversations/:id/memory", async (req, res) => {
    try {
      const chunks = await storage.getMemoryChunks(req.params.id);
      res.json(chunks);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch memory chunks" });
    }
  });

  app.post("/api/conversations/:id/memory", async (req, res) => {
    try {
      const chunkData = insertMemoryChunkSchema.parse({
        ...req.body,
        conversationId: req.params.id
      });
      const chunk = await storage.createMemoryChunk(chunkData);
      res.status(201).json(chunk);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid memory chunk data" });
    }
  });

  app.patch("/api/memory-chunks/:id", async (req, res) => {
    try {
      const updates = req.body;
      const chunk = await storage.updateMemoryChunk(req.params.id, updates);
      res.json(chunk);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to update memory chunk" });
    }
  });

  app.delete("/api/memory-chunks/:id", async (req, res) => {
    try {
      await storage.deleteMemoryChunk(req.params.id);
      res.json({ message: "Memory chunk deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete memory chunk" });
    }
  });

  // Memory Management routes
  app.get("/api/memory/stats", async (req, res) => {
    try {
      const stats = await memoryManager.getMemoryStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch memory stats" });
    }
  });

  app.post("/api/memory/cleanup", async (req, res) => {
    try {
      await memoryManager.startMemoryCleanup();
      res.json({ message: "Memory cleanup started", status: "running" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/memory/cleanup-progress", async (req, res) => {
    try {
      const progress = memoryManager.getCleanupProgress();
      res.json(progress);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch cleanup progress" });
    }
  });

  app.post("/api/memory/optimize/:conversationId", async (req, res) => {
    try {
      const result = await memoryManager.optimizeConversationMemory(req.params.conversationId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to optimize conversation memory" });
    }
  });

  // Analytics routes  
  app.get("/api/analytics/dashboard", async (req, res) => {
    try {
      const data = await analyticsService.getDashboardData();
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard data" });
    }
  });

  app.get("/api/analytics/memory", async (req, res) => {
    try {
      const data = await analyticsService.getMemoryAnalytics();
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch memory analytics" });
    }
  });

  app.get("/api/analytics/users", async (req, res) => {
    try {
      const data = await analyticsService.getUserAnalytics();
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user analytics" });
    }
  });

  app.get("/api/analytics/conversations", async (req, res) => {
    try {
      const data = await analyticsService.getConversationAnalytics();
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch conversation analytics" });
    }
  });

  app.post("/api/analytics/record-daily", async (req, res) => {
    try {
      const stats = await analyticsService.recordDailyStatistics();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to record daily statistics" });
    }
  });

  // User Custom Prompts routes
  app.get("/api/users/:id/prompts", async (req, res) => {
    try {
      const prompts = await storage.getUserCustomPrompts(req.params.id);
      res.json(prompts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user prompts" });
    }
  });

  app.post("/api/users/:id/prompts", async (req, res) => {
    try {
      const promptData = insertUserCustomPromptSchema.parse({
        ...req.body,
        discordUserId: req.params.id
      });
      const prompt = await storage.createUserCustomPrompt(promptData);
      res.status(201).json(prompt);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid prompt data" });
    }
  });

  app.patch("/api/prompts/:id", async (req, res) => {
    try {
      const updates = req.body;
      const prompt = await storage.updateUserCustomPrompt(req.params.id, updates);
      res.json(prompt);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to update prompt" });
    }
  });

  // Bot Statistics routes
  app.get("/api/statistics", async (req, res) => {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate) : undefined;
      const stats = await storage.getBotStatistics(startDate, endDate);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  app.post("/api/statistics", async (req, res) => {
    try {
      const statsData = insertBotStatisticsSchema.parse(req.body);
      const stats = await storage.createBotStatistics(statsData);
      res.status(201).json(stats);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid statistics data" });
    }
  });

  // Admin Actions routes
  app.get("/api/admin/actions", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 100;
      const actions = await storage.getAdminActions(limit);
      res.json(actions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch admin actions" });
    }
  });

  app.post("/api/admin/actions", async (req, res) => {
    try {
      const actionData = insertAdminActionSchema.parse(req.body);
      const action = await storage.logAdminAction(actionData);
      res.status(201).json(action);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid action data" });
    }
  });

  // Admin Commands routes
  app.post("/api/admin/commands", async (req, res) => {
    try {
      const { command, subcommand, params = {} } = req.body;
      
      if (!command || !subcommand) {
        return res.status(400).json({ message: "Command and subcommand are required" });
      }

      const result = await adminCommands.executeCommand(command, subcommand, params);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to execute admin command" });
    }
  });

  app.get("/api/admin/commands", async (req, res) => {
    try {
      const commands = adminCommands.getAvailableCommands();
      res.json(commands);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch available commands" });
    }
  });

  app.get("/api/admin/system-health", async (req, res) => {
    try {
      const result = await adminCommands.executeCommand("system", "health", {});
      res.json(result.data);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch system health" });
    }
  });

  return app;
}

module.exports = { registerRoutes };