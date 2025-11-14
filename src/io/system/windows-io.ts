import type {IOClass, ToolResponse} from '../../core/io-class.interface.js';
import type {Tool} from '@modelcontextprotocol/sdk/types.js';
import {getWindows, getActiveWindow, Window, Region} from '@nut-tree-fork/nut-js';

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
		return 'Window management operations for listing, focusing, and manipulating windows';
	}

	getTools(): Tool[] {
		return [
			{
				name: 'windows_list',
				description: 'List all open windows with their IDs, titles, and positions',
				inputSchema: {
					type: 'object',
					properties: {},
				},
			},
			{
				name: 'windows_focus',
				description: 'Focus (activate) a specific window to bring it to the foreground',
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
		switch (action) {
			case 'windows_list':
				return this.handleList();
			case 'windows_focus':
				return this.handleFocus(params.windowId as number);
			case 'windows_position':
				return this.handlePosition(
					params.windowId as number,
					params.x as number | undefined,
					params.y as number | undefined,
					params.width as number | undefined,
					params.height as number | undefined,
				);
			case 'windows_info':
				return this.handleInfo(params.windowId as number);
			default:
				throw new Error(`Unknown action: ${action}`);
		}
	}

	private async handleList(): Promise<ToolResponse> {
		const windows = await getWindows();
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
					}, null, 2),
				},
			],
		};
	}

	private async handleFocus(windowId: number): Promise<ToolResponse> {
		const windows = await getWindows();
		if (windowId < 0 || windowId >= windows.length) {
			throw new Error(`Invalid window ID: ${windowId}. Valid range: 0-${windows.length - 1}`);
		}

		const targetWindow = windows[windowId]!;
		await targetWindow.focus();

		const title = await targetWindow.title;
		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify({
						success: true,
						windowId,
						title,
						message: `Focused window: ${title}`,
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
		if (windowId < 0 || windowId >= windows.length) {
			throw new Error(`Invalid window ID: ${windowId}. Valid range: 0-${windows.length - 1}`);
		}

		const targetWindow = windows[windowId]!;
		const currentRegion = await targetWindow.region;

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
					}),
				},
			],
		};
	}

	private async handleInfo(windowId: number): Promise<ToolResponse> {
		const windows = await getWindows();
		if (windowId < 0 || windowId >= windows.length) {
			throw new Error(`Invalid window ID: ${windowId}. Valid range: 0-${windows.length - 1}`);
		}

		const targetWindow = windows[windowId]!;
		const [title, region] = await Promise.all([
			targetWindow.title,
			targetWindow.region,
		]);

		// Check if it's the active window
		const activeWindow = await getActiveWindow();
		const activeTitle = await activeWindow.title;
		const isActive = title === activeTitle;

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
					}, null, 2),
				},
			],
		};
	}
}
