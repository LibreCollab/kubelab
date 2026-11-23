import { getLesson, type Lesson } from "@kubelab/content";
import { type Pod, SimEngine } from "@kubelab/sim";
import { Button } from "@kubelab/ui";
import { Link, useParams } from "@tanstack/react-router";
import { marked } from "marked";
import { useEffect, useMemo, useReducer, useState } from "react";

import { Terminal } from "../components/Terminal";
import { type CheckResult, evaluateChecks } from "../lib/checks";
import { guardLessonCommand } from "../lib/lesson-guard";
import styles from "./lesson.module.scss";

function checkpointStatus(checks: CheckResult[]): string {
  const passed = checks.filter((check) => check.pass).length;
  const pending = checks.filter((check) => !check.pass).map((check) => check.label);

  return pending.length === 0
    ? `[checkpoint] complete (${passed}/${checks.length})`
    : `[checkpoint] ${passed}/${checks.length} — next: ${pending[0] ?? ""}`;
}

export function LessonPage() {
  const { lessonId } = useParams({ from: "/lesson/$lessonId" });
  const lesson = getLesson(lessonId);

  if (lesson === undefined) {
    return (
      <div className={styles.page}>
        <h1>Lesson not found</h1>
        <p className={styles.unit}>No lesson with id “{lessonId}”.</p>
        <Link to="/">Back to the roadmap</Link>
      </div>
    );
  }

  return <LessonPlayer key={lesson.id} lesson={lesson} />;
}

function LessonPlayer({ lesson }: { lesson: Lesson }) {
  const [running, setRunning] = useState(true);
  const [, forceUpdate] = useReducer((value: number) => value + 1, 0);

  const engine = useMemo(() => {
    const instance = new SimEngine({ intervalMs: 900 });
    instance.seed({
      nodes: lesson.scenario.nodes.map((node) => ({
        name: node.name,
        ...(node.cpu === undefined ? {} : { cpu: node.cpu }),
        ...(node.memory === undefined ? {} : { memory: node.memory }),
      })),
    });
    return instance;
  }, [lesson]);

  useEffect(() => {
    const unsubscribe = engine.clock.onTick(() => {
      forceUpdate();
    });
    engine.start();
    setRunning(true);

    return () => {
      unsubscribe();
      engine.pause();
    };
  }, [engine]);

  const readChecks = () =>
    evaluateChecks(lesson.checks, {
      pods: engine.store.list<Pod>("Pod"),
      commands: engine.commands,
    });

  const execute = (input: string): string => {
    if (lesson.strict) {
      const guard = guardLessonCommand(input, lesson.checks);
      if (!guard.ok) {
        const nextChecks = readChecks();
        forceUpdate();
        return `${guard.error}\n${checkpointStatus(nextChecks)}`;
      }
    }

    const result = engine.execute(input);
    const status = checkpointStatus(readChecks());

    forceUpdate();
    return `${result.output}\n${status}`;
  };

  const toggleClock = () => {
    if (running) {
      engine.pause();
      setRunning(false);
    } else {
      engine.start();
      setRunning(true);
    }
  };

  const stepClock = () => {
    if (running) {
      engine.pause();
      setRunning(false);
    }
    engine.step();
    forceUpdate();
  };

  const checks = readChecks();
  const passedCount = checks.filter((check) => check.pass).length;
  const pendingLabels = checks.filter((check) => !check.pass).map((check) => check.label);
  const allPassed = pendingLabels.length === 0;
  const nextCheck = pendingLabels[0] ?? "";

  const theoryHtml = useMemo(
    () => marked.parse(lesson.theoryMarkdown, { async: false }) as string,
    [lesson.theoryMarkdown],
  );

  return (
    <div className={styles.page}>
      <Link to="/" className={styles.back}>
        ← Roadmap
      </Link>

      <div className={styles.heading}>
        <div>
          <p className={styles.unit}>
            {lesson.unit} · {lesson.xp} XP
          </p>
          <h1>{lesson.title}</h1>
        </div>
        <div className={styles.controls}>
          <Button variant="secondary" size="sm" onClick={toggleClock}>
            {running ? "Pause clock" : "Resume clock"}
          </Button>
          <Button variant="ghost" size="sm" onClick={stepClock}>
            Step
          </Button>
        </div>
      </div>

      <div className={styles.layout}>
        <article className={styles.panel}>
          {/* biome-ignore lint/security/noDangerouslySetInnerHtml: lesson Markdown is trusted, in-repo content */}
          <div className={styles.theory} dangerouslySetInnerHTML={{ __html: theoryHtml }} />
          <div className={styles.objectives}>
            <h2>Checkpoint</h2>
            <ul aria-live="polite">
              {checks.map((check) => (
                <li
                  key={check.label}
                  data-check={check.label}
                  data-state={check.pass ? "pass" : "pending"}
                  className={check.pass ? styles.pass : ""}
                >
                  <span className={styles.check} aria-hidden="true">
                    {check.pass ? "✓" : ""}
                  </span>
                  <span>{check.label}</span>
                  <span className={styles.srOnly}>{check.pass ? "passed" : "pending"}</span>
                </li>
              ))}
            </ul>
          </div>
        </article>

        <section className={styles.terminalPanel} data-testid="terminal-panel">
          <h2 className={styles.srOnly}>Simulated cluster terminal</h2>
          <div className={styles.terminalHead}>
            <span className={styles.dot} aria-hidden="true" />
            <span>cluster: kubelab</span>
            <span className={`${styles.liveStatus} ${running ? "" : styles.paused}`}>
              {running ? "live" : "paused"}
            </span>
          </div>
          <Terminal execute={execute} />
          <div
            className={styles.feedback}
            data-feedback={allPassed ? "pass" : "pending"}
            data-next-check={nextCheck}
            aria-live="polite"
          >
            <div className={styles.feedbackRow}>
              <span className={styles.feedbackCount}>
                {passedCount}/{checks.length}
              </span>
              <span className={styles.feedbackText}>
                {allPassed ? "All checks passed" : `Next: ${nextCheck}`}
              </span>
              {!allPassed ? (
                <span className={styles.feedbackRemaining}>{pendingLabels.length} left</span>
              ) : null}
            </div>
            <div className={styles.feedbackMeter} aria-hidden="true">
              <span
                className={styles.feedbackMeterFill}
                style={{ width: `${(passedCount / checks.length) * 100}%` }}
              />
            </div>
            {!allPassed && lesson.hints.length > 0 ? (
              <details className={styles.feedbackHints}>
                <summary>Need a hint?</summary>
                <ul>
                  {lesson.hints.map((hint) => (
                    <li key={hint}>{hint}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
          <p className={styles.hint}>
            Simulated cluster · {lesson.scenario.nodes.length} node · commands never leave your
            browser.
          </p>
        </section>
      </div>
    </div>
  );
}
