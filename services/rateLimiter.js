const Logger = require('../utils/logger');
const config = require('../config/settings.json');

class RateLimiter {
    constructor() {
        this.userLimits = new Map();
        this.groqRequests = 0;
        this.groqResetTime = this.getNextResetTime();
        this.logger = new Logger();
        
        // Reset daily limits at midnight
        this.scheduleGroqReset();
        
        // Cleanup old user limits every hour
        setInterval(() => this.cleanupUserLimits(), 3600000);
    }

    checkUserLimit(userId) {
        const now = Date.now();
        const userLimit = this.userLimits.get(userId);
        
        if (!userLimit) {
            this.userLimits.set(userId, {
                count: 1,
                resetTime: now + config.rateLimits.userMessages.windowMs,
                firstRequest: now
            });
            return true;
        }

        // Reset if window has passed
        if (now > userLimit.resetTime) {
            userLimit.count = 1;
            userLimit.resetTime = now + config.rateLimits.userMessages.windowMs;
            userLimit.firstRequest = now;
            return true;
        }

        // Check if under limit
        if (userLimit.count < config.rateLimits.userMessages.max) {
            userLimit.count++;
            return true;
        }

        // Rate limited
        this.logger.warn(`User ${userId} rate limited`, {
            count: userLimit.count,
            timeRemaining: Math.ceil((userLimit.resetTime - now) / 1000)
        });
        
        return false;
    }

    checkGroqLimit() {
        const now = Date.now();
        
        // Reset if new day
        if (now > this.groqResetTime) {
            this.groqRequests = 0;
            this.groqResetTime = this.getNextResetTime();
            this.logger.info('Groq daily limit reset');
        }

        const hasCapacity = this.groqRequests < config.rateLimits.groqDaily;
        
        if (!hasCapacity) {
            this.logger.warn('Groq daily limit reached', {
                requests: this.groqRequests,
                limit: config.rateLimits.groqDaily,
                resetTime: new Date(this.groqResetTime).toISOString()
            });
        }
        
        return hasCapacity;
    }

    incrementGroq() {
        this.groqRequests++;
        
        if (this.groqRequests % 100 === 0) {
            this.logger.info(`Groq requests: ${this.groqRequests}/${config.rateLimits.groqDaily}`);
        }
    }

    getNextResetTime() {
        // Reset at midnight UTC
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        tomorrow.setUTCHours(0, 0, 0, 0);
        return tomorrow.getTime();
    }

    scheduleGroqReset() {
        const now = Date.now();
        const timeUntilReset = this.groqResetTime - now;
        
        setTimeout(() => {
            this.groqRequests = 0;
            this.groqResetTime = this.getNextResetTime();
            this.logger.info('Groq daily limit reset');
            
            // Schedule next reset
            this.scheduleGroqReset();
        }, timeUntilReset);
        
        this.logger.info(`Groq reset scheduled for ${new Date(this.groqResetTime).toISOString()}`);
    }

    cleanupUserLimits() {
        const now = Date.now();
        let cleanedCount = 0;
        
        for (const [userId, limit] of this.userLimits) {
            // Remove limits older than 24 hours
            if (now - limit.firstRequest > 86400000) {
                this.userLimits.delete(userId);
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0) {
            this.logger.debug(`Cleaned up ${cleanedCount} old user rate limits`);
        }
    }

    getUserLimitInfo(userId) {
        const userLimit = this.userLimits.get(userId);
        const now = Date.now();
        
        if (!userLimit || now > userLimit.resetTime) {
            return {
                requests: 0,
                limit: config.rateLimits.userMessages.max,
                resetTime: null,
                timeUntilReset: 0
            };
        }
        
        return {
            requests: userLimit.count,
            limit: config.rateLimits.userMessages.max,
            resetTime: userLimit.resetTime,
            timeUntilReset: Math.max(0, userLimit.resetTime - now)
        };
    }

    getGroqLimitInfo() {
        const now = Date.now();
        
        return {
            requests: this.groqRequests,
            limit: config.rateLimits.groqDaily,
            resetTime: this.groqResetTime,
            timeUntilReset: Math.max(0, this.groqResetTime - now),
            percentage: Math.round((this.groqRequests / config.rateLimits.groqDaily) * 100)
        };
    }

    getAllStats() {
        return {
            groq: this.getGroqLimitInfo(),
            activeUserLimits: this.userLimits.size,
            totalUserRequests: Array.from(this.userLimits.values()).reduce((sum, limit) => sum + limit.count, 0)
        };
    }

    // Admin functions
    resetUserLimit(userId) {
        const hadLimit = this.userLimits.has(userId);
        this.userLimits.delete(userId);
        return hadLimit;
    }

    resetGroqLimit() {
        const oldCount = this.groqRequests;
        this.groqRequests = 0;
        this.logger.info(`Admin reset Groq limit from ${oldCount} to 0`);
        return oldCount;
    }

    resetAllLimits() {
        const userCount = this.userLimits.size;
        const groqCount = this.groqRequests;
        
        this.userLimits.clear();
        this.groqRequests = 0;
        
        this.logger.info(`Admin reset all limits: ${userCount} users, ${groqCount} Groq requests`);
        
        return { userCount, groqCount };
    }
}

module.exports = RateLimiter;
