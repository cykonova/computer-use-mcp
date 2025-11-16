#!/usr/bin/env node
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {server} from './server.js';
import {logger} from './utils/logger.js';
import {checkPermissions} from './utils/permissions.js';

// Start the server
async function main(): Promise<void> {
	try {
		// Check macOS permissions on startup
		await checkPermissions();

		const transport = new StdioServerTransport();
		await server.connect(transport);
		logger.info('Computer Use MCP server running on stdio');
	} catch (error) {
		logger.error('Failed to start server:', error);
		process.exit(1);
	}
}

main().catch((error: unknown) => {
	logger.error('Server startup failed:', error);
	process.exit(1);
});
