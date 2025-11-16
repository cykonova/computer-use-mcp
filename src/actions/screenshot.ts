import {screen, imageToJimp, getWindows} from '@nut-tree-fork/nut-js';
import {setTimeout} from 'node:timers/promises';
import imageminPngquant from 'imagemin-pngquant';
import {getSelectedWindow} from '../utils/window-context.js';

export async function handleScreenshot() {
	// Wait a couple of seconds - helps to let things load before showing it to Claude
	await setTimeout(1000);

	// Capture the entire screen
	const image = imageToJimp(await screen.grab());
	let originalWidth = image.getWidth();
	let originalHeight = image.getHeight();

	// If a window is selected, crop to that window
	const selectedWindowId = getSelectedWindow();
	if (selectedWindowId !== null) {
		const windows = await getWindows();
		if (selectedWindowId >= 0 && selectedWindowId < windows.length) {
			const targetWindow = windows[selectedWindowId]!;
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
		}
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
