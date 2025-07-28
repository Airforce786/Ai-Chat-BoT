const { pgTable, uuid, text, integer, timestamp, boolean, json, real } = require("drizzle-orm/pg-core");
const { createInsertSchema } = require("drizzle-zod");

// Discord Users table
const discordUsers = pgTable("discord_users", {
  id: text("id").primaryKey(), // Discord user ID as string
  username: text("username").notNull(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  totalMemoryUsage: integer("total_memory_usage").default(0).notNull(), // in KB
  currentMemoryUsage: integer("current_memory_usage").default(0).notNull(), // in KB
  memoryQuota: integer("memory_quota").default(10240).notNull(), // 10MB default in KB
  conversationCount: integer("conversation_count").default(0).notNull(),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Conversations table
const conversations = pgTable("conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  discordUserId: text("discord_user_id").references(() => discordUsers.id).notNull(),
  channelId: text("channel_id").notNull(),
  guildId: text("guild_id"),
  title: text("title"),
  summary: text("summary"),
  messageCount: integer("message_count").default(0).notNull(),
  memoryUsage: integer("memory_usage").default(0).notNull(), // in KB
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }).defaultNow().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  context: json("context"), // Structured conversation context
  tags: text("tags").array(), // Conversation tags/categories
});

// Conversation Messages table
const conversationMessages = pgTable("conversation_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id").references(() => conversations.id).notNull(),
  discordMessageId: text("discord_message_id").unique(),
  authorId: text("author_id").notNull(), // Discord user ID
  content: text("content").notNull(),
  role: text("role").notNull(), // 'user', 'assistant', 'system'
  tokenCount: integer("token_count").default(0).notNull(),
  memorySize: integer("memory_size").default(0).notNull(), // in bytes
  isCompressed: boolean("is_compressed").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  metadata: json("metadata"), // Additional message metadata
});

// Memory Chunks table for efficient conversation context storage
const memoryChunks = pgTable("memory_chunks", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id").references(() => conversations.id).notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  summary: text("summary"),
  importance: real("importance").default(1.0).notNull(), // 0.0 to 1.0
  tokenCount: integer("token_count").default(0).notNull(),
  compressionRatio: real("compression_ratio").default(1.0).notNull(),
  lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  tags: text("tags").array(),
});

// User Custom Prompts table
const userCustomPrompts = pgTable("user_custom_prompts", {
  id: uuid("id").defaultRandom().primaryKey(),
  discordUserId: text("discord_user_id").references(() => discordUsers.id).notNull(),
  name: text("name").notNull(),
  prompt: text("prompt").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  usageCount: integer("usage_count").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Bot Statistics table for analytics
const botStatistics = pgTable("bot_statistics", {
  id: uuid("id").defaultRandom().primaryKey(),
  date: timestamp("date", { withTimezone: true }).defaultNow().notNull(),
  totalUsers: integer("total_users").default(0).notNull(),
  activeUsers: integer("active_users").default(0).notNull(),
  totalConversations: integer("total_conversations").default(0).notNull(),
  totalMessages: integer("total_messages").default(0).notNull(),
  totalMemoryUsage: integer("total_memory_usage").default(0).notNull(), // in KB
  averageMemoryPerUser: real("average_memory_per_user").default(0).notNull(),
  compressionEfficiency: real("compression_efficiency").default(0).notNull(), // percentage
  apiCalls: integer("api_calls").default(0).notNull(),
  memoryHitRate: real("memory_hit_rate").default(0).notNull(), // percentage
});

// Admin Actions table for audit logging
const adminActions = pgTable("admin_actions", {
  id: uuid("id").defaultRandom().primaryKey(),
  adminUserId: text("admin_user_id").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type"), // 'user', 'conversation', 'system'
  targetId: text("target_id"),
  details: json("details"),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
});

// Insert schemas for validation
const insertDiscordUserSchema = createInsertSchema(discordUsers).omit({ 
  createdAt: true, 
  updatedAt: true 
});

const insertConversationSchema = createInsertSchema(conversations).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  lastMessageAt: true
});

const insertConversationMessageSchema = createInsertSchema(conversationMessages).omit({ 
  id: true, 
  createdAt: true 
});

const insertMemoryChunkSchema = createInsertSchema(memoryChunks).omit({ 
  id: true, 
  createdAt: true,
  lastAccessedAt: true
});

const insertUserCustomPromptSchema = createInsertSchema(userCustomPrompts).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

const insertBotStatisticsSchema = createInsertSchema(botStatistics).omit({ 
  id: true, 
  date: true 
});

const insertAdminActionSchema = createInsertSchema(adminActions).omit({ 
  id: true, 
  timestamp: true 
});

module.exports = {
  discordUsers,
  conversations,
  conversationMessages,
  memoryChunks,
  userCustomPrompts,
  botStatistics,
  adminActions,
  insertDiscordUserSchema,
  insertConversationSchema,
  insertConversationMessageSchema,
  insertMemoryChunkSchema,
  insertUserCustomPromptSchema,
  insertBotStatisticsSchema,
  insertAdminActionSchema
};