import type {Tool} from '@modelcontextprotocol/sdk/types.js';
import type {IOClass, ToolResponse, CommonParams} from '../../core/io-class.interface.js';
import {handleScreenshot} from '../../actions/screenshot.js';
import {setTimeout} from 'node:timers/promises';
import {createErrorResponse} from '../../utils/error-response.js';

// Platform detection
const isWindows = process.platform === 'win32';

// Types for vigemclient (dynamic import)
type ViGEmClient = any;
type X360Controller = any;

/**
 * GamepadIO class - Xbox controller emulation
 *
 * Platform Support:
 * - Windows: Full support via ViGEm driver (requires driver installation)
 * - macOS: Not supported (no virtual gamepad driver available)
 * - Linux: Not supported (would require uinput implementation)
 *
 * @see https://github.com/jangxx/node-ViGEmClient
 */
export class GamepadIO implements IOClass {
	private client: ViGEmClient | null = null;
	private controller: X360Controller | null = null;
	private initialized = false;

	get category(): 'input' {
		return 'input';
	}

	get name(): string {
		return 'gamepad';
	}

	get description(): string {
		return 'Xbox controller emulation (Windows only - requires ViGEm driver)';
	}

	/**
	 * Initialize ViGEm client and controller
	 * Only available on Windows with ViGEm driver installed
	 */
	private async initialize(): Promise<void> {
		if (this.initialized) {
			return;
		}

		if (!isWindows) {
			throw new Error(
				'Gamepad emulation is not supported on this platform. ' +
				'Supported platforms: Windows (requires ViGEm driver from https://github.com/nefarius/ViGEmBus)',
			);
		}

		try {
			// Dynamic import to avoid loading on non-Windows platforms
			// vigemclient is a CommonJS module, so we need to access .default
			// @ts-ignore - vigemclient is optional dependency (Windows-only)
			const vigemclientModule = await import('vigemclient');
			const ViGEmClient = vigemclientModule.default;

			this.client = new ViGEmClient();
			this.client.connect();

			// Create Xbox 360 controller
			this.controller = this.client.createX360Controller();
			await this.controller.connect();

			this.initialized = true;
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw new Error(
				`Failed to initialize gamepad: ${errorMessage}. ` +
				'Make sure ViGEm driver is installed: https://github.com/nefarius/ViGEmBus/releases',
			);
		}
	}

	getTools(): Tool[] {
		return [
			{
				name: 'gamepad_button',
				description: 'Press Xbox controller buttons (A, B, X, Y, LB, RB, Start, Back, Xbox, L3, R3)',
				inputSchema: {
					type: 'object',
					properties: {
						button: {
							type: 'string',
							enum: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'Start', 'Back', 'Xbox', 'L3', 'R3'],
							description: 'Button to press',
						},
						window: {
							type: ['string', 'number'],
							description: 'Window ID to target (optional)',
						},
						hold: {
							type: 'number',
							description: 'Hold duration in milliseconds (default: 100ms)',
						},
					},
					required: ['button'],
				},
			},
			{
				name: 'gamepad_trigger',
				description: 'Press Xbox controller triggers (LT, RT) with analog pressure',
				inputSchema: {
					type: 'object',
					properties: {
						trigger: {
							type: 'string',
							enum: ['LT', 'RT'],
							description: 'Trigger to press',
						},
						pressure: {
							type: 'number',
							minimum: 0,
							maximum: 255,
							description: 'Pressure level (0 = not pressed, 255 = fully pressed)',
						},
						window: {
							type: ['string', 'number'],
							description: 'Window ID to target (optional)',
						},
						hold: {
							type: 'number',
							description: 'Hold duration in milliseconds (default: 100ms, then releases to 0)',
						},
					},
					required: ['trigger', 'pressure'],
				},
			},
			{
				name: 'gamepad_stick',
				description: 'Move Xbox controller analog sticks (left/right)',
				inputSchema: {
					type: 'object',
					properties: {
						stick: {
							type: 'string',
							enum: ['left', 'right'],
							description: 'Stick to move',
						},
						x: {
							type: 'number',
							minimum: -32768,
							maximum: 32767,
							description: 'X axis position (-32768 = full left, 0 = center, 32767 = full right)',
						},
						y: {
							type: 'number',
							minimum: -32768,
							maximum: 32767,
							description: 'Y axis position (-32768 = full down, 0 = center, 32767 = full up)',
						},
						window: {
							type: ['string', 'number'],
							description: 'Window ID to target (optional)',
						},
						hold: {
							type: 'number',
							description: 'Hold duration in milliseconds (position persists unless hold is specified, then returns to center)',
						},
					},
					required: ['stick', 'x', 'y'],
				},
			},
			{
				name: 'gamepad_dpad',
				description: 'Press Xbox controller D-pad directions',
				inputSchema: {
					type: 'object',
					properties: {
						direction: {
							type: 'string',
							enum: ['up', 'down', 'left', 'right'],
							description: 'D-pad direction to press',
						},
						window: {
							type: ['string', 'number'],
							description: 'Window ID to target (optional)',
						},
						hold: {
							type: 'number',
							description: 'Hold duration in milliseconds (default: 100ms)',
						},
					},
					required: ['direction'],
				},
			},
			{
				name: 'gamepad_reset',
				description: 'Reset Xbox controller to neutral state (all sticks centered, no buttons pressed)',
				inputSchema: {
					type: 'object',
					properties: {
						window: {
							type: ['string', 'number'],
							description: 'Window ID to target (optional)',
						},
					},
					required: [],
				},
			},
		];
	}

	async handleAction(action: string, params: Record<string, unknown>): Promise<ToolResponse> {
		try {
			// Initialize on first use
			await this.initialize();

			switch (action) {
				case 'gamepad_button': {
					return await this.handleButton(params);
				}

				case 'gamepad_trigger': {
					return await this.handleTrigger(params);
				}

				case 'gamepad_stick': {
					return await this.handleStick(params);
				}

				case 'gamepad_dpad': {
					return await this.handleDpad(params);
				}

				case 'gamepad_reset': {
					return await this.handleReset(params);
			}

			default: {
				throw new Error(`Unknown gamepad action: ${action}`);
			}
		}
		} catch (error) {
			return createErrorResponse(error, `GamepadIO.${action}`);
		}
	}

	private async handleButton(params: Record<string, unknown>): Promise<ToolResponse> {
		const {button, hold = 100} = params as {button: string; hold?: number} & CommonParams;

		if (!this.controller) {
			throw new Error('Controller not initialized');
		}

		// Map button names to vigemclient properties
		const buttonMap: Record<string, string> = {
			A: 'A',
			B: 'B',
			X: 'X',
			Y: 'Y',
			LB: 'LeftShoulder',
			RB: 'RightShoulder',
			Start: 'Start',
			Back: 'Back',
			Xbox: 'Guide',
			L3: 'LeftThumb',
			R3: 'RightThumb',
		};

		const vigemButton = buttonMap[button];
		if (!vigemButton) {
			throw new Error(`Invalid button: ${button}`);
		}

		// Press button
		this.controller.button[vigemButton].setValue(true);
		this.controller.update();

		// Hold duration
		if (hold > 0) {
			await setTimeout(hold);
		}

		// Release button
		this.controller.button[vigemButton].setValue(false);
		this.controller.update();

		// Auto-screenshot
		const screenshot = await handleScreenshot();

		return {
			content: [
				{
					type: 'text' as const,
					text: `Pressed button: ${button} (held for ${hold}ms)`,
				},
				...screenshot.content,
			] as ToolResponse['content'],
		};
	}

	private async handleTrigger(params: Record<string, unknown>): Promise<ToolResponse> {
		const {trigger, pressure, hold = 100} = params as {trigger: string; pressure: number; hold?: number} & CommonParams;

		if (!this.controller) {
			throw new Error('Controller not initialized');
		}

		// Validate pressure
		if (pressure < 0 || pressure > 255) {
			throw new Error('Pressure must be between 0 and 255');
		}

		// Map trigger to axis (triggers are 0-255, vigemclient uses 0-1)
		const normalizedPressure = pressure / 255;
		const triggerAxis = trigger === 'LT' ? 'leftTrigger' : 'rightTrigger';

		// Apply pressure
		this.controller.axis[triggerAxis].setValue(normalizedPressure);
		this.controller.update();

		// Hold duration
		if (hold > 0) {
			await setTimeout(hold);
			// Release trigger
			this.controller.axis[triggerAxis].setValue(0);
			this.controller.update();
		}

		// Auto-screenshot
		const screenshot = await handleScreenshot();

		return {
			content: [
				{
					type: 'text' as const,
					text: `Pressed trigger: ${trigger} (pressure: ${pressure}/255${hold > 0 ? `, held for ${hold}ms` : ', persists'})`,
				},
				...screenshot.content,
			] as ToolResponse['content'],
		};
	}

	private async handleStick(params: Record<string, unknown>): Promise<ToolResponse> {
		const {stick, x, y, hold} = params as {stick: string; x: number; y: number; hold?: number} & CommonParams;

		if (!this.controller) {
			throw new Error('Controller not initialized');
		}

		// Validate ranges
		if (x < -32768 || x > 32767) {
			throw new Error('X must be between -32768 and 32767');
		}

		if (y < -32768 || y > 32767) {
			throw new Error('Y must be between -32768 and 32767');
		}

		// Convert to normalized values (-1 to 1)
		const normalizedX = x / 32767;
		const normalizedY = y / 32767;

		// Map stick to axes
		const xAxis = stick === 'left' ? 'leftX' : 'rightX';
		const yAxis = stick === 'left' ? 'leftY' : 'rightY';

		// Set stick position
		this.controller.axis[xAxis].setValue(normalizedX);
		this.controller.axis[yAxis].setValue(normalizedY);
		this.controller.update();

		// If hold duration specified, return to center after
		if (hold !== undefined && hold > 0) {
			await setTimeout(hold);
			this.controller.axis[xAxis].setValue(0);
			this.controller.axis[yAxis].setValue(0);
			this.controller.update();
		}

		// Auto-screenshot
		const screenshot = await handleScreenshot();

		return {
			content: [
				{
					type: 'text' as const,
					text: `Moved ${stick} stick to (${x}, ${y})${hold ? ` for ${hold}ms, then centered` : ' (persists)'}`,
				},
				...screenshot.content,
			] as ToolResponse['content'],
		};
	}

	private async handleDpad(params: Record<string, unknown>): Promise<ToolResponse> {
		const {direction, hold = 100} = params as {direction: string; hold?: number} & CommonParams;

		if (!this.controller) {
			throw new Error('Controller not initialized');
		}

		// Map direction to vigemclient property
		const dpadMap: Record<string, string> = {
			up: 'DpadUp',
			down: 'DpadDown',
			left: 'DpadLeft',
			right: 'DpadRight',
		};

		const vigemDpad = dpadMap[direction];
		if (!vigemDpad) {
			throw new Error(`Invalid direction: ${direction}`);
		}

		// Press D-pad
		this.controller.button[vigemDpad].setValue(true);
		this.controller.update();

		// Hold duration
		if (hold > 0) {
			await setTimeout(hold);
		}

		// Release D-pad
		this.controller.button[vigemDpad].setValue(false);
		this.controller.update();

		// Auto-screenshot
		const screenshot = await handleScreenshot();

		return {
			content: [
				{
					type: 'text' as const,
					text: `Pressed D-pad ${direction} (held for ${hold}ms)`,
				},
				...screenshot.content,
			] as ToolResponse['content'],
		};
	}

	private async handleReset(params: Record<string, unknown>): Promise<ToolResponse> {
		if (!this.controller) {
			throw new Error('Controller not initialized');
		}

		// Reset all axes to center (0)
		this.controller.axis.leftX.setValue(0);
		this.controller.axis.leftY.setValue(0);
		this.controller.axis.rightX.setValue(0);
		this.controller.axis.rightY.setValue(0);
		this.controller.axis.leftTrigger.setValue(0);
		this.controller.axis.rightTrigger.setValue(0);

		// Release all buttons
		const buttons = ['A', 'B', 'X', 'Y', 'LeftShoulder', 'RightShoulder', 'Start', 'Back', 'Guide', 'LeftThumb', 'RightThumb', 'DpadUp', 'DpadDown', 'DpadLeft', 'DpadRight'];
		for (const button of buttons) {
			this.controller.button[button].setValue(false);
		}

		this.controller.update();

		// Auto-screenshot
		const screenshot = await handleScreenshot();

		return {
			content: [
				{
					type: 'text' as const,
					text: 'Reset controller to neutral state',
				},
				...screenshot.content,
			] as ToolResponse['content'],
		};
	}

	/**
	 * Cleanup method to disconnect controller and client
	 */
	async cleanup(): Promise<void> {
		if (this.controller) {
			await this.controller.disconnect();
			this.controller = null;
		}

		if (this.client) {
			this.client.disconnect();
			this.client = null;
		}

		this.initialized = false;
	}
}
