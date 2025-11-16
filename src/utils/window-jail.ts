import {logger} from './logger.js';

/**
 * Window Jail Configuration
 * Controls whether MCP operations are restricted to a specific window
 */
interface WindowJailConfig {
	enabled: boolean;
	windowTitle: string | undefined;
	enforce: boolean;
}

/**
 * Window Jail Manager
 * Manages window jailing state and enforcement
 */
class WindowJailManager {
	private config: WindowJailConfig;
	private jailedWindowTitle: string | null = null;

	constructor() {
		// Load config from environment variables
		const jailTitle = process.env.JAIL_WINDOW_TITLE;
		const jailEnforce = process.env.JAIL_ENFORCE !== 'false'; // Default to true if title is set

		this.config = {
			enabled: Boolean(jailTitle),
			windowTitle: jailTitle,
			enforce: jailTitle ? jailEnforce : false,
		};

		if (this.config.enabled) {
			logger.info(`Window jail enabled: "${this.config.windowTitle}" (enforce: ${this.config.enforce})`);
		}
	}

	/**
	 * Check if window jail is enabled
	 */
	isEnabled(): boolean {
		return this.config.enabled;
	}

	/**
	 * Check if enforcement is enabled
	 */
	isEnforced(): boolean {
		return this.config.enforce;
	}

	/**
	 * Get the configured window title to jail
	 */
	getTargetWindowTitle(): string | undefined {
		return this.config.windowTitle;
	}

	/**
	 * Set the jailed window title (called after successful selection)
	 */
	setJailedWindow(title: string): void {
		this.jailedWindowTitle = title;
		logger.info(`Window jail activated: "${title}"`);
	}

	/**
	 * Clear the jailed window
	 */
	clearJailedWindow(): void {
		this.jailedWindowTitle = null;
		logger.info('Window jail cleared');
	}

	/**
	 * Get the currently jailed window title
	 */
	getJailedWindowTitle(): string | null {
		return this.jailedWindowTitle;
	}

	/**
	 * Check if operations should be blocked when window not found
	 * Returns error message if blocked, null if allowed
	 */
	checkEnforcement(currentWindowContext: {selectedWindow: number | null; windowExists: boolean}): string | null {
		if (!this.config.enabled || !this.config.enforce) {
			return null; // Not enforcing
		}

		if (!currentWindowContext.selectedWindow) {
			return `Window jail is active but no window is selected. Please ensure "${this.config.windowTitle}" is running and visible.`;
		}

		if (!currentWindowContext.windowExists) {
			return `Window jail is active but the jailed window "${this.jailedWindowTitle}" is no longer available. Please restart "${this.config.windowTitle}".`;
		}

		return null; // All good
	}
}

// Singleton instance
export const windowJail = new WindowJailManager();

/**
 * Validate that an operation is allowed under window jail rules
 * Throws an error if operation should be blocked
 *
 * Note: We only check if a window is selected, not if it still exists,
 * to avoid expensive getWindows() calls on every operation which can hang on Windows
 */
export async function validateJailEnforcement(): Promise<void> {
	if (!windowJail.isEnabled() || !windowJail.isEnforced()) {
		return; // Not enforcing, allow operation
	}

	// Import dynamically to avoid circular dependencies
	const {getSelectedWindow} = await import('./window-context.js');

	const selectedWindowId = getSelectedWindow();

	// Check if a window is selected
	if (selectedWindowId === null) {
		const targetTitle = windowJail.getTargetWindowTitle();
		throw new Error(
			`Window jail is active but no window is selected. ` +
			`The application "${targetTitle}" must be running and visible. ` +
			`Please start "${targetTitle}" and try again.`,
		);
	}

	// Note: We don't validate if the window still exists here to avoid performance issues
	// The window operations themselves will fail with appropriate errors if window is gone
}

/**
 * Auto-select window based on jail configuration
 * Called on server startup to find and select the jailed window
 */
export async function autoSelectJailedWindow(): Promise<void> {
	if (!windowJail.isEnabled()) {
		return; // Jail not enabled
	}

	const targetTitle = windowJail.getTargetWindowTitle();
	if (!targetTitle) {
		return;
	}

	try {
		// Import dynamically to avoid circular dependencies
		const {getWindows} = await import('@nut-tree-fork/nut-js');
		const {setSelectedWindow} = await import('./window-context.js');

		const windows = await getWindows();
		let matchedWindowId: number | null = null;
		let matchedTitle: string | null = null;

		// Find window by title (contains match)
		for (let i = 0; i < windows.length; i++) {
			const win = windows[i];
			if (!win) continue;

			const title = await win.title;

			if (title.includes(targetTitle)) {
				matchedWindowId = i;
				matchedTitle = title;
				break; // Use first match
			}
		}

		if (matchedWindowId !== null && matchedTitle) {
			setSelectedWindow(matchedWindowId);
			windowJail.setJailedWindow(matchedTitle);
			logger.info(`Auto-selected window: "${matchedTitle}" (ID: ${matchedWindowId})`);
		} else {
			logger.warn(`Window jail target "${targetTitle}" not found. ${windows.length} windows checked.`);
			if (windowJail.isEnforced()) {
				logger.error(`Window jail enforcement is ACTIVE but target window not found. All operations will be blocked until "${targetTitle}" is running.`);
			}
		}
	} catch (error) {
		logger.error('Failed to auto-select jailed window:', error);
	}
}
