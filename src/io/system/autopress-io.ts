import type {Tool} from '@modelcontextprotocol/sdk/types.js';
import type {IOClass, ToolResponse} from '../../core/io-class.interface.js';
import {autopressService, type AutopressConfig} from '../../services/autopress-service.js';
import {createErrorResponse} from '../../utils/error-response.js';

/**
 * AutopressIO provides tools for managing continuous/repeated command execution
 * Supports executing sequences of commands across different IO classes
 */
export class AutopressIO implements IOClass {
	get category() {
		return 'system' as const;
	}

	get name() {
		return 'autopress' as const;
	}

	get description() {
		return 'Manage continuous/repeated command execution across keyboard, mouse, and gamepad';
	}

	getTools(): Tool[] {
		return [
			{
				name: 'autopress_start',
				description: 'Start continuously executing a sequence of commands at regular intervals. Supports mixing keyboard, mouse, and gamepad commands in one sequence.',
				inputSchema: {
					type: 'object',
					properties: {
						id: {
							type: 'string',
							description: 'Unique identifier for this autopress (e.g., "farming", "combat-combo")',
						},
						commands: {
							type: 'array',
							description: 'Sequence of commands to repeat',
							items: {
								type: 'object',
								properties: {
									ioClass: {
										type: 'string',
										enum: ['gamepad', 'keyboard', 'mouse'],
										description: 'Which IO class to use (gamepad, keyboard, or mouse)',
									},
									action: {
										type: 'string',
										description: 'Action name (e.g., "button", "press", "click")',
									},
									params: {
										type: 'object',
										description: 'Action parameters (e.g., {button: "A"}, {keys: "w"}, {coordinate: [100, 100]})',
									},
								},
								required: ['ioClass', 'action', 'params'],
							},
							minItems: 1,
						},
						interval: {
							type: 'number',
							description: 'Interval in milliseconds between sequence repetitions (minimum: 10ms)',
							minimum: 10,
						},
					},
					required: ['id', 'commands', 'interval'],
				},
			},
			{
				name: 'autopress_stop',
				description: 'Stop a specific autopress by ID, or stop all autopresses if no ID provided',
				inputSchema: {
					type: 'object',
					properties: {
						id: {
							type: 'string',
							description: 'Autopress ID to stop (omit to stop all autopresses)',
						},
					},
					required: [],
				},
			},
			{
				name: 'autopress_list',
				description: 'List all active autopresses',
				inputSchema: {
					type: 'object',
					properties: {},
					required: [],
				},
			},
		];
	}

	async handleAction(action: string, params: Record<string, unknown>): Promise<ToolResponse> {
		try {
			switch (action) {
				case 'autopress_start':
					return await this.handleStart(params);

				case 'autopress_stop':
					return await this.handleStop(params);

				case 'autopress_list':
					return await this.handleList();

				default:
					throw new Error(`Unknown action: ${action}`);
			}
		} catch (error) {
			return createErrorResponse(error, `AutopressIO.${action}`);
		}
	}

	private async handleStart(params: Record<string, unknown>): Promise<ToolResponse> {
		const config = params as unknown as AutopressConfig;

		await autopressService.start(config);

		const commandList = config.commands
			.map(cmd => `${cmd.ioClass}.${cmd.action}`)
			.join(' → ');

		return {
			content: [
				{
					type: 'text' as const,
					text: `Started autopress "${config.id}": [${commandList}] repeating every ${config.interval}ms. Use autopress_stop to cancel.`,
				},
			],
		};
	}

	private async handleStop(params: Record<string, unknown>): Promise<ToolResponse> {
		const {id} = params as {id?: string};

		if (id) {
			// Stop specific autopress
			const stopped = await autopressService.stop(id);

			if (stopped) {
				return {
					content: [
						{
							type: 'text' as const,
							text: `Stopped autopress: ${id}`,
						},
					],
				};
			}

			return {
				content: [
					{
						type: 'text' as const,
						text: `Autopress "${id}" was not active`,
					},
				],
			};
		}

		// Stop all autopresses
		const count = await autopressService.stopAll();

		return {
			content: [
				{
					type: 'text' as const,
					text: `Stopped all autopresses (${count} total)`,
				},
			],
		};
	}

	private async handleList(): Promise<ToolResponse> {
		const activeIds = autopressService.getActiveIds();

		if (activeIds.length === 0) {
			return {
				content: [
					{
						type: 'text' as const,
						text: 'No active autopresses',
					},
				],
			};
		}

		return {
			content: [
				{
					type: 'text' as const,
					text: `Active autopresses (${activeIds.length}): ${activeIds.join(', ')}`,
				},
			],
		};
	}
}
