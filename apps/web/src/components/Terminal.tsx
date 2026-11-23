import { FitAddon } from "@xterm/addon-fit";
import { Terminal as XTerm } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef } from "react";

import { CommandHistory } from "../lib/command-history";
import { LineEditor } from "../lib/line-editor";
import styles from "./terminal.module.scss";

export interface TerminalProps {
  execute: (input: string) => string;
  prompt?: string;
}

const FONT_FAMILY = '"JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, monospace';

export function Terminal({ execute, prompt = "kubelab@cluster:~$" }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const executeRef = useRef(execute);
  const promptRef = useRef(prompt);

  executeRef.current = execute;
  promptRef.current = prompt;

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }

    const terminal = new XTerm({
      convertEol: true,
      cursorBlink: true,
      fontFamily: FONT_FAMILY,
      fontSize: 13,
      lineHeight: 1.4,
      scrollback: 2000,
      theme: {
        background: "#10131b",
        foreground: "#edf2f7",
        cursor: "#4ad99b",
        selectionBackground: "#2d3748",
        black: "#171923",
        brightBlack: "#718096",
        green: "#4ad99b",
        yellow: "#f1c40f",
        red: "#ff2d55",
        blue: "#5ac8fa",
        magenta: "#bb86fc",
        cyan: "#5ac8fa",
        white: "#edf2f7",
      },
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);

    let disposed = false;

    const safeFit = () => {
      if (disposed || container.clientWidth === 0 || container.clientHeight === 0) {
        return;
      }
      try {
        fitAddon.fit();
      } catch {
        // The terminal can be disposed between an observer callback and this call.
      }
    };

    requestAnimationFrame(safeFit);

    const history = new CommandHistory();
    const editor = new LineEditor();

    const promptText = () => `\x1b[38;2;74;217;155m${promptRef.current}\x1b[0m `;

    const render = () => {
      const remaining = editor.value.length - editor.cursor;
      terminal.write(
        `\r${promptText()}${editor.value}\x1b[K${remaining > 0 ? `\x1b[${remaining}D` : ""}`,
      );
    };

    const insert = (text: string) => {
      const printable = [...text]
        .filter((character) => {
          const code = character.codePointAt(0) ?? 0;
          return code >= 0x20 && code !== 0x7f;
        })
        .join("");

      if (printable.length === 0) {
        return;
      }
      editor.insert(printable);
      render();
    };

    const recall = (value: string | undefined) => {
      if (value === undefined) {
        return;
      }
      editor.reset(value);
      render();
    };

    const submit = () => {
      const input = editor.value.trim();
      const trailing = editor.value.length - editor.cursor;

      if (trailing > 0) {
        terminal.write(`\x1b[${trailing}C`);
      }
      terminal.write("\r\n");

      history.push(input);
      editor.reset();

      if (input.length > 0) {
        let output: string;
        try {
          output = executeRef.current(input);
        } catch (error) {
          output = `error: ${error instanceof Error ? error.message : "command failed"}`;
        }
        for (const line of output.split("\n")) {
          terminal.writeln(line);
        }
      }

      render();
    };

    terminal.writeln("Kubelab simulated cluster — type `kubectl help` to begin.");
    render();

    const dataSubscription = terminal.onData((data) => {
      if (data === "\x1b[A" || data === "\x1bOA" || data === "\u0010") {
        recall(history.previous(editor.value));
        return;
      }

      if (data === "\x1b[B" || data === "\x1bOB" || data === "\u000e") {
        recall(history.next());
        return;
      }

      if (data === "\r") {
        submit();
        return;
      }

      if (data === "\x7f" || data === "\b") {
        editor.backspace();
        render();
        return;
      }

      if (data === "\x1b[3~") {
        editor.deleteForward();
        render();
        return;
      }

      if (data === "\x1b[D" || data === "\x1bOD" || data === "\u0002") {
        editor.moveLeft();
        render();
        return;
      }

      if (data === "\x1b[C" || data === "\x1bOC" || data === "\u0006") {
        editor.moveRight();
        render();
        return;
      }

      if (data === "\x1b[1;5D" || data === "\x1b[5D" || data === "\x1b[1;3D" || data === "\x1bb") {
        editor.moveWordLeft();
        render();
        return;
      }

      if (data === "\x1b[1;5C" || data === "\x1b[5C" || data === "\x1b[1;3C" || data === "\x1bf") {
        editor.moveWordRight();
        render();
        return;
      }

      if (data === "\x1b[H" || data === "\x1b[1~" || data === "\x1bOH" || data === "\u0001") {
        editor.moveHome();
        render();
        return;
      }

      if (data === "\x1b[F" || data === "\x1b[4~" || data === "\x1bOF" || data === "\u0005") {
        editor.moveEnd();
        render();
        return;
      }

      if (data === "\u0017" || data === "\x1b\x7f") {
        editor.deleteWordBefore();
        render();
        return;
      }

      if (data === "\u0015") {
        editor.deleteToStart();
        render();
        return;
      }

      if (data === "\u000b") {
        editor.deleteToEnd();
        render();
        return;
      }

      if (data === "\u0003") {
        editor.reset();
        terminal.write("^C\r\n");
        render();
        return;
      }

      if (data === "\u000c") {
        terminal.clear();
        render();
        return;
      }

      if (data.startsWith("\x1b[200~")) {
        const close = "\x1b[201~";
        const pasted = data.slice("\x1b[200~".length);
        insert(pasted.endsWith(close) ? pasted.slice(0, -close.length) : pasted);
        return;
      }

      if (data === "\x1b[201~" || data.startsWith("\x1b")) {
        return;
      }

      insert(data);
    });

    const observer = new ResizeObserver(() => {
      safeFit();
    });
    observer.observe(container);

    return () => {
      disposed = true;
      observer.disconnect();
      dataSubscription.dispose();
      terminal.dispose();
    };
  }, []);

  return <div ref={containerRef} className={styles.terminal} />;
}
