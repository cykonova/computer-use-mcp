import {mouse, keyboard} from '@nut-tree-fork/nut-js';

/**
 * Configure nut.js with optimized settings
 * Sets auto delay and mouse speed for better performance
 */
export function configureNutJs(): void {
	mouse.config.autoDelayMs = 100;
	mouse.config.mouseSpeed = 1000;
	keyboard.config.autoDelayMs = 10;
}
