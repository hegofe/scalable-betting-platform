import type { Clock } from "../domain/clock";

interface Entry<V> {
  readonly value: V;
  readonly expiresAt: number;
}

export class ExpiringCache<V> {
  private readonly entries = new Map<string, Entry<V>>();

  constructor(
    private readonly clock: Clock,
    private readonly maxEntries: number,
  ) {}

  get(key: string): V | undefined {
    const entry = this.entries.get(key);
    if (entry === undefined) {
      return undefined;
    }
    if (entry.expiresAt <= this.clock().getTime()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: V, expiresAt: Date): void {
    this.entries.delete(key);
    if (this.entries.size >= this.maxEntries) {
      this.evict();
    }
    this.entries.set(key, { value, expiresAt: expiresAt.getTime() });
  }

  private evict(): void {
    const now = this.clock().getTime();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key);
      }
    }
    while (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done === true) {
        return;
      }
      this.entries.delete(oldest.value);
    }
  }
}
