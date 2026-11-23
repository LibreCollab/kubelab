export type TickListener = (tick: number) => void;

export class VirtualClock {
  #tick = 0;
  #intervalMs: number;
  #timer: ReturnType<typeof setInterval> | undefined;
  #listeners = new Set<TickListener>();

  constructor(intervalMs = 500) {
    this.#intervalMs = intervalMs;
  }

  get tick(): number {
    return this.#tick;
  }

  get running(): boolean {
    return this.#timer !== undefined;
  }

  onTick(listener: TickListener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  start(): void {
    if (this.#timer !== undefined) {
      return;
    }

    this.#timer = setInterval(() => {
      this.advance();
    }, this.#intervalMs);
  }

  stop(): void {
    if (this.#timer !== undefined) {
      clearInterval(this.#timer);
      this.#timer = undefined;
    }
  }

  advance(): void {
    this.#tick += 1;
    for (const listener of this.#listeners) {
      listener(this.#tick);
    }
  }

  reset(): void {
    this.stop();
    this.#tick = 0;
  }
}
