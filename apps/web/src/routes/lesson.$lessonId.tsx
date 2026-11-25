import { curriculumLessons, getLesson, type Lesson } from "@kubelab/content";
import {
  type KubeConfigMap,
  type KubeDeployment,
  type KubeIngress,
  type KubeNode,
  type KubeReplicaSet,
  type KubeSecret,
  type KubeService,
  type ParsedCommand,
  type Pod,
  SimEngine,
} from "@kubelab/sim";
import { cx } from "@kubelab/ui";
import { Link, useParams } from "@tanstack/react-router";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { AnimatePresence } from "motion/react";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";

import { ClusterMap } from "../components/ClusterMap";
import { ClusterScene } from "../components/ClusterScene";
import { Terminal } from "../components/Terminal";
import { type CheckResult, evaluateChecks } from "../lib/checks";
import { type ChangeScene, captureSnapshot, snapshotChanged } from "../lib/cluster-snapshot";
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
  standalone?: boolean;
}

function CheckpointFeedback({
  allPassed,
  passedCount,
  total,
  nextCheck,
  pendingCount,
  hints,
  inline = false,
  standalone = false,
}: CheckpointFeedbackProps) {
  return (
    <div
      className={cx(
        styles.feedback,
        inline && styles.feedbackInline,
        standalone && styles.feedbackStandalone,
      )}
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

function mutatesCluster(command: ParsedCommand): boolean {
  if (command.verb === "run" || command.verb === "create" || command.verb === "expose") {
    return true;
  }
  if (
    command.verb === "scale" ||
    command.verb === "set" ||
    command.verb === "delete" ||
    command.verb === "apply"
  ) {
    return true;
  }
  return command.verb === "rollout" && command.action === "undo";
}

function LessonPlayer({ lesson }: { lesson: Lesson }) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [clusterOpen, setClusterOpen] = useState(false);
  const [scene, setScene] = useState<ChangeScene | null>(null);
  const sceneRef = useRef<ChangeScene | null>(null);
  const sceneTicksRef = useRef(0);
  const sceneIdRef = useRef(0);
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
        ...(node.labels === undefined ? {} : { labels: node.labels }),
        ...(node.taints === undefined
          ? {}
          : {
              taints: node.taints.map((taint) => ({
                key: taint.key,
                effect: taint.effect,
                ...(taint.value === undefined ? {} : { value: taint.value }),
              })),
            }),
      })),
      objects: lesson.scenario.objects,
      files: lesson.scenario.files,
    });
    return instance;
  }, [lesson]);

  const interactive = lesson.checks.some((check) => check.type !== "quiz");

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
      const active = sceneRef.current;
      if (active !== null && sceneTicksRef.current < 4) {
        const last = active.frames[active.frames.length - 1];
        const nextFrame = captureSnapshot(engine);
        if (last !== undefined && snapshotChanged(last, nextFrame)) {
          const nextScene = { ...active, frames: [...active.frames, nextFrame] };
          sceneRef.current = nextScene;
          setScene(nextScene);
        }
        sceneTicksRef.current += 1;
      }
      forceUpdate();
    });
    engine.start();

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
      ingresses: engine.store.list<KubeIngress>("Ingress"),
      configMaps: engine.store.list<KubeConfigMap>("ConfigMap"),
      secrets: engine.store.list<KubeSecret>("Secret"),
      commands: engine.commands,
      answers,
    });

  const closeScene = () => {
    sceneRef.current = null;
    sceneTicksRef.current = 0;
    setScene(null);
  };

  const followLogs = (input: string, write: (line: string) => void) =>
    engine.followLogs(input, write);

  const execute = (input: string): string => {
    if (lesson.strict) {
      const guard = guardLessonCommand(input, lesson.checks);
      if (!guard.ok) {
        const nextChecks = readChecks();
        forceUpdate();
        return `${guard.error}\n${checkpointStatus(nextChecks)}`;
      }
    }

    const before = captureSnapshot(engine);
    const result = engine.execute(input);
    const executed = engine.commands[engine.commands.length - 1];
    if (result.ok && executed !== undefined && mutatesCluster(executed)) {
      const after = captureSnapshot(engine);
      if (snapshotChanged(before, after)) {
        sceneIdRef.current += 1;
        const nextScene = {
          id: sceneIdRef.current,
          command: input,
          frames: [before, after],
        };
        sceneRef.current = nextScene;
        sceneTicksRef.current = 0;
        setScene(nextScene);
      }
    }
    const status = checkpointStatus(readChecks());

    forceUpdate();
    return `${result.output}\n${status}`;
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
    () => DOMPurify.sanitize(marked.parse(lesson.theoryMarkdown, { async: false }) as string),
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
      </div>

      <div className={cx(styles.layout, !interactive && styles.singleColumn)}>
        <article className={styles.panel}>
          {/* biome-ignore lint/security/noDangerouslySetInnerHtml: HTML is sanitized with DOMPurify */}
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
                <span className={styles.liveStatus}>live</span>
                <ClusterMap
                  nodes={engine.store.list<KubeNode>("Node")}
                  deployments={engine.store.list<KubeDeployment>("Deployment")}
                  replicaSets={engine.store.list<KubeReplicaSet>("ReplicaSet")}
                  pods={engine.store.list<Pod>("Pod")}
                  services={engine.store.list<KubeService>("Service")}
                  ingresses={engine.store.list<KubeIngress>("Ingress")}
                  configMaps={engine.store.list<KubeConfigMap>("ConfigMap")}
                  secrets={engine.store.list<KubeSecret>("Secret")}
                  open={clusterOpen}
                  onOpenChange={(nextOpen) => {
                    setClusterOpen(nextOpen);
                    if (nextOpen) {
                      closeScene();
                    }
                  }}
                />
              </div>
              <Terminal execute={execute} follow={followLogs} />
              <p className={styles.hint}>
                Simulated cluster · {lesson.scenario.nodes.length} node · commands never leave your
                browser.
              </p>
            </section>
            <CheckpointFeedback
              allPassed={allPassed}
              passedCount={passedCount}
              total={checks.length}
              nextCheck={nextCheck}
              pendingCount={pendingLabels.length}
              hints={lesson.hints}
              standalone
            />
          </div>
        ) : null}
      </div>

      <AnimatePresence>
        {scene !== null ? (
          <ClusterScene
            key={scene.id}
            scene={scene}
            onClose={closeScene}
            onOpenFull={() => {
              closeScene();
              setClusterOpen(true);
            }}
          />
        ) : null}
      </AnimatePresence>

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
