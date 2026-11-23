import { curriculumLessons, getLesson, type Lesson } from "@kubelab/content";
import {
  type KubeDeployment,
  type KubeNode,
  type KubeReplicaSet,
  type KubeService,
  type Pod,
  SimEngine,
} from "@kubelab/sim";
import { Button, cx } from "@kubelab/ui";
import { Link, useParams } from "@tanstack/react-router";
import { marked } from "marked";
import { useEffect, useMemo, useReducer, useState } from "react";

import { ClusterMap } from "../components/ClusterMap";
import { Terminal } from "../components/Terminal";
import { type CheckResult, evaluateChecks } from "../lib/checks";
import { guardLessonCommand } from "../lib/lesson-guard";
import { nextLessonId } from "../lib/progress";
import { useProgress } from "../lib/progress-context";
import styles from "./lesson.module.scss";

function checkpointStatus(checks: CheckResult[]): string {
  const passed = checks.filter((check) => check.pass).length;
  const pending = checks.filter((check) => !check.pass).map((check) => check.label);

  return pending.length === 0
    ? `[checkpoint] complete (${passed}/${checks.length})`
    : `[checkpoint] ${passed}/${checks.length} — next: ${pending[0] ?? ""}`;
}

interface CheckpointFeedbackProps {
  allPassed: boolean;
  passedCount: number;
  total: number;
  nextCheck: string;
  pendingCount: number;
  hints: string[];
  inline?: boolean;
}

function CheckpointFeedback({
  allPassed,
  passedCount,
  total,
  nextCheck,
  pendingCount,
  hints,
  inline = false,
}: CheckpointFeedbackProps) {
  return (
    <div
      className={cx(styles.feedback, inline && styles.feedbackInline)}
      data-feedback={allPassed ? "pass" : "pending"}
      data-next-check={nextCheck}
      aria-live="polite"
    >
      <div className={styles.feedbackRow}>
        <span className={styles.feedbackCount}>
          {passedCount}/{total}
        </span>
        <span className={styles.feedbackText}>
          {allPassed ? "All checks passed" : `Next: ${nextCheck}`}
        </span>
        {!allPassed ? <span className={styles.feedbackRemaining}>{pendingCount} left</span> : null}
      </div>
      <div className={styles.feedbackMeter} aria-hidden="true">
        <span
          className={styles.feedbackMeterFill}
          style={{ width: `${(passedCount / total) * 100}%` }}
        />
      </div>
      {!allPassed && hints.length > 0 ? (
        <details className={styles.feedbackHints}>
          <summary>Need a hint?</summary>
          <ul>
            {hints.map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
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
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [, forceUpdate] = useReducer((value: number) => value + 1, 0);
  const { rows, startLesson, saveAnswers, completeLesson } = useProgress();
  const savedAnswers = rows[lesson.id]?.answers;
  const completed = rows[lesson.id]?.status === "completed";

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

  const interactive = lesson.checks.some((check) => check.type !== "quiz");
  const timed = lesson.checks.some(
    (check) => check.type === "pod" || check.type === "deployment" || check.type === "service",
  );

  useEffect(() => {
    if (savedAnswers !== undefined) {
      setAnswers(savedAnswers);
    }
  }, [savedAnswers]);

  useEffect(() => {
    void startLesson(lesson.id);
  }, [lesson.id, startLesson]);

  useEffect(() => {
    if (!interactive) {
      return;
    }

    const unsubscribe = engine.clock.onTick(() => {
      forceUpdate();
    });
    engine.start();
    setRunning(true);

    return () => {
      unsubscribe();
      engine.pause();
    };
  }, [engine, interactive]);

  const readChecks = () =>
    evaluateChecks(lesson.checks, {
      pods: engine.store.list<Pod>("Pod"),
      deployments: engine.store.list<KubeDeployment>("Deployment"),
      services: engine.store.list<KubeService>("Service"),
      commands: engine.commands,
      answers,
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
  const quizChecks = lesson.checks.filter((check) => check.type === "quiz");
  const nextId = nextLessonId(lesson.id, curriculumLessons);
  const nextLesson = nextId === undefined ? undefined : getLesson(nextId);

  useEffect(() => {
    if (allPassed && !completed) {
      void completeLesson(lesson.id, lesson.xp);
    }
  }, [allPassed, completed, completeLesson, lesson.id, lesson.xp]);

  const chooseAnswer = (quizId: string, index: number) => {
    const next = { ...answers, [quizId]: index };
    setAnswers(next);
    void saveAnswers(lesson.id, next);
  };

  const theoryHtml = useMemo(
    () => marked.parse(lesson.theoryMarkdown, { async: false }) as string,
    [lesson.theoryMarkdown],
  );

  return (
    <div className={cx(styles.page, !interactive && styles.singleColumnPage)}>
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
        {timed ? (
          <div className={styles.controls}>
            <Button variant="secondary" size="sm" onClick={toggleClock}>
              {running ? "Pause clock" : "Resume clock"}
            </Button>
            <Button variant="ghost" size="sm" onClick={stepClock}>
              Step
            </Button>
          </div>
        ) : null}
      </div>

      <div className={cx(styles.layout, !interactive && styles.singleColumn)}>
        <article className={styles.panel}>
          {/* biome-ignore lint/security/noDangerouslySetInnerHtml: lesson Markdown is trusted, in-repo content */}
          <div className={styles.theory} dangerouslySetInnerHTML={{ __html: theoryHtml }} />
          {quizChecks.length > 0 ? (
            <section className={styles.quiz}>
              <h2>Knowledge check</h2>
              {quizChecks.map((quiz) => (
                <fieldset key={quiz.id} className={styles.quizQuestion}>
                  <legend>{quiz.question}</legend>
                  <div className={styles.quizOptions}>
                    {quiz.options.map((option, index) => {
                      const selected = answers[quiz.id] === index;
                      return (
                        <label
                          key={option}
                          className={cx(styles.quizOption, selected && styles.quizSelected)}
                        >
                          <input
                            className={styles.quizRadio}
                            type="radio"
                            name={quiz.id}
                            checked={selected}
                            onChange={() => chooseAnswer(quiz.id, index)}
                          />
                          <span className={styles.quizKey} aria-hidden="true">
                            {String.fromCharCode(65 + index)}
                          </span>
                          <span>{option}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </section>
          ) : null}
          <div className={styles.objectives}>
            <div className={styles.objectivesHead}>
              <h2>Checkpoint</h2>
              <span>
                {passedCount}/{checks.length}
              </span>
            </div>
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
          {!interactive ? (
            <CheckpointFeedback
              allPassed={allPassed}
              passedCount={passedCount}
              total={checks.length}
              nextCheck={nextCheck}
              pendingCount={pendingLabels.length}
              hints={lesson.hints}
              inline
            />
          ) : null}
        </article>

        {interactive ? (
          <div className={styles.terminalRail}>
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
              <CheckpointFeedback
                allPassed={allPassed}
                passedCount={passedCount}
                total={checks.length}
                nextCheck={nextCheck}
                pendingCount={pendingLabels.length}
                hints={lesson.hints}
              />
              <p className={styles.hint}>
                Simulated cluster · {lesson.scenario.nodes.length} node · commands never leave your
                browser.
              </p>
            </section>
            <ClusterMap
              nodes={engine.store.list<KubeNode>("Node")}
              deployments={engine.store.list<KubeDeployment>("Deployment")}
              replicaSets={engine.store.list<KubeReplicaSet>("ReplicaSet")}
              pods={engine.store.list<Pod>("Pod")}
              services={engine.store.list<KubeService>("Service")}
            />
          </div>
        ) : null}
      </div>

      {completed ? (
        <div className={styles.completeBar}>
          <span>Lesson complete · +{lesson.xp} XP</span>
          {nextLesson ? (
            <Link
              className={styles.nextLesson}
              to="/lesson/$lessonId"
              params={{ lessonId: nextLesson.id }}
            >
              Next: {nextLesson.title}
            </Link>
          ) : (
            <Link className={styles.nextLesson} to="/">
              Back to roadmap
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}
