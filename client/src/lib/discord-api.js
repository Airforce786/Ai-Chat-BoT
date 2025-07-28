/**
 * Discord API integration helpers for the bot management dashboard
 */

// Discord API Base URL
const DISCORD_API_BASE = "https://discord.com/api/v10";

/**
 * Discord color constants matching the brand colors
 */
export const DISCORD_COLORS = {
  BLURPLE: "#5865F2",
  GREEN: "#57F287",
  YELLOW: "#FEE75C",
  FUCHSIA: "#EB459E",
  RED: "#ED4245",
  WHITE: "#FFFFFF",
  BLACK: "#000000",
  DARK_GREY: "#2C2F33",
  LIGHT_GREY: "#99AAB5",
};

/**
 * Format Discord user data for display
 */
export function formatDiscordUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name || user.global_name || user.username,
    avatar: user.avatar 
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${user.avatar.startsWith('a_') ? 'gif' : 'png'}`
      : `https://cdn.discordapp.com/embed/avatars/${parseInt(user.discriminator) % 5}.png`,
    bot: user.bot || false,
    system: user.system || false
  };
}

/**
 * Format Discord guild/server data
 */
export function formatDiscordGuild(guild) {
  return {
    id: guild.id,
    name: guild.name,
    icon: guild.icon 
      ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${guild.icon.startsWith('a_') ? 'gif' : 'png'}`
      : null,
    memberCount: guild.approximate_member_count || guild.member_count,
    description: guild.description,
    features: guild.features || []
  };
}

/**
 * Format Discord channel data
 */
export function formatDiscordChannel(channel) {
  const channelTypes = {
    0: "Text",
    1: "DM", 
    2: "Voice",
    3: "Group DM",
    4: "Category",
    5: "News",
    10: "News Thread",
    11: "Public Thread",
    12: "Private Thread",
    13: "Stage Voice",
    14: "Directory",
    15: "Forum"
  };

  return {
    id: channel.id,
    name: channel.name,
    type: channelTypes[channel.type] || "Unknown",
    position: channel.position,
    parentId: channel.parent_id,
    topic: channel.topic,
    nsfw: channel.nsfw || false
  };
}

/**
 * Generate Discord embed structure for bot responses
 */
export function createDiscordEmbed({
  title,
  description,
  color = DISCORD_COLORS.BLURPLE,
  fields = [],
  footer = null,
  thumbnail = null,
  image = null,
  timestamp = null
}) {
  const embed = {
    title,
    description,
    color: parseInt(color.replace('#', ''), 16),
    fields: fields.map(field => ({
      name: field.name,
      value: field.value,
      inline: field.inline || false
    }))
  };

  if (footer) {
    embed.footer = {
      text: footer.text,
      icon_url: footer.iconUrl
    };
  }

  if (thumbnail) {
    embed.thumbnail = { url: thumbnail };
  }

  if (image) {
    embed.image = { url: image };
  }

  if (timestamp) {
    embed.timestamp = timestamp;
  }

  return embed;
}

/**
 * Create memory status embed for Discord
 */
export function createMemoryStatusEmbed(memoryStats) {
  return createDiscordEmbed({
    title: "🧠 Memory System Status",
    color: DISCORD_COLORS.BLURPLE,
    fields: [
      {
        name: "Total Memory Usage",
        value: `${(memoryStats.totalMemoryUsage / 1024 / 1024).toFixed(2)} MB`,
        inline: true
      },
      {
        name: "Active Conversations",
        value: memoryStats.conversationCount.toString(),
        inline: true
      },
      {
        name: "Memory Chunks",
        value: memoryStats.chunksCount.toString(),
        inline: true
      },
      {
        name: "Active Users",
        value: memoryStats.activeUsers.toString(),
        inline: true
      },
      {
        name: "Avg Memory/User",
        value: `${(memoryStats.averageMemoryPerUser / 1024).toFixed(2)} MB`,
        inline: true
      },
      {
        name: "Compression Ratio",
        value: `${(memoryStats.compressionRatio * 100).toFixed(1)}%`,
        inline: true
      }
    ],
    footer: {
      text: "Memory system is operating normally",
      iconUrl: null
    },
    timestamp: new Date().toISOString()
  });
}

/**
 * Create user profile embed for Discord
 */
export function createUserProfileEmbed(user, conversations = []) {
  const memoryUsagePercent = ((user.currentMemoryUsage / user.memoryQuota) * 100).toFixed(1);
  const memoryUsageMB = (user.currentMemoryUsage / 1024).toFixed(2);
  const quotaMB = (user.memoryQuota / 1024).toFixed(2);
  
  let color = DISCORD_COLORS.GREEN;
  if (memoryUsagePercent > 90) color = DISCORD_COLORS.RED;
  else if (memoryUsagePercent > 75) color = DISCORD_COLORS.YELLOW;

  return createDiscordEmbed({
    title: `👤 User Profile: ${user.username}`,
    color,
    fields: [
      {
        name: "Memory Usage",
        value: `${memoryUsageMB} MB / ${quotaMB} MB (${memoryUsagePercent}%)`,
        inline: false
      },
      {
        name: "Conversations",
        value: user.conversationCount.toString(),
        inline: true
      },
      {
        name: "Last Active",
        value: new Date(user.lastActiveAt).toLocaleString(),
        inline: true
      },
      {
        name: "Account Created",
        value: new Date(user.createdAt).toLocaleString(),
        inline: true
      }
    ],
    footer: {
      text: `User ID: ${user.id}`,
      iconUrl: null
    },
    timestamp: new Date().toISOString()
  });
}

/**
 * Create conversation summary embed for Discord
 */
export function createConversationEmbed(conversation, messages = []) {
  const memoryUsageMB = (conversation.memoryUsage / 1024).toFixed(2);
  const lastMessageDate = new Date(conversation.lastMessageAt).toLocaleString();
  
  return createDiscordEmbed({
    title: `💬 ${conversation.title || "Conversation"}`,
    description: conversation.summary || "No summary available",
    color: conversation.isActive ? DISCORD_COLORS.GREEN : DISCORD_COLORS.LIGHT_GREY,
    fields: [
      {
        name: "Messages",
        value: conversation.messageCount.toString(),
        inline: true
      },
      {
        name: "Memory Usage",
        value: `${memoryUsageMB} MB`,
        inline: true
      },
      {
        name: "Status",
        value: conversation.isActive ? "Active" : "Archived",
        inline: true
      },
      {
        name: "Last Message",
        value: lastMessageDate,
        inline: false
      }
    ],
    footer: {
      text: `Conversation ID: ${conversation.id}`,
      iconUrl: null
    },
    timestamp: new Date(conversation.createdAt).toISOString()
  });
}

/**
 * Create system health embed for Discord
 */
export function createSystemHealthEmbed(healthData) {
  const overallHealthy = healthData.database.status === "healthy" && 
                        healthData.memorySystem.status === "healthy" &&
                        healthData.aiServices.status === "healthy";
  
  const color = overallHealthy ? DISCORD_COLORS.GREEN : DISCORD_COLORS.RED;
  const statusIcon = overallHealthy ? "✅" : "❌";
  
  return createDiscordEmbed({
    title: `${statusIcon} System Health Check`,
    color,
    fields: [
      {
        name: "Database",
        value: `${healthData.database.status === "healthy" ? "✅" : "❌"} ${healthData.database.status}`,
        inline: true
      },
      {
        name: "Memory System", 
        value: `${healthData.memorySystem.status === "healthy" ? "✅" : "❌"} ${healthData.memorySystem.status}`,
        inline: true
      },
      {
        name: "AI Services",
        value: `${healthData.aiServices.status === "healthy" ? "✅" : "❌"} ${healthData.aiServices.status}`,
        inline: true
      },
      {
        name: "Uptime",
        value: `${Math.floor(healthData.uptime / 3600)}h ${Math.floor((healthData.uptime % 3600) / 60)}m`,
        inline: true
      },
      {
        name: "Version",
        value: healthData.version || "1.0.0",
        inline: true
      },
      {
        name: "Memory Usage",
        value: healthData.memorySystem.totalUsage || "0 MB",
        inline: true
      }
    ],
    footer: {
      text: "System health checked automatically every 30 seconds",
      iconUrl: null
    },
    timestamp: new Date().toISOString()
  });
}

/**
 * Format file size in human readable format
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Format duration from seconds to human readable format
 */
export function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

/**
 * Validate Discord snowflake ID
 */
export function isValidDiscordId(id) {
  return /^\d{17,19}$/.test(id);
}

/**
 * Generate Discord timestamp formats
 */
export function createDiscordTimestamp(date, format = "f") {
  const timestamp = Math.floor(date.getTime() / 1000);
  return `<t:${timestamp}:${format}>`;
}

// Discord timestamp formats:
// t: Short Time (16:20)
// T: Long Time (16:20:30)
// d: Short Date (20/04/2021)
// D: Long Date (20 April 2021)
// f: Short Date/Time (20 April 2021 16:20)
// F: Long Date/Time (Tuesday, 20 April 2021 16:20)
// R: Relative Time (2 months ago)

export const DISCORD_TIMESTAMP_FORMATS = {
  SHORT_TIME: "t",
  LONG_TIME: "T", 
  SHORT_DATE: "d",
  LONG_DATE: "D",
  SHORT_DATETIME: "f",
  LONG_DATETIME: "F",
  RELATIVE: "R"
};