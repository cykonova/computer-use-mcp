import {mouse, keyboard} from '@nut-tree-fork/nut-js';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {homedir} from 'node:os';

/**
 * Configure nut.js with optimized settings
 * Sets auto delay and mouse speed for better performance
 */
export function configureNutJs(): void {
	mouse.config.autoDelayMs = 100;
	mouse.config.mouseSpeed = 1000;
	keyboard.config.autoDelayMs = 10;
}

/**
 * Check if screenshot caching is enabled
 * Enable by setting SCREENSHOT_CACHE=true environment variable
 */
export function isScreenshotCacheEnabled(): boolean {
	return process.env.SCREENSHOT_CACHE === 'true';
}

/**
 * Get the screenshot cache directory
 * Creates the directory if it doesn't exist
 * Returns null if directory creation fails
 */
export function getScreenshotCacheDir(): string | null {
	if (!isScreenshotCacheEnabled()) {
		return null;
	}

	const cacheDir = join(homedir(), '.mcp', 'computer-use', 'screenshots');

	try {
		mkdirSync(cacheDir, {recursive: true});
		return cacheDir;
	} catch {
		return null;
	}
}
