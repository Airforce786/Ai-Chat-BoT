const config = require('../config/settings.json');

class Logger {
    constructor() {
        this.level = config.logging?.level || 'info';
        this.enableConsole = config.logging?.enableConsole !== false;
        this.enableFile = config.logging?.enableFile || false;
        
        this.levels = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3
        };
        
        this.currentLevel = this.levels[this.level] || 1;
    }

    formatMessage(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
        return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
    }

    log(level, message, meta = {}) {
        if (this.levels[level] < this.currentLevel) {
            return;
        }

        const formattedMessage = this.formatMessage(level, message, meta);

        if (this.enableConsole) {
            switch (level) {
                case 'debug':
                    console.debug(formattedMessage);
                    break;
                case 'info':
                    console.info(formattedMessage);
                    break;
                case 'warn':
                    console.warn(formattedMessage);
                    break;
                case 'error':
                    console.error(formattedMessage);
                    break;
                default:
                    console.log(formattedMessage);
            }
        }

        // File logging could be implemented here if needed
        if (this.enableFile) {
            // TODO: Implement file logging if required
        }
    }

    debug(message, meta = {}) {
        this.log('debug', message, meta);
    }

    info(message, meta = {}) {
        this.log('info', message, meta);
    }

    warn(message, meta = {}) {
        this.log('warn', message, meta);
    }

    error(message, meta = {}) {
        this.log('error', message, meta);
    }

    // Convenience methods for common logging scenarios
    apiRequest(service, endpoint, meta = {}) {
        this.debug(`API Request: ${service} ${endpoint}`, meta);
    }

    apiResponse(service, status, meta = {}) {
        this.info(`API Response: ${service} ${status}`, meta);
    }

    userAction(userId, action, meta = {}) {
        this.info(`User Action: ${userId} ${action}`, meta);
    }

    rateLimitHit(service, userId, meta = {}) {
        this.warn(`Rate Limit: ${service} user:${userId}`, meta);
    }

    serviceError(service, error, meta = {}) {
        this.error(`Service Error: ${service}`, { 
            error: error.message, 
            stack: error.stack,
            ...meta 
        });
    }

    setLevel(level) {
        if (this.levels.hasOwnProperty(level)) {
            this.level = level;
            this.currentLevel = this.levels[level];
            this.info(`Logger level changed to: ${level}`);
        } else {
            this.warn(`Invalid log level: ${level}`);
        }
    }

    getStats() {
        return {
            level: this.level,
            enableConsole: this.enableConsole,
            enableFile: this.enableFile,
            availableLevels: Object.keys(this.levels)
        };
    }
}

module.exports = Logger;
