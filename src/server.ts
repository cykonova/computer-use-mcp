import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type {Tool} from '@modelcontextprotocol/sdk/types.js';
import {configureNutJs} from './utils/config.js';
import {
	DIContainer,
	isIOClass,
	getSequenceTool,
	executeSequence,
} from './core/index.js';
import {KeyboardIO} from './io/input/keyboard-io.js';
import {MouseIO} from './io/input/mouse-io.js';
import {GamepadIO} from './io/input/gamepad-io.js';
import {ScreenshotIO} from './io/vision/screenshot-io.js';
import {WindowsIO} from './io/system/windows-io.js';
import {AutopressIO} from './io/system/autopress-io.js';
import {autopressService} from './services/autopress-service.js';

// Configure nut-js
configureNutJs();

// Create DI container and register IO classes
const container = new DIContainer();
container.register('keyboard', new KeyboardIO());
container.register('mouse', new MouseIO());
container.register('gamepad', new GamepadIO());
container.register('screenshot', new ScreenshotIO());
container.register('windows', new WindowsIO());
container.register('autopress', new AutopressIO());

// Set up command executor for autopress service
// This allows autopressService to route commands to the appropriate IO classes
autopressService.setCommandExecutor(async (ioClassName, action, params) => {
	// Construct tool name from IO class and action
	const toolName = `${ioClassName}_${action}`;

	// Route to appropriate IO class
	if (!container.has(ioClassName)) {
		throw new Error(`Unknown IO class: ${ioClassName}`);
	}

	const ioClass = container.resolve(ioClassName)!;
	if (!isIOClass(ioClass)) {
		throw new Error(`Invalid IO class: ${ioClassName}`);
	}

	return ioClass.handleAction(toolName, params);
});

// Collect tools from all IO classes
const tools: Tool[] = [];

// Add IO class tools
for (const [, ioClass] of container.getAll()) {
	if (isIOClass(ioClass)) {
		tools.push(...ioClass.getTools());
	}
}

// Add sequence tool
tools.push(getSequenceTool());

// Create the server
export const server = new Server({
	name: 'computer-use-mcp',
	version: '1.0.0',
}, {
	capabilities: {
		tools: {},
	},
});

// Handle tool list requests
server.setRequestHandler(ListToolsRequestSchema, async () => {
	return {tools};
});

// Handle tool execution requests
server.setRequestHandler(CallToolRequestSchema, async (request) => {
	const {name, arguments: toolArgs} = request.params;

	// Handle sequence tool
	if (name === 'sequence') {
		return executeSequence(
			toolArgs! as Parameters<typeof executeSequence>[0],
			container,
		);
	}

	// Route to appropriate IO class based on tool name
	// Tool names follow pattern: {ioclass}_{action}
	// e.g., "keyboard_press" -> keyboard IO class, "keyboard_press" action

	const underscore = name.indexOf('_');
	if (underscore === -1) {
		throw new Error(`Invalid tool name: ${name}`);
	}

	const ioClassName = name.slice(0, underscore);

	if (!container.has(ioClassName)) {
		throw new Error(`Unknown tool category: ${ioClassName}`);
	}

	const ioClass = container.resolve(ioClassName)!;
	if (!isIOClass(ioClass)) {
		throw new Error(`Invalid IO class: ${ioClassName}`);
	}

	return ioClass.handleAction(name, toolArgs!);
});

// Error handling
process.on('SIGINT', async () => {
	await server.close();
	process.exit(0);
});

process.on('SIGTERM', async () => {
	await server.close();
	process.exit(0);
});
