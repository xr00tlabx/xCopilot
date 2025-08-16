/**
 * Simple LRU (Least Recently Used) Cache implementation
 * Optimized for inline code completion caching
 */
export class LRUCache<K, V> {
    private capacity: number;
    private cache: Map<K, V>;

    constructor(capacity: number = 100) {
        this.capacity = capacity;
        this.cache = new Map();
    }

    /**
     * Get value from cache
     */
    get(key: K): V | undefined {
        if (this.cache.has(key)) {
            // Move to end (most recently used)
            const value = this.cache.get(key);
            this.cache.delete(key);
            this.cache.set(key, value!);
            return value;
        }
        return undefined;
    }

    /**
     * Set value in cache
     */
    set(key: K, value: V): void {
        if (this.cache.has(key)) {
            // Update existing key
            this.cache.delete(key);
        } else if (this.cache.size >= this.capacity) {
            // Remove least recently used (first item)
            const firstKey = this.cache.keys().next().value;
            if (firstKey !== undefined) {
                this.cache.delete(firstKey);
            }
        }
        
        this.cache.set(key, value);
    }

    /**
     * Check if key exists in cache
     */
    has(key: K): boolean {
        return this.cache.has(key);
    }

    /**
     * Clear all cache entries
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Delete a specific key from cache
     */
    delete(key: K): boolean {
        return this.cache.delete(key);
    }

    /**
     * Get current cache size
     */
    size(): number {
        return this.cache.size;
    }

    /**
     * Get cache statistics
     */
    stats(): { size: number; capacity: number; utilization: number } {
        return {
            size: this.cache.size,
            capacity: this.capacity,
            utilization: (this.cache.size / this.capacity) * 100
        };
    }
}