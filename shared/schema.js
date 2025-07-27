const { pgTable, text, timestamp, serial } = require('drizzle-orm/pg-core');

const userPrompts = pgTable('user_prompts', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().unique(),
  customPrompt: text('custom_prompt').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

module.exports = {
  userPrompts
};