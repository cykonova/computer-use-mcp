import type {ToolResponse} from '../core/io-class.interface.js';

/**
 * Create a structured error response for MCP tools
 * Returns a ToolResponse with error information in JSON format
 * @param error - The error object or message
 * @param context - Additional context about where the error occurred
 * @returns ToolResponse with error details
 */
export function createErrorResponse(error: unknown, context?: string): ToolResponse {
	const errorMessage = error instanceof Error ? error.message : String(error);
	const errorName = error instanceof Error ? error.name : 'Error';
	const errorStack = error instanceof Error ? error.stack : undefined;

	return {
		content: [
			{
				type: 'text',
				text: JSON.stringify(
					{
						success: false,
						error: {
							name: errorName,
							message: errorMessage,
							context,
							stack: errorStack,
						},
					},
					null,
					2,
				),
			},
		],
		isError: true,
	};
}

/**
 * Validate window ID and throw descriptive error if invalid
 * @param windowId - The window ID to validate
 * @param maxWindowId - Maximum valid window ID (exclusive)
 * @throws Error with descriptive message if invalid
 */
export function validateWindowId(windowId: number, maxWindowId: number): void {
	if (Number.isNaN(windowId)) {
		throw new Error(`Invalid window ID: not a number. Window ID must be an integer between 0 and ${maxWindowId - 1}`);
	}

	if (windowId < 0) {
		throw new Error(`Invalid window ID: ${windowId}. Window ID cannot be negative. Valid range: 0-${maxWindowId - 1}`);
	}

	if (windowId >= maxWindowId) {
		throw new Error(
			`Invalid window ID: ${windowId}. Window ID exceeds available windows (${maxWindowId} windows found). Valid range: 0-${maxWindowId - 1}`,
		);
	}
}
