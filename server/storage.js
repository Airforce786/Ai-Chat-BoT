const { userPrompts } = require("../shared/schema");
const { db } = require("./db");
const { eq } = require("drizzle-orm");

class DatabasePromptStorage {
  async getUserPrompt(userId) {
    const [userPrompt] = await db.select().from(userPrompts).where(eq(userPrompts.userId, userId));
    return userPrompt || undefined;
  }

  async setUserPrompt(userId, prompt) {
    // Try to update existing prompt first
    const existing = await this.getUserPrompt(userId);
    
    if (existing) {
      const [updated] = await db
        .update(userPrompts)
        .set({ 
          customPrompt: prompt, 
          updatedAt: new Date() 
        })
        .where(eq(userPrompts.userId, userId))
        .returning();
      return updated;
    } else {
      // Create new prompt
      const [created] = await db
        .insert(userPrompts)
        .values({ 
          userId, 
          customPrompt: prompt 
        })
        .returning();
      return created;
    }
  }

  async deleteUserPrompt(userId) {
    const result = await db
      .delete(userPrompts)
      .where(eq(userPrompts.userId, userId));
    return result.rowCount > 0;
  }
}

const promptStorage = new DatabasePromptStorage();

module.exports = {
  DatabasePromptStorage,
  promptStorage
};