import {screen, imageToJimp} from '@nut-tree-fork/nut-js';
import {setTimeout} from 'node:timers/promises';
import imageminPngquant from 'imagemin-pngquant';

export async function handleScreenshot() {
	// Wait a couple of seconds - helps to let things load before showing it to Claude
	await setTimeout(1000);

	// Capture the entire screen
	const image = imageToJimp(await screen.grab());
	const [originalWidth, originalHeight] = [image.getWidth(), image.getHeight()];

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
