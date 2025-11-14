import {screen} from '@nut-tree-fork/nut-js';

/**
 * Validate that coordinates are within the current display bounds
 * @param coordinate - [x, y] coordinate tuple to validate
 * @throws Error if coordinates are outside display bounds
 */
export async function validateCoordinate(coordinate: [number, number]): Promise<void> {
	const [x, y] = coordinate;
	const [width, height] = [await screen.width(), await screen.height()];
	if (x < 0 || x >= width || y < 0 || y >= height) {
		throw new Error(`Coordinates (${x}, ${y}) are outside display bounds of ${width}x${height}`);
	}
}
