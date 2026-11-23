import type { SimEvent } from "./types";

export class EventBus {
  #listeners = new Set<(event: SimEvent) => void>();

  on(listener: (event: SimEvent) => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  emit(event: SimEvent): void {
    for (const listener of this.#listeners) {
      listener(event);
    }
  }
}
