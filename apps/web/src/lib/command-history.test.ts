import { describe, expect, it } from "vitest";

import { CommandHistory } from "./command-history";

describe("command history", () => {
  it("recalls entries from newest to oldest", () => {
    const history = new CommandHistory();
    history.push("kubectl get pods");
    history.push("kubectl get nodes");

    expect(history.previous("")).toBe("kubectl get nodes");
    expect(history.previous("")).toBe("kubectl get pods");
    expect(history.previous("")).toBe("kubectl get pods");
  });

  it("restores the draft after navigating forward", () => {
    const history = new CommandHistory();
    history.push("kubectl get pods");

    expect(history.previous("partially typed")).toBe("kubectl get pods");
    expect(history.next()).toBe("partially typed");
    expect(history.next()).toBeUndefined();
  });

  it("ignores empty commands", () => {
    const history = new CommandHistory();
    history.push("   ");
    expect(history.size).toBe(0);
    expect(history.previous("")).toBeUndefined();
  });

  it("starts a new navigation after a push", () => {
    const history = new CommandHistory();
    history.push("first");
    history.previous("");
    history.push("second");

    expect(history.previous("")).toBe("second");
    expect(history.previous("")).toBe("first");
  });
});
