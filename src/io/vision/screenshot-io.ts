import type {Tool} from '@modelcontextprotocol/sdk/types.js';
import {screen, imageToJimp} from '@nut-tree-fork/nut-js';
import {setTimeout} from 'node:timers/promises';
import imageminPngquant from 'imagemin-pngquant';
import type {IOClass, ToolResponse} from '../../core/io-class.interface.js';

/**
 * ScreenshotIO class for capturing screenshots
 * Implements the IOClass interface for vision operations
 */
export class ScreenshotIO implements IOClass {
	get category(): 'vision' {
		return 'vision';
	}

	get name(): string {
		return 'screenshot';
	}

	get description(): string {
		return 'Capture screenshots of the screen with optional window and region support';
	}

	getTools(): Tool[] {
		return [
			{
				name: 'screenshot_capture',
				description: 'Capture a screenshot of the screen or a specific region',
				inputSchema: {
					type: 'object',
					properties: {
						window: {
							oneOf: [
								{type: 'string'},
								{type: 'number'},
							],
							description: 'Optional window ID to capture (string or number)',
						},
						region: {
							type: 'object',
							description: 'Optional region to capture {x, y, width, height}',
							properties: {
								x: {
									type: 'number',
									description: 'X coordinate of the region',
								},
								y: {
									type: 'number',
									description: 'Y coordinate of the region',
								},
								width: {
									type: 'number',
									description: 'Width of the region',
								},
								height: {
									type: 'number',
									description: 'Height of the region',
								},
							},
							required: ['x', 'y', 'width', 'height'],
						},
					},
				},
			},
		];
	}

	async handleAction(action: string, params: Record<string, unknown>): Promise<ToolResponse> {
		if (action !== 'screenshot_capture') {
			throw new Error(`Unknown action: ${action}`);
		}

		const window = params.window as string | number | undefined;
		const region = params.region as {x: number; y: number; width: number; height: number} | undefined;

		return this.captureScreenshot(window, region);
	}

	private async captureScreenshot(
		window?: string | number,
		region?: {x: number; y: number; width: number; height: number},
	): Promise<ToolResponse> {
		// Wait a couple of seconds - helps to let things load before showing it to Claude
		await setTimeout(1000);

		// Capture the entire screen
		const image = imageToJimp(await screen.grab());

		// TODO: Implement window-specific capture when window parameter is provided
		if (window !== undefined) {
			// Window capture to be implemented
			// Would need to identify the window and grab its specific region
		}

		// Get original dimensions before processing
		let originalWidth = image.getWidth();
		let originalHeight = image.getHeight();

		// TODO: Implement region crop if region parameter is provided
		if (region !== undefined) {
			// Basic region crop implementation
			// Crop the image to the specified region
			image.crop(region.x, region.y, region.width, region.height);
			// Note: After crop, dimensions change to the region size
			originalWidth = region.width;
			originalHeight = region.height;
		}

		// Resize if high definition, to fit size limits
		if (originalWidth * originalHeight > 1366 * 768) {
			const scaleFactor = Math.sqrt((1366 * 768) / (originalWidth * originalHeight));
			const newWidth = Math.floor(originalWidth * scaleFactor);
			const newHeight = Math.floor(originalHeight * scaleFactor);
			image.resize(newWidth, newHeight);
		}

		// Get PNG buffer from Jimp
		const pngBuffer = await image.getBufferAsync('image/png');

		// Compress PNG using imagemin, to fit size limits
		const optimizedBuffer = await imageminPngquant()(new Uint8Array(pngBuffer));

		// Convert optimized buffer to base64
		const base64Data = Buffer.from(optimizedBuffer).toString('base64');

		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify({
						display_width_px: originalWidth,
						display_height_px: originalHeight,
					}),
				},
				{
					type: 'image',
					data: base64Data,
					mimeType: 'image/png',
				},
			],
		};
	}
}
