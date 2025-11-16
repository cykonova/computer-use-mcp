/**
 * Window context management for persistent window selection
 * Allows setting a default window that all operations target
 */

let selectedWindowId: number | null = null;

/**
 * Set the currently selected window ID
 * @param windowId - Window ID to select, or null to clear selection
 */
export function setSelectedWindow(windowId: number | null): void {
	selectedWindowId = windowId;
}

/**
 * Get the currently selected window ID
 * @returns Selected window ID or null if none selected
 */
export function getSelectedWindow(): number | null {
	return selectedWindowId;
}

/**
 * Clear the selected window
 */
export function clearSelectedWindow(): void {
	selectedWindowId = null;
}

/**
 * Get the effective window ID to use for an operation
 * Returns explicit window param if provided, otherwise returns selected window
 * @param explicitWindow - Explicitly specified window ID (takes precedence)
 * @returns Window ID to use, or undefined if none
 */
export function getEffectiveWindow(explicitWindow?: string | number): number | undefined {
	if (explicitWindow !== undefined) {
		return typeof explicitWindow === 'string' ? Number.parseInt(explicitWindow, 10) : explicitWindow;
	}

	return selectedWindowId ?? undefined;
}
