import {appendFileSync, mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {homedir} from 'node:os';

/**
 * File-based logger for MCP server
 *
 * Writes logs to a file instead of stdout/stderr to avoid interfering
 * with stdio-based MCP protocol communication.
 *
 * Log location: ~/.mcp/computer-use/server.log
 */
class Logger {
	private readonly logPath: string;
	private readonly initialized: boolean;

	constructor() {
		const logDir = join(homedir(), '.mcp', 'computer-use');
		this.logPath = join(logDir, 'server.log');

		// Create log directory if it doesn't exist
		try {
			mkdirSync(logDir, {recursive: true});
			this.initialized = true;
		} catch {
			// If we can't create the log directory, logging will be disabled
			this.initialized = false;
		}
	}

	private formatMessage(level: string, message: string, ...args: unknown[]): string {
		const timestamp = new Date().toISOString();
		const formattedArgs = args.map((arg) => {
			if (arg instanceof Error) {
				return `${arg.message}\n${arg.stack}`;
			}

			if (typeof arg === 'object') {
				try {
					return JSON.stringify(arg, null, 2);
				} catch {
					return String(arg);
				}
			}

			return String(arg);
		}).join(' ');

		const fullMessage = formattedArgs ? `${message} ${formattedArgs}` : message;
		return `[${timestamp}] [${level}] ${fullMessage}\n`;
	}

	private write(level: string, message: string, ...args: unknown[]): void {
		if (!this.initialized) {
			return;
		}

		try {
			const formatted = this.formatMessage(level, message, ...args);
			appendFileSync(this.logPath, formatted, 'utf8');
		} catch {
			// Silently fail if we can't write to log file
			// We can't use console here as it would break MCP stdio
		}
	}

	info(message: string, ...args: unknown[]): void {
		this.write('INFO', message, ...args);
	}

	error(message: string, ...args: unknown[]): void {
		this.write('ERROR', message, ...args);
	}

	warn(message: string, ...args: unknown[]): void {
		this.write('WARN', message, ...args);
	}

	debug(message: string, ...args: unknown[]): void {
		this.write('DEBUG', message, ...args);
	}

	/**
	 * Get the path to the log file
	 */
	getLogPath(): string {
		return this.logPath;
	}
}

// Export singleton instance
export const logger = new Logger();
