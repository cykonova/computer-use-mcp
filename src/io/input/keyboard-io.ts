import {keyboard, getWindows} from '@nut-tree-fork/nut-js';
import {setTimeout} from 'node:timers/promises';
import {toKeys} from '../../xdotoolStringToKeys.js';
import {handleScreenshot} from '../../actions/screenshot.js';
import type {IOClass, CommonParams, ToolResponse} from '../../core/io-class.interface.js';
import type {Tool} from '@modelcontextprotocol/sdk/types.js';

/**
 * Focus a window by ID
 * @param windowId - Window ID (array index from windows_list)
 */
async function focusWindow(windowId: string | number): Promise<void> {
	const windows = await getWindows();
	const id = typeof windowId === 'string' ? Number.parseInt(windowId, 10) : windowId;

	if (Number.isNaN(id) || id < 0 || id >= windows.length) {
		throw new Error(`Invalid window ID: ${windowId}. Valid range: 0-${windows.length - 1}`);
	}

	const targetWindow = windows[id]!;
	await targetWindow.focus();
}

/**
 * KeyboardIO class implementing the IOClass interface
 * Provides keyboard control capabilities including key press and text typing
 */
export class KeyboardIO implements IOClass {
	get category(): 'input' {
		return 'input';
	}

	get name(): string {
		return 'keyboard';
	}

	get description(): string {
		return 'Keyboard control for pressing keys and typing text';
	}

	/**
	 * Get all tools provided by this IO class
	 */
	getTools(): Tool[] {
		return [
			{
				name: 'keyboard_press',
				description: 'Press a key or key combination on the keyboard',
				inputSchema: {
					type: 'object',
					properties: {
						keys: {
							type: 'string',
							description: 'Key combination to press (e.g., "ctrl+c", "shift+f1")',
						},
						window: {
							oneOf: [
								{type: 'string'},
								{type: 'number'},
							],
							description: 'Optional window ID to target',
						},
						hold: {
							type: 'number',
							description: 'Optional hold duration in milliseconds',
						},
					},
					required: ['keys'],
				},
			},
			{
				name: 'keyboard_type',
				description: 'Type text on the keyboard',
				inputSchema: {
					type: 'object',
					properties: {
						text: {
							type: 'string',
							description: 'Text to type',
						},
						window: {
							oneOf: [
								{type: 'string'},
								{type: 'number'},
							],
							description: 'Optional window ID to target',
						},
					},
					required: ['text'],
				},
			},
		];
	}

	/**
	 * Handle execution of an action
	 * @param action - The action name (e.g., 'keyboard_press', 'keyboard_type')
	 * @param params - Action parameters
	 * @returns Promise resolving to tool response with screenshot
	 */
	async handleAction(action: string, params: Record<string, unknown>): Promise<ToolResponse> {
		switch (action) {
			case 'keyboard_press':
				return this.handleKeyPress(params);

			case 'keyboard_type':
				return this.handleType(params);

			default:
				throw new Error(`Unknown action: ${action}`);
		}
	}

	/**
	 * Handle key press action
	 */
	private async handleKeyPress(params: Record<string, unknown>): Promise<ToolResponse> {
		const {keys, window, hold} = params as {keys: string; window?: string | number; hold?: number} & CommonParams;

		if (!keys || typeof keys !== 'string') {
			throw new Error('Keys parameter is required and must be a string');
		}

		// Focus window if specified
		if (window !== undefined) {
			await focusWindow(window);
		}

		// Convert key string to Key array
		const keyArray = toKeys(keys);

		// Press the keys
		await keyboard.pressKey(...keyArray);

		// If hold duration specified, wait before releasing
		if (hold && typeof hold === 'number') {
			await setTimeout(hold);
		}

		// Release the keys
		await keyboard.releaseKey(...keyArray);

		// Auto-screenshot
		const screenshot = await handleScreenshot();

		// Combine text response with screenshot
		const content: {type: 'text' | 'image'; text?: string; data?: string; mimeType?: string}[] = [
			{
				type: 'text',
				text: `Pressed key: ${keys}`,
			},
		];

		// Add screenshot content
		for (const item of screenshot.content as any) {
			content.push(item);
		}

		return {
			content,
		};
	}

	/**
	 * Handle type action
	 */
	private async handleType(params: Record<string, unknown>): Promise<ToolResponse> {
		const {text, window} = params as {text: string; window?: string | number};

		if (!text || typeof text !== 'string') {
			throw new Error('Text parameter is required and must be a string');
		}

		// Focus window if specified
		if (window !== undefined) {
			await focusWindow(window);
		}

		// Type the text
		await keyboard.type(text);

		// Auto-screenshot
		const screenshot = await handleScreenshot();

		// Combine text response with screenshot
		return {
			content: [
				{
					type: 'text' as const,
					text: `Typed text: ${text}`,
				},
				...(screenshot.content as any[]),
			],
		};
	}
}
