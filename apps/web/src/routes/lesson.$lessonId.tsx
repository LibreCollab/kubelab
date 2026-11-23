import { getLesson, type Lesson } from "@kubelab/content";
import { type Pod, SimEngine } from "@kubelab/sim";
import { Button } from "@kubelab/ui";
import { Link, useParams } from "@tanstack/react-router";
import { marked } from "marked";
import { useEffect, useMemo, useReducer, useState } from "react";

import { Terminal } from "../components/Terminal";
import { evaluateChecks } from "../lib/checks";
import styles from "./lesson.module.scss";

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

  const execute = (input: string): string => {
    const result = engine.execute(input);
    forceUpdate();
    return result.output;
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

  const pods = engine.store.list<Pod>("Pod");
  const checks = evaluateChecks(lesson.checks, pods);

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

        <section className={styles.terminalPanel}>
          <h2 className={styles.srOnly}>Simulated cluster terminal</h2>
          <div className={styles.terminalHead}>
            <span className={styles.dot} aria-hidden="true" />
            <span>cluster: kubelab</span>
            <span className={`${styles.liveStatus} ${running ? "" : styles.paused}`}>
              {running ? "live" : "paused"}
            </span>
          </div>
          <Terminal execute={execute} />
          <p className={styles.hint}>
            Simulated cluster · {lesson.scenario.nodes.length} node · commands never leave your
            browser.
          </p>
        </section>
      </div>
    </div>
  );
}
