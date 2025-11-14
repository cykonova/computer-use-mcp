/**
 * Simple dependency injection container for managing IO class instances
 */
export class DIContainer {
	private readonly instances = new Map<string, unknown>();

	/**
	 * Register an instance with a key
	 */
	register<T>(key: string, instance: T): void {
		this.instances.set(key, instance);
	}

	/**
	 * Resolve an instance by key
	 * @throws Error if key not found
	 */
	resolve<T>(key: string): T {
		const instance = this.instances.get(key);

		if (instance === undefined) {
			throw new Error(`No instance registered for key: ${key}`);
		}

		return instance as T;
	}

	/**
	 * Check if a key is registered
	 */
	has(key: string): boolean {
		return this.instances.has(key);
	}

	/**
	 * Get all registered instances
	 */
	getAll(): Map<string, unknown> {
		return new Map(this.instances);
	}

	/**
	 * Clear all registered instances
	 */
	clear(): void {
		this.instances.clear();
	}
}
