# Discord AI Chatbot

A production-ready Discord bot that uses Groq's ultra-fast LLaMA 3.1 API as the primary model with Hugging Face as a fallback system. Features persistent custom prompts, slash commands, and comprehensive monitoring.

## Features

- **🤖 AI Integration**: Primary Groq API (1,000 free requests/day) with Hugging Face fallback
- **⚡ Ultra-Fast Responses**: Sub-millisecond latency with Groq's LPU inference
- **💬 Slash Commands**: `/chat` for AI interaction and `/configure` for custom prompts
- **🎯 Custom Prompts**: Persistent user-specific system prompts stored in database
- **💾 Database Integration**: PostgreSQL with Drizzle ORM for prompt storage
- **🛡️ Rate Limiting**: User and API rate limiting with automatic fallback
- **📊 Real-time Monitoring**: Web dashboard with statistics and health checks
- **🔧 Admin Commands**: Full administrative control with slash commands
- **📝 Comprehensive Logging**: Detailed logging with configurable levels
- **🔄 Automatic Failover**: Seamless switching between AI providers
- **🚀 Railway Deployment**: Ready for deployment with Railway.app

## Quick Start

### Prerequisites

- Node.js 16+ installed
- Discord Bot Token
- Groq API Key (free at https://console.groq.com)
- Hugging Face API Key (free at https://huggingface.co)
- PostgreSQL database (auto-provisioned on Railway)

## Available Commands

### User Commands
- `/chat <message>` - Chat with the AI using your custom prompt (if set)
- `/configure [prompt]` - Set a custom system prompt for all future interactions
- `/configure` (no prompt) - Reset to default system prompt
- `/status` - View bot statistics and current status
- `/model` - Get information about the current AI model
- `/reset` - Reset your conversation context

### Admin Commands
- `/admin stats` - Detailed bot statistics and active users
- `/admin reset-limits` - Reset rate limits (groq/users/conversations/all)
- `/admin force-model` - Force switch AI model (groq/huggingface/auto)

## Environment Variables

```env
# Required
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_application_id
GROQ_API_KEY=your_groq_api_key
HUGGINGFACE_API_KEY=your_huggingface_api_key
DATABASE_URL=your_postgresql_connection_string

# Optional
ADMIN_USERS=user_id_1,user_id_2
```

## Deployment

### Railway.app Deployment

This bot is designed for easy deployment on Railway.app with PostgreSQL database:

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Discord AI Chatbot"
   git push origin main
   ```

2. **Deploy to Railway**
   - Connect your GitHub repository to Railway
   - Add PostgreSQL service to your project
   - Set environment variables in Railway dashboard
   - Railway automatically deploys with health checks

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

### Local Development

```bash
# Install dependencies
npm install

# Set up environment variables in .env file
# Add PostgreSQL database URL

# Run database migration
npx drizzle-kit push

# Start the bot
node index.js
```

## Project Structure

```
├── commands/          # Slash command handlers
├── config/           # Configuration files
├── server/           # Database and storage layer
├── services/         # AI services and core logic
├── shared/           # Database schema
├── utils/            # Logging and utilities
├── index.js          # Main bot entry point
├── server.js         # Monitoring web server
└── DEPLOYMENT.md     # Deployment guide
```

## API Usage & Costs

- **Groq**: 1,000 free requests/day (ultra-fast LLaMA 3.1)
- **Hugging Face**: Free tier with generous limits
- **Railway**: Free tier available, scales automatically
- **PostgreSQL**: Included with Railway deployment

## Architecture

The bot uses a service-oriented architecture:
- **Primary AI**: Groq for ultra-fast responses
- **Fallback AI**: Hugging Face for reliability
- **Database**: PostgreSQL with Drizzle ORM
- **Monitoring**: Express server with real-time dashboard
- **Rate Limiting**: User and API quota management
- **Custom Prompts**: Persistent per-user system prompts
