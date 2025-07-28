const { 
  discordUsers, 
  conversations, 
  conversationMessages, 
  memoryChunks, 
  userCustomPrompts, 
  botStatistics, 
  adminActions 
} = require("../shared/schema");
const { db } = require("./db");
const { eq, desc, asc, and, gte, lte, count, sum, avg } = require("drizzle-orm");

class DatabaseStorage {
  // Discord Users
  async getDiscordUser(id) {
    const [user] = await db.select().from(discordUsers).where(eq(discordUsers.id, id));
    return user || undefined;
  }

  async getDiscordUsers(limit = 50) {
    return await db
      .select()
      .from(discordUsers)
      .orderBy(desc(discordUsers.lastActiveAt))
      .limit(limit);
  }

  async createDiscordUser(user) {
    const [created] = await db
      .insert(discordUsers)
      .values(user)
      .returning();
    return created;
  }

  async updateDiscordUser(id, updates) {
    const [updated] = await db
      .update(discordUsers)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(discordUsers.id, id))
      .returning();
    return updated;
  }

  async getTopMemoryUsers(limit = 10) {
    return await db
      .select()
      .from(discordUsers)
      .orderBy(desc(discordUsers.currentMemoryUsage))
      .limit(limit);
  }

  async getConversation(id) {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conversation || undefined;
  }

  async getConversationsByUser(discordUserId, limit = 50) {
    return await db
      .select()
      .from(conversations)
      .where(eq(conversations.discordUserId, discordUserId))
      .orderBy(desc(conversations.lastMessageAt))
      .limit(limit);
  }

  async createConversation(conversation) {
    const [created] = await db
      .insert(conversations)
      .values(conversation)
      .returning();
    return created;
  }

  async updateConversation(id, updates) {
    const [updated] = await db
      .update(conversations)
      .set({ 
        ...updates, 
        updatedAt: new Date(),
        lastMessageAt: new Date()
      })
      .where(eq(conversations.id, id))
      .returning();
    return updated;
  }

  async getActiveConversations() {
    return await db
      .select()
      .from(conversations)
      .where(eq(conversations.isActive, true))
      .orderBy(desc(conversations.lastMessageAt));
  }

  async getRecentConversations(limit = 20) {
    const results = await db
      .select({
        id: conversations.id,
        discordUserId: conversations.discordUserId,
        channelId: conversations.channelId,
        guildId: conversations.guildId,
        title: conversations.title,
        summary: conversations.summary,
        messageCount: conversations.messageCount,
        memoryUsage: conversations.memoryUsage,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
        lastMessageAt: conversations.lastMessageAt,
        isActive: conversations.isActive,
        context: conversations.context,
        tags: conversations.tags,
        username: discordUsers.username,
      })
      .from(conversations)
      .leftJoin(discordUsers, eq(conversations.discordUserId, discordUsers.id))
      .orderBy(desc(conversations.lastMessageAt))
      .limit(limit);
    
    return results.map(r => ({
      ...r,
      username: r.username || 'Unknown'
    }));
  }

  async getConversationMessages(conversationId, limit = 100) {
    return await db
      .select()
      .from(conversationMessages)
      .where(eq(conversationMessages.conversationId, conversationId))
      .orderBy(asc(conversationMessages.createdAt))
      .limit(limit);
  }

  async addConversationMessage(message) {
    const [created] = await db
      .insert(conversationMessages)
      .values(message)
      .returning();
    return created;
  }

  async getMessageById(id) {
    const [message] = await db.select().from(conversationMessages).where(eq(conversationMessages.id, id));
    return message || undefined;
  }

  async getMemoryChunks(conversationId) {
    return await db
      .select()
      .from(memoryChunks)
      .where(eq(memoryChunks.conversationId, conversationId))
      .orderBy(desc(memoryChunks.importance), desc(memoryChunks.lastAccessedAt));
  }

  async createMemoryChunk(chunk) {
    const [created] = await db
      .insert(memoryChunks)
      .values(chunk)
      .returning();
    return created;
  }

  async updateMemoryChunk(id, updates) {
    const [updated] = await db
      .update(memoryChunks)
      .set({ ...updates, lastAccessedAt: new Date() })
      .where(eq(memoryChunks.id, id))
      .returning();
    return updated;
  }

  async deleteMemoryChunk(id) {
    await db.delete(memoryChunks).where(eq(memoryChunks.id, id));
  }

  async getUserCustomPrompts(discordUserId) {
    return await db
      .select()
      .from(userCustomPrompts)
      .where(and(
        eq(userCustomPrompts.discordUserId, discordUserId),
        eq(userCustomPrompts.isActive, true)
      ))
      .orderBy(desc(userCustomPrompts.usageCount));
  }

  async createUserCustomPrompt(prompt) {
    const [created] = await db
      .insert(userCustomPrompts)
      .values(prompt)
      .returning();
    return created;
  }

  async updateUserCustomPrompt(id, updates) {
    const [updated] = await db
      .update(userCustomPrompts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(userCustomPrompts.id, id))
      .returning();
    return updated;
  }

  async getBotStatistics(startDate, endDate) {
    const query = db.select().from(botStatistics).orderBy(desc(botStatistics.date));
    
    if (startDate && endDate) {
      query.where(and(
        gte(botStatistics.date, startDate),
        lte(botStatistics.date, endDate)
      ));
    }
    
    return await query;
  }

  async createBotStatistics(stats) {
    const [created] = await db
      .insert(botStatistics)
      .values(stats)
      .returning();
    return created;
  }

  async getLatestBotStatistics() {
    const [latest] = await db
      .select()
      .from(botStatistics)
      .orderBy(desc(botStatistics.date))
      .limit(1);
    return latest || undefined;
  }

  async logAdminAction(action) {
    const [logged] = await db
      .insert(adminActions)
      .values(action)
      .returning();
    return logged;
  }

  async getAdminActions(limit = 100) {
    return await db
      .select()
      .from(adminActions)
      .orderBy(desc(adminActions.timestamp))
      .limit(limit);
  }

  // Analytics helpers
  async getTotalMemoryUsage() {
    const [result] = await db
      .select({ total: sum(discordUsers.currentMemoryUsage) })
      .from(discordUsers);
    return result?.total || 0;
  }

  async getTotalConversations() {
    const [result] = await db
      .select({ count: count() })
      .from(conversations);
    return result?.count || 0;
  }

  async getActiveUsersCount() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [result] = await db
      .select({ count: count() })
      .from(discordUsers)
      .where(gte(discordUsers.lastActiveAt, oneDayAgo));
    return result?.count || 0;
  }

  async getAverageMemoryPerUser() {
    const [result] = await db
      .select({ avg: avg(discordUsers.currentMemoryUsage) })
      .from(discordUsers);
    return result?.avg || 0;
  }
}

const storage = new DatabaseStorage();

module.exports = { DatabaseStorage, storage };