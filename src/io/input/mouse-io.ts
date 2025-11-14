import {mouse, Point, Button} from '@nut-tree-fork/nut-js';
import type {Tool} from '@modelcontextprotocol/sdk/types.js';
import type {IOClass, ToolResponse, CommonParams} from '../../core/io-class.interface.js';
import {handleScreenshot} from '../../actions/screenshot.js';

type MouseActionParams = CommonParams & {
	coordinate?: [number, number];
	button?: 'left' | 'right' | 'middle' | 'double';
};

export class MouseIO implements IOClass {
	get category(): 'input' {
		return 'input';
	}

	get name(): string {
		return 'mouse';
	}

	get description(): string {
		return 'Mouse control - move cursor, click, drag, and get position';
	}

	getTools(): Tool[] {
		return [
			{
				name: 'mouse_move',
				description: 'Move the cursor to a specified (x, y) pixel coordinate',
				inputSchema: {
					type: 'object',
					properties: {
						coordinate: {
							type: 'array',
							items: {type: 'number'},
							minItems: 2,
							maxItems: 2,
							description: '(x, y): The x (pixels from left) and y (pixels from top) coordinates',
						},
						window: {
							type: ['string', 'number'],
							description: 'Window ID to target (optional)',
						},
					},
					required: ['coordinate'],
				},
			},
			{
				name: 'mouse_click',
				description: 'Click the mouse at the current or specified location',
				inputSchema: {
					type: 'object',
					properties: {
						coordinate: {
							type: 'array',
							items: {type: 'number'},
							minItems: 2,
							maxItems: 2,
							description: '(x, y): The x (pixels from left) and y (pixels from top) coordinates',
						},
						button: {
							type: 'string',
							enum: ['left', 'right', 'middle', 'double'],
							description: 'Mouse button to click (default: left)',
						},
						window: {
							type: ['string', 'number'],
							description: 'Window ID to target (optional)',
						},
					},
					required: [],
				},
			},
			{
				name: 'mouse_drag',
				description: 'Click and drag the cursor to a specified location',
				inputSchema: {
					type: 'object',
					properties: {
						coordinate: {
							type: 'array',
							items: {type: 'number'},
							minItems: 2,
							maxItems: 2,
							description: '(x, y): The x (pixels from left) and y (pixels from top) coordinates to drag to',
						},
						window: {
							type: ['string', 'number'],
							description: 'Window ID to target (optional)',
						},
					},
					required: ['coordinate'],
				},
			},
			{
				name: 'mouse_double_click',
				description: 'Double-click the left mouse button',
				inputSchema: {
					type: 'object',
					properties: {
						coordinate: {
							type: 'array',
							items: {type: 'number'},
							minItems: 2,
							maxItems: 2,
							description: '(x, y): The x (pixels from left) and y (pixels from top) coordinates',
						},
						window: {
							type: ['string', 'number'],
							description: 'Window ID to target (optional)',
						},
					},
					required: [],
				},
			},
			{
				name: 'mouse_right_click',
				description: 'Click the right mouse button',
				inputSchema: {
					type: 'object',
					properties: {
						coordinate: {
							type: 'array',
							items: {type: 'number'},
							minItems: 2,
							maxItems: 2,
							description: '(x, y): The x (pixels from left) and y (pixels from top) coordinates',
						},
						window: {
							type: ['string', 'number'],
							description: 'Window ID to target (optional)',
						},
					},
					required: [],
				},
			},
			{
				name: 'mouse_middle_click',
				description: 'Click the middle mouse button',
				inputSchema: {
					type: 'object',
					properties: {
						coordinate: {
							type: 'array',
							items: {type: 'number'},
							minItems: 2,
							maxItems: 2,
							description: '(x, y): The x (pixels from left) and y (pixels from top) coordinates',
						},
						window: {
							type: ['string', 'number'],
							description: 'Window ID to target (optional)',
						},
					},
					required: [],
				},
			},
			{
				name: 'mouse_position',
				description: 'Get the current (x, y) pixel coordinate of the cursor',
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
		const mouseParams = params as MouseActionParams;

		// TODO: Handle window targeting if window parameter is specified
		if (mouseParams.window) {
			// Window focus logic would be implemented here
		}

		switch (action) {
			case 'mouse_move': {
				return this.handleMouseMove(mouseParams);
			}

			case 'mouse_click': {
				return this.handleMouseClick(mouseParams);
			}

			case 'mouse_drag': {
				return this.handleMouseDrag(mouseParams);
			}

			case 'mouse_double_click': {
				return this.handleMouseDoubleClick(mouseParams);
			}

			case 'mouse_right_click': {
				return this.handleMouseRightClick(mouseParams);
			}

			case 'mouse_middle_click': {
				return this.handleMouseMiddleClick(mouseParams);
			}

			case 'mouse_position': {
				return this.handleMousePosition(mouseParams);
			}

			default: {
				throw new Error(`Unknown mouse action: ${action}`);
			}
		}
	}

	private async handleMouseMove(params: MouseActionParams): Promise<ToolResponse> {
		const {coordinate} = params;

		if (!coordinate) {
			throw new Error('coordinate is required for mouse_move');
		}

		await mouse.setPosition(new Point(coordinate[0], coordinate[1]));

		// Get screenshot after mouse move
		const screenshot = await handleScreenshot();

		return {
			content: [
				{
					type: 'text' as const,
					text: `Moved cursor to: (${coordinate[0]}, ${coordinate[1]})`,
				},
				...screenshot.content,
			] as ToolResponse['content'],
		};
	}

	private async handleMouseClick(params: MouseActionParams): Promise<ToolResponse> {
		const {coordinate, button = 'left'} = params;

		if (coordinate) {
			await mouse.setPosition(new Point(coordinate[0], coordinate[1]));
		}

		switch (button) {
			case 'left': {
				await mouse.leftClick();
				break;
			}

			case 'right': {
				await mouse.rightClick();
				break;
			}

			case 'middle': {
				await mouse.click(Button.MIDDLE);
				break;
			}

			case 'double': {
				await mouse.doubleClick(Button.LEFT);
				break;
			}
		}

		// Get screenshot after click
		const screenshot = await handleScreenshot();

		const buttonText = button === 'double' ? 'Double clicked' : `${button} clicked`;

		return {
			content: [
				{
					type: 'text' as const,
					text: buttonText,
				},
				...screenshot.content,
			] as ToolResponse['content'],
		};
	}

	private async handleMouseDrag(params: MouseActionParams): Promise<ToolResponse> {
		const {coordinate} = params;

		if (!coordinate) {
			throw new Error('coordinate is required for mouse_drag');
		}

		await mouse.pressButton(Button.LEFT);
		await mouse.setPosition(new Point(coordinate[0], coordinate[1]));
		await mouse.releaseButton(Button.LEFT);

		// Get screenshot after drag
		const screenshot = await handleScreenshot();

		return {
			content: [
				{
					type: 'text' as const,
					text: `Dragged to: (${coordinate[0]}, ${coordinate[1]})`,
				},
				...screenshot.content,
			] as ToolResponse['content'],
		};
	}

	private async handleMouseDoubleClick(params: MouseActionParams): Promise<ToolResponse> {
		const {coordinate} = params;

		if (coordinate) {
			await mouse.setPosition(new Point(coordinate[0], coordinate[1]));
		}

		await mouse.doubleClick(Button.LEFT);

		// Get screenshot after double click
		const screenshot = await handleScreenshot();

		return {
			content: [
				{
					type: 'text' as const,
					text: 'Double clicked',
				},
				...screenshot.content,
			] as ToolResponse['content'],
		};
	}

	private async handleMouseRightClick(params: MouseActionParams): Promise<ToolResponse> {
		const {coordinate} = params;

		if (coordinate) {
			await mouse.setPosition(new Point(coordinate[0], coordinate[1]));
		}

		await mouse.rightClick();

		// Get screenshot after right click
		const screenshot = await handleScreenshot();

		return {
			content: [
				{
					type: 'text' as const,
					text: 'Right clicked',
				},
				...screenshot.content,
			] as ToolResponse['content'],
		};
	}

	private async handleMouseMiddleClick(params: MouseActionParams): Promise<ToolResponse> {
		const {coordinate} = params;

		if (coordinate) {
			await mouse.setPosition(new Point(coordinate[0], coordinate[1]));
		}

		await mouse.click(Button.MIDDLE);

		// Get screenshot after middle click
		const screenshot = await handleScreenshot();

		return {
			content: [
				{
					type: 'text' as const,
					text: 'Middle clicked',
				},
				...screenshot.content,
			] as ToolResponse['content'],
		};
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	private async handleMousePosition(params: MouseActionParams): Promise<ToolResponse> {
		const pos = await mouse.getPosition();
		return {
			content: [{type: 'text', text: JSON.stringify({x: pos.x, y: pos.y})}],
		};
	}
}
