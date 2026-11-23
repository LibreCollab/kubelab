import { describe, expect, it } from "vitest";

import { LineEditor } from "./line-editor";

describe("line editor", () => {
  it("inserts at the cursor", () => {
    const editor = new LineEditor();
    editor.insert("kubectl get pods");
    editor.moveHome();
    editor.insert("sudo ");

    expect(editor.value).toBe("sudo kubectl get pods");
    expect(editor.cursor).toBe(5);
  });

  it("backspaces and deletes forward", () => {
    const editor = new LineEditor();
    editor.reset("kubectl get podx");

    editor.backspace();
    expect(editor.value).toBe("kubectl get pod");

    editor.moveHome();
    editor.deleteForward();
    expect(editor.value).toBe("ubectl get pod");
  });

  it("moves by words", () => {
    const editor = new LineEditor();
    editor.reset("kubectl get pods");

    editor.moveWordLeft();
    expect(editor.cursor).toBe(12);
    editor.moveWordLeft();
    expect(editor.cursor).toBe(8);
    editor.moveWordRight();
    expect(editor.cursor).toBe(11);
  });

  it("deletes the previous word", () => {
    const editor = new LineEditor();
    editor.reset("kubectl get pods");

    editor.deleteWordBefore();
    expect(editor.value).toBe("kubectl get ");
  });

  it("deletes to start and end", () => {
    const editor = new LineEditor();
    editor.reset("kubectl get pods");
    editor.moveWordLeft();
    editor.deleteToStart();
    expect(editor.value).toBe("pods");

    editor.moveEnd();
    editor.deleteToEnd();
    expect(editor.value).toBe("pods");
  });

  it("resets with the cursor at the end", () => {
    const editor = new LineEditor();
    editor.reset("kubectl get nodes");
    expect(editor.cursor).toBe(editor.value.length);
  });
});
