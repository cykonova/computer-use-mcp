import type {Tool} from '@modelcontextprotocol/sdk/types.js';
import {setTimeout} from 'node:timers/promises';
import type {DIContainer} from './di-container.js';
import type {ToolResponse} from './io-class.interface.js';
import {isIOClass} from './io-class.interface.js';

/**
 * Command specification for sequence execution
 */
type SequenceCommand = {
	tool: string;
	action: string;
	params?: Record<string, unknown>;
	captureResult?: boolean;
};

/**
 * Sequence parameters
 */
type SequenceParams = {
	window?: string | number;
	commands: SequenceCommand[];
	captureIntermediate?: boolean;
	stopOnError?: boolean;
	delayBetween?: number;
};

/**
 * Result from executing a single command in the sequence
 */
type CommandResult = {
	command: SequenceCommand;
	success: boolean;
	error?: string;
	response?: ToolResponse;
};

/**
 * Get the sequence tool definition
 */
export function getSequenceTool(): Tool {
	return {
		name: 'sequence',
		description: 'Execute multiple commands in order with shared context',
		inputSchema: {
			type: 'object',
			properties: {
				window: {
					type: ['string', 'number'],
					description:
						'Window ID to target for all commands (can be overridden per command, omit for desktop/focused window)',
				},
				commands: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							tool: {
								type: 'string',
								description: 'IO class name (e.g., "keyboard", "mouse", "screenshot")',
							},
							action: {
								type: 'string',
								description: 'Action name (e.g., "keyboard_press", "mouse_click")',
							},
							params: {
								type: 'object',
								description: 'Action parameters',
							},
							captureResult: {
								type: 'boolean',
								default: false,
								description: 'Capture screenshot for this command (overrides auto-screenshot)',
							},
						},
						required: ['tool', 'action'],
					},
					description: 'Commands to execute in sequence',
				},
				captureIntermediate: {
					type: 'boolean',
					default: false,
					description: 'Capture screenshots for intermediate steps (default: only final step)',
				},
				stopOnError: {
					type: 'boolean',
					default: true,
					description: 'Stop execution if any command fails',
				},
				delayBetween: {
					type: 'number',
					default: 0,
					description: 'Delay in ms between commands',
				},
			},
			required: ['commands'],
		},
	};
}

/**
 * Execute a sequence of commands.
 * SequenceHandler executes multiple commands in sequence with shared context.
 * NOT an IOClass, but a special handler registered separately.
 *
 * @param params - Sequence parameters
 * @param container - DI container to resolve IO classes
 * @returns Tool response with execution summary and screenshots
 */
export async function executeSequence(
	params: SequenceParams,
	container: DIContainer,
): Promise<ToolResponse> {
	const {
		window: sharedWindow,
		commands,
		captureIntermediate = false,
		stopOnError = true,
		delayBetween = 0,
	} = params;

	const results: CommandResult[] = [];
	const allContent: ToolResponse['content'] = [];

	for (const command of commands) {
		// Apply delay between commands (except before first command)
		if (results.length > 0 && delayBetween > 0) {
			// eslint-disable-next-line no-await-in-loop
			await setTimeout(delayBetween);
		}

		try {
			// Resolve IO class
			if (!container.has(command.tool)) {
				throw new Error(`Unknown tool: ${command.tool}`);
			}

			const ioClass = container.resolve<unknown>(command.tool);

			if (!isIOClass(ioClass)) {
				throw new Error(`${command.tool} is not a valid IO class`);
			}

			// Prepare parameters with shared window context
			const mergedParams = {
				...command.params,
			};

			// Apply shared window context if not overridden
			if (sharedWindow !== undefined && !('window' in (command.params || {}))) {
				mergedParams.window = sharedWindow;
			}

			// Execute the action
			// eslint-disable-next-line no-await-in-loop
			const response = await ioClass.handleAction(command.action, mergedParams);

			results.push({
				command,
				success: true,
				response,
			});

			// Capture intermediate results if requested
			if (captureIntermediate || command.captureResult) {
				allContent.push(...response.content);
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);

			results.push({
				command,
				success: false,
				error: errorMessage,
			});

			// Stop on error if requested
			if (stopOnError) {
				// Add error summary to content
				allContent.push({
					type: 'text',
					text: JSON.stringify({
						status: 'error',
						total: commands.length,
						executed: results.length,
						successful: results.filter((r) => r.success).length,
						failed: results.filter((r) => !r.success).length,
						error: errorMessage,
						results: results.map((r) => ({
							command: {
								tool: r.command.tool,
								action: r.command.action,
							},
							success: r.success,
							error: r.error,
						})),
					}),
				});

				return {
					content: allContent,
				};
			}
		}
	}

	// If not capturing intermediate results, capture only the final screenshot
	if (!captureIntermediate && results.length > 0) {
		const finalResult = results[results.length - 1];
		if (finalResult && finalResult.success && finalResult.response) {
			// Add only image content from final response
			const imageContent = finalResult.response.content.filter((c) => c.type === 'image');
			allContent.push(...imageContent);
		}
	}

	// Add execution summary
	const successCount = results.filter((r) => r.success).length;
	const failureCount = results.filter((r) => !r.success).length;

	allContent.push({
		type: 'text',
		text: JSON.stringify({
			status: failureCount === 0 ? 'success' : 'partial',
			total: commands.length,
			successful: successCount,
			failed: failureCount,
			results: results.map((r) => ({
				command: {
					tool: r.command.tool,
					action: r.command.action,
				},
				success: r.success,
				error: r.error,
			})),
		}),
	});

	return {
		content: allContent,
	};
}
