import {createRequire} from 'node:module';
import {logger} from './logger.js';

// Type definition for node-mac-permissions
type PermissionStatus = 'not determined' | 'denied' | 'authorized' | 'restricted';
type PermissionType = 'accessibility' | 'screen';

interface MacPermissions {
	getAuthStatus: (type: PermissionType) => PermissionStatus;
}

/**
 * Check macOS permissions on startup
 * Provides clear error messages if permissions are missing
 */
export async function checkPermissions(): Promise<void> {
	// Only check on macOS
	if (process.platform !== 'darwin') {
		return;
	}

	try {
		// Use createRequire to load CommonJS module from ES module
		const require = createRequire(import.meta.url);
		const permissions = require('@nut-tree-fork/node-mac-permissions') as MacPermissions;

		const accessibilityStatus = permissions.getAuthStatus('accessibility');
		const screenStatus = permissions.getAuthStatus('screen');

		logger.info('Permission check:', {
			accessibility: accessibilityStatus,
			screen: screenStatus,
		});

		if (accessibilityStatus !== 'authorized') {
			logger.error('ACCESSIBILITY PERMISSION REQUIRED:');
			logger.error('1. Open System Preferences > Privacy & Security > Accessibility');
			logger.error('2. Click the lock icon and authenticate');
			logger.error('3. Enable access for "node" or "Terminal"');
			logger.error('4. Restart Claude Desktop');
			logger.error(`Current status: ${accessibilityStatus}`);
		}

		if (screenStatus !== 'authorized') {
			logger.warn('SCREEN RECORDING PERMISSION RECOMMENDED:');
			logger.warn('1. Open System Preferences > Privacy & Security > Screen Recording');
			logger.warn('2. Enable access for "node" or "Terminal"');
			logger.warn('3. Restart Claude Desktop');
			logger.warn(`Current status: ${screenStatus}`);
		}

		if (accessibilityStatus === 'authorized' && screenStatus === 'authorized') {
			logger.info('✅ All required permissions granted');
		}
	} catch (error) {
		logger.warn('Could not check macOS permissions:', error);
	}
}
