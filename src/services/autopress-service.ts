import {logger} from '../utils/logger.js';
import type {ToolResponse} from '../core/io-class.interface.js';

/**
 * Command interface for autopress sequences
 * Represents a single operation to execute
 */
export interface AutopressCommand {
	/** IO class name (e.g., "gamepad", "keyboard", "mouse") */
	ioClass: string;
	/** Action name (e.g., "button", "press", "click") */
	action: string;
	/** Action parameters */
	params: Record<string, unknown>;
}

/**
 * Autopress configuration
 */
export interface AutopressConfig {
	/** Unique identifier for this autopress */
	id: string;
	/** Sequence of commands to repeat */
	commands: AutopressCommand[];
	/** Interval in milliseconds between sequence repetitions */
	interval: number;
}

/**
 * Active autopress state
 */
interface AutopressState {
	config: AutopressConfig;
	intervalId: NodeJS.Timeout;
	isRunning: boolean;
}

/**
 * Command executor function type
 * Takes an IO class name, action, and params, returns a promise of the result
 */
export type CommandExecutor = (
	ioClass: string,
	action: string,
	params: Record<string, unknown>,
) => Promise<ToolResponse>;

/**
 * Centralized service for managing autopresses (continuous/repeated command execution)
 * Supports executing sequences of commands across different IO classes
 */
export class AutopressService {
	private autopresses: Map<string, AutopressState> = new Map();
	private commandExecutor: CommandExecutor | null = null;

	/**
	 * Set the command executor function
	 * This should be called during server initialization to provide command routing
	 */
	setCommandExecutor(executor: CommandExecutor): void {
		this.commandExecutor = executor;
	}

	/**
	 * Start a new autopress or replace existing one with same ID
	 */
	async start(config: AutopressConfig): Promise<void> {
		// Validate config
		if (!config.id || config.id.trim() === '') {
			throw new Error('Autopress ID is required');
		}

		if (!Array.isArray(config.commands) || config.commands.length === 0) {
			throw new Error('At least one command is required');
		}

		if (!config.interval || config.interval < 10) {
			throw new Error('Interval must be at least 10ms');
		}

		if (!this.commandExecutor) {
			throw new Error('Command executor not set. Server initialization error.');
		}

		// Stop existing autopress with same ID if any
		if (this.autopresses.has(config.id)) {
			await this.stop(config.id);
		}

		// Create autopress state
		const state: AutopressState = {
			config,
			intervalId: setInterval(async () => {
				await this.executeSequence(config.commands);
			}, config.interval),
			isRunning: true,
		};

		this.autopresses.set(config.id, state);
		logger.info(`Autopress started: ${config.id} (${config.commands.length} commands, ${config.interval}ms interval)`);
	}

	/**
	 * Stop a specific autopress by ID
	 */
	async stop(id: string): Promise<boolean> {
		const state = this.autopresses.get(id);
		if (!state) {
			return false; // Not found
		}

		clearInterval(state.intervalId);
		this.autopresses.delete(id);
		logger.info(`Autopress stopped: ${id}`);
		return true;
	}

	/**
	 * Stop all active autopresses
	 */
	async stopAll(): Promise<number> {
		const count = this.autopresses.size;

		for (const [id, state] of this.autopresses.entries()) {
			clearInterval(state.intervalId);
		}

		this.autopresses.clear();
		logger.info(`Stopped all autopresses (${count} total)`);
		return count;
	}

	/**
	 * Get list of active autopress IDs
	 */
	getActiveIds(): string[] {
		return Array.from(this.autopresses.keys());
	}

	/**
	 * Check if an autopress is active
	 */
	isActive(id: string): boolean {
		return this.autopresses.has(id);
	}

	/**
	 * Execute a sequence of commands
	 */
	private async executeSequence(commands: AutopressCommand[]): Promise<void> {
		if (!this.commandExecutor) {
			logger.error('Cannot execute sequence: command executor not set');
			return;
		}

		for (const command of commands) {
			try {
				await this.commandExecutor(command.ioClass, command.action, command.params);
			} catch (error) {
				logger.error(`Autopress command failed: ${command.ioClass}.${command.action}`, error);
				// Continue with next command even if one fails
			}
		}
	}

	/**
	 * Cleanup - stop all autopresses
	 */
	async cleanup(): Promise<void> {
		await this.stopAll();
	}
}

// Singleton instance
export const autopressService = new AutopressService();
