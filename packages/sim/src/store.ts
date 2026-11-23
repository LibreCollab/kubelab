import type { KubeObject } from "./types";

export class ClusterStore {
  #objects = new Map<string, KubeObject>();
  #resourceVersion = 0;

  #key(kind: string, namespace: string, name: string): string {
    return `${kind}/${namespace}/${name}`;
  }

  upsert<T extends KubeObject>(object: T): T {
    const stored: T = {
      ...object,
      metadata: {
        ...object.metadata,
        resourceVersion: ++this.#resourceVersion,
      },
    };

    this.#objects.set(
      this.#key(stored.kind, stored.metadata.namespace, stored.metadata.name),
      stored,
    );

    return stored;
  }

  get<T extends KubeObject>(kind: string, name: string, namespace = "default"): T | undefined {
    return this.#objects.get(this.#key(kind, namespace, name)) as T | undefined;
  }

  list<T extends KubeObject>(kind: string, namespace?: string): T[] {
    return [...this.#objects.values()].filter(
      (object) =>
        object.kind === kind &&
        (namespace === undefined || object.metadata.namespace === namespace),
    ) as T[];
  }

  delete(kind: string, name: string, namespace = "default"): boolean {
    return this.#objects.delete(this.#key(kind, namespace, name));
  }
}
