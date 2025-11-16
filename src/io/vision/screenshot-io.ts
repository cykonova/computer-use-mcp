import type {Tool} from '@modelcontextprotocol/sdk/types.js';
import {screen, imageToJimp, getWindows} from '@nut-tree-fork/nut-js';
import {setTimeout} from 'node:timers/promises';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import imageminPngquant from 'imagemin-pngquant';
import type {IOClass, ToolResponse} from '../../core/io-class.interface.js';
import {getScreenshotCacheDir} from '../../utils/config.js';
import {logger} from '../../utils/logger.js';
import {getEffectiveWindow, getSelectedWindow} from '../../utils/window-context.js';
import {createErrorResponse, validateWindowId} from '../../utils/error-response.js';
import {validateJailEnforcement} from '../../utils/window-jail.js';

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
		return 'Capture screenshots of your physical desktop screen (NOT containerized environments)';
	}

	getTools(): Tool[] {
		return [
			{
				name: 'screenshot_capture',
				description: 'Capture a screenshot of your physical desktop screen or a specific window/region. This captures your actual computer display, NOT containerized environments like bash_tool.',
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
		try {
			if (action !== 'screenshot_capture') {
				throw new Error(`Unknown action: ${action}`);
			}

			// Validate window jail enforcement
			await validateJailEnforcement();

			const explicitWindow = params.window as string | number | undefined;
			const region = params.region as {x: number; y: number; width: number; height: number} | undefined;

			// Get effective window (explicit param or selected window)
			const effectiveWindow = getEffectiveWindow(explicitWindow);

			return await this.captureScreenshot(effectiveWindow, region);
		} catch (error) {
			return createErrorResponse(error, `ScreenshotIO.${action}`);
		}
	}

	private async captureScreenshot(
		windowId?: number,
		region?: {x: number; y: number; width: number; height: number},
	): Promise<ToolResponse> {
		// Wait a couple of seconds - helps to let things load before showing it to Claude
		await setTimeout(1000);

		// Capture the entire screen
		const image = imageToJimp(await screen.grab());

		// Get original dimensions before processing
		let originalWidth = image.getWidth();
		let originalHeight = image.getHeight();

		// Handle window-specific capture
		if (windowId !== undefined) {
			const windows = await getWindows();
			validateWindowId(windowId, windows.length);

			const targetWindow = windows[windowId]!;
			const windowRegion = await targetWindow.region;

			// Crop to window bounds
			image.crop(
				windowRegion.left,
				windowRegion.top,
				windowRegion.width,
				windowRegion.height,
			);

			originalWidth = windowRegion.width;
			originalHeight = windowRegion.height;
		} else if (region !== undefined) {
			// Handle region crop if window not specified
			image.crop(region.x, region.y, region.width, region.height);
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

		// Optionally save screenshot to cache directory
		const cacheDir = getScreenshotCacheDir();
		if (cacheDir) {
			try {
				const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
				const filename = `screenshot-${timestamp}.png`;
				const filepath = join(cacheDir, filename);

				writeFileSync(filepath, optimizedBuffer);
				logger.info(`Screenshot saved to: ${filepath}`);
			} catch (error) {
				logger.error('Failed to save screenshot to cache:', error);
			}
		}

		// Get selected window for response
		const selectedWindowId = getSelectedWindow();

		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify({
						display_width_px: originalWidth,
						display_height_px: originalHeight,
						selectedWindow: selectedWindowId,
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
