#!/usr/bin/env node
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {SSEServerTransport} from '@modelcontextprotocol/sdk/server/sse.js';
import {createServer, type IncomingMessage, type ServerResponse} from 'node:http';
import {server} from './server.js';
import {logger} from './utils/logger.js';
import {checkPermissions} from './utils/permissions.js';

// Parse command line arguments
const args = process.argv.slice(2);
const transportArg = args.find(arg => arg.startsWith('--transport='));
const transport = transportArg?.split('=')[1] ?? process.env.MCP_TRANSPORT ?? 'stdio';

// HTTP configuration from environment variables
const HTTP_HOST = process.env.MCP_HTTP_HOST ?? '0.0.0.0';
const HTTP_PORT = Number.parseInt(process.env.MCP_HTTP_PORT ?? '3000', 10);

// Active SSE transports (keyed by session ID)
const activeTransports = new Map<string, SSEServerTransport>();

/**
 * Start the server with stdio transport
 */
async function startStdioServer(): Promise<void> {
	const transport = new StdioServerTransport();
	await server.connect(transport);
	logger.info('Computer Use MCP server running on stdio');
}

/**
 * Start the server with HTTP/SSE transport
 */
async function startHttpServer(): Promise<void> {
	const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
		const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

		// CORS headers for cross-origin requests (VM -> host machine)
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
		res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

		// Handle preflight requests
		if (req.method === 'OPTIONS') {
			res.writeHead(200);
			res.end();
			return;
		}

		// SSE endpoint - GET /sse establishes the SSE stream
		if (url.pathname === '/sse' && req.method === 'GET') {
			const sseTransport = new SSEServerTransport('/message', res);

			// Store transport by session ID for routing POST messages
			activeTransports.set(sseTransport.sessionId, sseTransport);

			// Clean up on close
			sseTransport.onclose = () => {
				activeTransports.delete(sseTransport.sessionId);
				logger.info(`SSE connection closed for session: ${sseTransport.sessionId}`);
			};

			sseTransport.onerror = (error: Error) => {
				logger.error(`SSE transport error for session ${sseTransport.sessionId}:`, error);
			};

			// Connect server to this transport (automatically starts the transport)
			await server.connect(sseTransport);

			logger.info(`SSE connection established, session: ${sseTransport.sessionId}`);
			return;
		}

		// Message endpoint - POST /message receives client messages
		if (url.pathname === '/message' && req.method === 'POST') {
			// Get session ID from query parameter
			const sessionId = url.searchParams.get('sessionId');

			if (!sessionId) {
				res.writeHead(400, {'Content-Type': 'application/json'});
				res.end(JSON.stringify({error: 'Missing sessionId parameter'}));
				return;
			}

			const sseTransport = activeTransports.get(sessionId);

			if (!sseTransport) {
				res.writeHead(404, {'Content-Type': 'application/json'});
				res.end(JSON.stringify({error: 'Session not found'}));
				return;
			}

			// Read POST body
			const chunks: Buffer[] = [];
			req.on('data', chunk => {
				chunks.push(chunk);
			});

			req.on('end', async () => {
				try {
					const body = Buffer.concat(chunks).toString();
					const parsedBody = JSON.parse(body);

					// Handle the message through the SSE transport
					await sseTransport.handlePostMessage(req, res, parsedBody);
				} catch (error) {
					logger.error('Error handling POST message:', error);
					res.writeHead(500, {'Content-Type': 'application/json'});
					res.end(JSON.stringify({error: 'Internal server error'}));
				}
			});

			return;
		}

		// Health check endpoint
		if (url.pathname === '/health' && req.method === 'GET') {
			res.writeHead(200, {'Content-Type': 'application/json'});
			res.end(JSON.stringify({
				status: 'ok',
				transport: 'http-sse',
				activeSessions: activeTransports.size,
			}));
			return;
		}

		// 404 for unknown endpoints
		res.writeHead(404, {'Content-Type': 'application/json'});
		res.end(JSON.stringify({error: 'Not found'}));
	});

	httpServer.listen(HTTP_PORT, HTTP_HOST, () => {
		logger.info(`Computer Use MCP server running on http://${HTTP_HOST}:${HTTP_PORT}`);
		logger.info(`SSE endpoint: http://${HTTP_HOST}:${HTTP_PORT}/sse`);
		logger.info(`Message endpoint: http://${HTTP_HOST}:${HTTP_PORT}/message?sessionId=<SESSION_ID>`);
		logger.info(`Health check: http://${HTTP_HOST}:${HTTP_PORT}/health`);
	});

	// Graceful shutdown
	process.on('SIGINT', () => {
		logger.info('Shutting down HTTP server...');
		httpServer.close(() => {
			process.exit(0);
		});
	});
}

// Start the server
async function main(): Promise<void> {
	try {
		// Check macOS permissions on startup
		await checkPermissions();

		if (transport === 'http' || transport === 'sse') {
			await startHttpServer();
		} else if (transport === 'stdio') {
			await startStdioServer();
		} else {
			throw new Error(`Unknown transport: ${transport}. Use 'stdio' or 'http'`);
		}
	} catch (error) {
		logger.error('Failed to start server:', error);
		process.exit(1);
	}
}

main().catch((error: unknown) => {
	logger.error('Server startup failed:', error);
	process.exit(1);
});
