import {keyboard, getWindows} from '@nut-tree-fork/nut-js';
import {setTimeout} from 'node:timers/promises';
import {toKeys} from '../../xdotoolStringToKeys.js';
import {handleScreenshot} from '../../actions/screenshot.js';
import type {IOClass, CommonParams, ToolResponse} from '../../core/io-class.interface.js';
import type {Tool} from '@modelcontextprotocol/sdk/types.js';
import {getEffectiveWindow, getSelectedWindow} from '../../utils/window-context.js';
import {createErrorResponse, validateWindowId} from '../../utils/error-response.js';
import {validateJailEnforcement} from '../../utils/window-jail.js';

/**
 * Focus a window by ID
 * @param windowId - Window ID (array index from windows_list)
 */
async function focusWindow(windowId: number): Promise<void> {
	const windows = await getWindows();
	validateWindowId(windowId, windows.length);

	const targetWindow = windows[windowId]!;
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
		return 'Keyboard control for pressing keys and typing text on your physical computer';
	}

	/**
	 * Get all tools provided by this IO class
	 */
	getTools(): Tool[] {
		return [
			{
				name: 'keyboard_press',
				description: 'Press a key or key combination on your physical keyboard',
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
				description: 'Type text on your physical keyboard (simulates typing on your actual computer)',
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
		try {
			switch (action) {
				case 'keyboard_press':
					return await this.handleKeyPress(params);

				case 'keyboard_type':
					return await this.handleType(params);

				default:
					throw new Error(`Unknown action: ${action}`);
			}
		} catch (error) {
			return createErrorResponse(error, `KeyboardIO.${action}`);
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

		// Validate window jail enforcement
		await validateJailEnforcement();

		// Get effective window (explicit param or selected window)
		const effectiveWindow = getEffectiveWindow(window);

		// Focus window if specified or selected
		if (effectiveWindow !== undefined) {
			await focusWindow(effectiveWindow);
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

		// Get selected window for response
		const selectedWindowId = getSelectedWindow();

		// Combine text response with screenshot
		const content: {type: 'text' | 'image'; text?: string; data?: string; mimeType?: string}[] = [
			{
				type: 'text',
				text: JSON.stringify({
					action: 'keyboard_press',
					keys,
					selectedWindow: selectedWindowId,
				}),
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

		// Validate window jail enforcement
		await validateJailEnforcement();

		// Get effective window (explicit param or selected window)
		const effectiveWindow = getEffectiveWindow(window);

		// Focus window if specified or selected
		if (effectiveWindow !== undefined) {
			await focusWindow(effectiveWindow);
		}

		// Split text by newlines and type each line
		// nut.js keyboard.type() doesn't handle \n, so we need to press Return explicitly
		const lines = text.split('\n');

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i]!;

			// Type the line (may be empty for blank lines)
			if (line.length > 0) {
				await keyboard.type(line);
			}

			// Press Return after each line except the last
			if (i < lines.length - 1) {
				const returnKey = toKeys('return');
				await keyboard.pressKey(...returnKey);
				await keyboard.releaseKey(...returnKey);
			}
		}

		// Auto-screenshot
		const screenshot = await handleScreenshot();

		// Get selected window for response
		const selectedWindowId = getSelectedWindow();

		// Combine text response with screenshot
		return {
			content: [
				{
					type: 'text' as const,
					text: JSON.stringify({
						action: 'keyboard_type',
						text,
						selectedWindow: selectedWindowId,
					}),
				},
				...(screenshot.content as any[]),
			],
		};
	}
}
