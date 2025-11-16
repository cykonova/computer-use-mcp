import type {IOClass, ToolResponse} from '../../core/io-class.interface.js';
import type {Tool} from '@modelcontextprotocol/sdk/types.js';
import {getWindows, getActiveWindow, Window, Region} from '@nut-tree-fork/nut-js';
import {setSelectedWindow, getSelectedWindow} from '../../utils/window-context.js';
import {createErrorResponse, validateWindowId} from '../../utils/error-response.js';

/**
 * WindowsIO provides window management capabilities
 * Allows listing, focusing, positioning, and querying window information
 */
export class WindowsIO implements IOClass {
	get category() {
		return 'system' as const;
	}

	get name() {
		return 'windows' as const;
	}

	get description() {
		return 'Window management for your physical desktop - list, focus, and manipulate application windows';
	}

	getTools(): Tool[] {
		return [
			{
				name: 'windows_list',
				description: 'List all open windows on your physical desktop with their IDs, titles, and positions',
				inputSchema: {
					type: 'object',
					properties: {},
				},
			},
			{
				name: 'windows_select',
				description: 'Select a window to use as the default target for all subsequent operations (keyboard, mouse, screenshot). Pass null to clear selection.',
				inputSchema: {
					type: 'object',
					properties: {
						windowId: {
							oneOf: [
								{type: 'number'},
								{type: 'null'},
							],
							description: 'Window ID from windows_list (the array index), or null to clear selection',
						},
					},
					required: ['windowId'],
				},
			},
			{
				name: 'windows_focus',
				description: 'Focus (activate) a specific window on your physical desktop to bring it to the foreground',
				inputSchema: {
					type: 'object',
					properties: {
						windowId: {
							type: 'number',
							description: 'Window ID from windows_list (the array index)',
						},
					},
					required: ['windowId'],
				},
			},
			{
				name: 'windows_position',
				description: 'Get or set window position and size',
				inputSchema: {
					type: 'object',
					properties: {
						windowId: {
							type: 'number',
							description: 'Window ID from windows_list (the array index)',
						},
						x: {
							type: 'number',
							description: 'New x position (optional, for setting position)',
						},
						y: {
							type: 'number',
							description: 'New y position (optional, for setting position)',
						},
						width: {
							type: 'number',
							description: 'New width (optional, for setting size)',
						},
						height: {
							type: 'number',
							description: 'New height (optional, for setting size)',
						},
					},
					required: ['windowId'],
				},
			},
			{
				name: 'windows_info',
				description: 'Get detailed information about a specific window',
				inputSchema: {
					type: 'object',
					properties: {
						windowId: {
							type: 'number',
							description: 'Window ID from windows_list (the array index)',
						},
					},
					required: ['windowId'],
				},
			},
		];
	}

	async handleAction(action: string, params: Record<string, unknown>): Promise<ToolResponse> {
		try {
			switch (action) {
				case 'windows_list':
					return await this.handleList();
				case 'windows_select':
					return await this.handleSelect(params.windowId as number | null);
				case 'windows_focus':
					return await this.handleFocus(params.windowId as number);
				case 'windows_position':
					return await this.handlePosition(
						params.windowId as number,
						params.x as number | undefined,
						params.y as number | undefined,
						params.width as number | undefined,
						params.height as number | undefined,
					);
				case 'windows_info':
					return await this.handleInfo(params.windowId as number);
				default:
					throw new Error(`Unknown action: ${action}`);
			}
		} catch (error) {
			return createErrorResponse(error, `WindowsIO.${action}`);
		}
	}

	private async handleList(): Promise<ToolResponse> {
		const windows = await getWindows();
		const selectedWindowId = getSelectedWindow();
		const windowList = await Promise.all(
			windows.map(async (win, index) => {
				try {
					const [title, region] = await Promise.all([
						win.title,
						win.region,
					]);
					return {
						id: index,
						title,
						x: region.left,
						y: region.top,
						width: region.width,
						height: region.height,
					};
				} catch (error) {
					// Some windows might not be accessible
					return {
						id: index,
						title: '<inaccessible>',
						error: error instanceof Error ? error.message : 'Unknown error',
					};
				}
			}),
		);

		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify({
						count: windowList.length,
						windows: windowList,
						selectedWindow: selectedWindowId,
					}, null, 2),
				},
			],
		};
	}

	private async handleSelect(windowId: number | null): Promise<ToolResponse> {
		if (windowId === null) {
			setSelectedWindow(null);
			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify({
							success: true,
							selectedWindow: null,
							message: 'Cleared window selection',
						}),
					},
				],
			};
		}

		const windows = await getWindows();
		validateWindowId(windowId, windows.length);

		const targetWindow = windows[windowId]!;
		const title = await targetWindow.title;

		setSelectedWindow(windowId);

		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify({
						success: true,
						selectedWindow: windowId,
						title,
						message: `Selected window: ${title}`,
					}),
				},
			],
		};
	}

	private async handleFocus(windowId: number): Promise<ToolResponse> {
		const windows = await getWindows();
		validateWindowId(windowId, windows.length);

		const targetWindow = windows[windowId]!;
		await targetWindow.focus();

		const title = await targetWindow.title;
		const selectedWindowId = getSelectedWindow();
		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify({
						success: true,
						windowId,
						title,
						message: `Focused window: ${title}`,
						selectedWindow: selectedWindowId,
					}),
				},
			],
		};
	}

	private async handlePosition(
		windowId: number,
		x?: number,
		y?: number,
		width?: number,
		height?: number,
	): Promise<ToolResponse> {
		const windows = await getWindows();
		validateWindowId(windowId, windows.length);

		const targetWindow = windows[windowId]!;
		const currentRegion = await targetWindow.region;
		const selectedWindowId = getSelectedWindow();

		// If no position/size params provided, just return current position
		if (x === undefined && y === undefined && width === undefined && height === undefined) {
			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify({
							windowId,
							x: currentRegion.left,
							y: currentRegion.top,
							width: currentRegion.width,
							height: currentRegion.height,
							selectedWindow: selectedWindowId,
						}),
					},
				],
			};
		}

		// Move window if x/y provided
		if (x !== undefined || y !== undefined) {
			await targetWindow.move({
				x: x ?? currentRegion.left,
				y: y ?? currentRegion.top,
			});
		}

		// Resize window if width/height provided
		if (width !== undefined || height !== undefined) {
			const newWidth = width ?? currentRegion.width;
			const newHeight = height ?? currentRegion.height;
			// Use the Region constructor to create a proper Size object
			const newRegion = new Region(
				currentRegion.left,
				currentRegion.top,
				newWidth,
				newHeight,
			);
			await targetWindow.resize(newRegion);
		}

		// Get updated region
		const updatedRegion = await targetWindow.region;
		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify({
						success: true,
						windowId,
						x: updatedRegion.left,
						y: updatedRegion.top,
						width: updatedRegion.width,
						height: updatedRegion.height,
						selectedWindow: selectedWindowId,
					}),
				},
			],
		};
	}

	private async handleInfo(windowId: number): Promise<ToolResponse> {
		const windows = await getWindows();
		validateWindowId(windowId, windows.length);

		const targetWindow = windows[windowId]!;
		const [title, region] = await Promise.all([
			targetWindow.title,
			targetWindow.region,
		]);

		// Check if it's the active window
		const activeWindow = await getActiveWindow();
		const activeTitle = await activeWindow.title;
		const isActive = title === activeTitle;
		const selectedWindowId = getSelectedWindow();

		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify({
						windowId,
						title,
						position: {
							x: region.left,
							y: region.top,
						},
						size: {
							width: region.width,
							height: region.height,
						},
						isActive,
						selectedWindow: selectedWindowId,
					}, null, 2),
				},
			],
		};
	}
}
