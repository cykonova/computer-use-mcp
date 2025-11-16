import type {Tool} from '@modelcontextprotocol/sdk/types.js';

/**
 * Response format for tool execution
 */
export type ToolResponse = {
	content: {
		type: 'text' | 'image';
		text?: string;
		data?: string;
		mimeType?: string;
	}[];
	/** Flag indicating this is an error response */
	isError?: boolean;
};

/**
 * Common parameters supported by all input commands
 */
export type CommonParams = {
	/** Window ID to target (optional, omit for desktop/focused window) */
	window?: string | number;
	/** Hold duration in milliseconds (for keyboard/gamepad) */
	hold?: number;
};

/**
 * Base interface for all IO classes
 */
export type IOClass = {
	/** Category: input, vision, or system */
	readonly category: 'input' | 'vision' | 'system';

	/** IO class name (e.g., 'keyboard', 'mouse') */
	readonly name: string;

	/** Description of the IO class capabilities */
	readonly description: string;

	/**
	 * Get all tools provided by this IO class
	 * Each tool represents an action the IO class can perform
	 */
	getTools(): Tool[];

	/**
	 * Handle execution of an action
	 * @param action - The action name (e.g., 'keyboard_press')
	 * @param params - Action parameters
	 * @returns Promise resolving to tool response
	 */
	handleAction(action: string, params: Record<string, unknown>): Promise<ToolResponse>;
};

/**
 * Type guard to check if an object is an IOClass
 */
export function isIOClass(obj: unknown): obj is IOClass {
	return (
		typeof obj === 'object'
		&& obj !== null
		&& 'category' in obj
		&& 'name' in obj
		&& 'description' in obj
		&& typeof (obj as IOClass).getTools === 'function'
		&& typeof (obj as IOClass).handleAction === 'function'
	);
}
