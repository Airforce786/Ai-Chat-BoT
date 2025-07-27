const { defineConfig } = require("drizzle-kit");

module.exports = defineConfig({
  schema: "./shared/schema.js",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});