import {describe, it, expect} from 'vitest';
import {createErrorResponse, validateWindowId} from './error-response.js';

describe('Error Response Utilities', () => {
	describe('createErrorResponse', () => {
		it('should create structured error response from Error object', () => {
			const error = new Error('Test error message');
			const response = createErrorResponse(error, 'TestContext');

			expect(response.isError).toBe(true);
			expect(response.content).toHaveLength(1);
			expect(response.content[0]?.type).toBe('text');

			const parsedContent = JSON.parse(response.content[0]!.text!);
			expect(parsedContent.success).toBe(false);
			expect(parsedContent.error.name).toBe('Error');
			expect(parsedContent.error.message).toBe('Test error message');
			expect(parsedContent.error.context).toBe('TestContext');
			expect(parsedContent.error.stack).toBeDefined();
		});

		it('should create structured error response from string', () => {
			const response = createErrorResponse('Simple error', 'TestContext');

			expect(response.isError).toBe(true);
			const parsedContent = JSON.parse(response.content[0]!.text!);
			expect(parsedContent.error.message).toBe('Simple error');
			expect(parsedContent.error.name).toBe('Error');
		});

		it('should work without context', () => {
			const error = new Error('Test error');
			const response = createErrorResponse(error);

			const parsedContent = JSON.parse(response.content[0]!.text!);
			expect(parsedContent.error.context).toBeUndefined();
		});
	});

	describe('validateWindowId', () => {
		it('should not throw for valid window ID', () => {
			expect(() => validateWindowId(0, 5)).not.toThrow();
			expect(() => validateWindowId(2, 5)).not.toThrow();
			expect(() => validateWindowId(4, 5)).not.toThrow();
		});

		it('should throw for NaN window ID', () => {
			expect(() => validateWindowId(Number.NaN, 5)).toThrow(
				'Invalid window ID: not a number',
			);
		});

		it('should throw for negative window ID', () => {
			expect(() => validateWindowId(-1, 5)).toThrow(
				'Invalid window ID: -1. Window ID cannot be negative',
			);
		});

		it('should throw for window ID exceeding max', () => {
			expect(() => validateWindowId(5, 5)).toThrow(
				'Invalid window ID: 5. Window ID exceeds available windows (5 windows found)',
			);
			expect(() => validateWindowId(10, 5)).toThrow(
				'Invalid window ID: 10. Window ID exceeds available windows (5 windows found)',
			);
		});

		it('should include valid range in error messages', () => {
			expect(() => validateWindowId(10, 5)).toThrow('Valid range: 0-4');
			expect(() => validateWindowId(-1, 3)).toThrow('Valid range: 0-2');
		});
	});
});
