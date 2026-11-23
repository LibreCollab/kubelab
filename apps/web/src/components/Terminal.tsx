import { FitAddon } from "@xterm/addon-fit";
import { Terminal as XTerm } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef } from "react";

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
        background: "#050a14",
        foreground: "#d6e2f5",
        cursor: "#7aa8ff",
        selectionBackground: "#1f3a68",
        black: "#050a14",
        brightBlack: "#5b6b85",
        green: "#3ddc97",
        yellow: "#ffc857",
        red: "#ff6b6b",
        blue: "#7aa8ff",
        magenta: "#c792ea",
        cyan: "#6fd3ff",
        white: "#e8eef9",
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

    let buffer = "";

    const writePrompt = () => {
      terminal.write(`\x1b[38;5;111m${promptRef.current}\x1b[0m `);
    };

    terminal.writeln("Kubelab simulated cluster — type `kubectl help` to begin.");
    writePrompt();

    const dataSubscription = terminal.onData((data) => {
      if (data === "\r") {
        const input = buffer.trim();
        buffer = "";
        terminal.write("\r\n");

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

        writePrompt();
        return;
      }

      if (data === "\u007f") {
        if (buffer.length > 0) {
          buffer = buffer.slice(0, -1);
          terminal.write("\b \b");
        }
        return;
      }

      if (data === "\u0003") {
        buffer = "";
        terminal.write("^C\r\n");
        writePrompt();
        return;
      }

      if (data === "\u000c") {
        terminal.clear();
        writePrompt();
        return;
      }

      if (data >= " ") {
        buffer += data;
        terminal.write(data);
      }
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
