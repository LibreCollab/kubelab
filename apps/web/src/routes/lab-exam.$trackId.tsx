import { type ExamTask, getCertificationExam } from "@kubelab/content";
import {
  type KubeConfigMap,
  type KubeDeployment,
  type KubeIngress,
  type KubeSecret,
  type KubeService,
  type Pod,
  SimEngine,
} from "@kubelab/sim";
import { Button, cx } from "@kubelab/ui";
import { Link, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";

import { Terminal } from "../components/Terminal";
import { type LabTaskResult, saveLabExamAttempt } from "../lib/certification";
import { type CheckResult, evaluateChecks } from "../lib/checks";
import styles from "./certification.module.scss";

interface TaskRuntime {
  task: ExamTask;
  engine: SimEngine;
}

interface LabResult {
  percent: number;
  passed: boolean;
  passedChecks: number;
  totalChecks: number;
  taskResults: Array<LabTaskResult & { checks: CheckResult[] }>;
}

function taskSortKey(id: string, runKey: number): number {
  let hash = runKey + 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  const remainder = Math.max(0, seconds) % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function taskChecks(runtime: TaskRuntime): CheckResult[] {
  const { engine, task } = runtime;
  return evaluateChecks(task.checks, {
    pods: engine.store.list<Pod>("Pod"),
    deployments: engine.store.list<KubeDeployment>("Deployment"),
    services: engine.store.list<KubeService>("Service"),
    ingresses: engine.store.list<KubeIngress>("Ingress"),
    configMaps: engine.store.list<KubeConfigMap>("ConfigMap"),
    secrets: engine.store.list<KubeSecret>("Secret"),
    commands: engine.commands,
  });
}

function scoreTasks(runtimes: TaskRuntime[], passingScore: number): LabResult {
  const taskResults = runtimes.map((runtime) => {
    const checks = taskChecks(runtime);
    const passedChecks = checks.filter((check) => check.pass).length;
    return {
      taskId: runtime.task.id,
      title: runtime.task.title,
      unit: runtime.task.unit,
      passed: passedChecks === checks.length,
      passedChecks,
      totalChecks: checks.length,
      checks,
    };
  });
  const passedChecks = taskResults.reduce((sum, task) => sum + task.passedChecks, 0);
  const totalChecks = taskResults.reduce((sum, task) => sum + task.totalChecks, 0);
  const percent = totalChecks === 0 ? 0 : Math.round((passedChecks / totalChecks) * 100);

  return {
    percent,
    passed: percent >= passingScore,
    passedChecks,
    totalChecks,
    taskResults,
  };
}

function LabReview({ result }: { result: LabResult }) {
  const weakUnits = [
    ...new Set(result.taskResults.filter((task) => !task.passed).map((task) => task.unit)),
  ];

  return (
    <div className={styles.review}>
      <section
        className={cx(styles.resultCard, result.passed ? styles.pass : styles.fail)}
        aria-live="polite"
      >
        <div>
          <span className={styles.eyebrow}>{result.passed ? "Passed" : "Not passed"}</span>
          <strong>{result.percent}%</strong>
          <p>
            {result.passedChecks}/{result.totalChecks} checkpoint checks passed
          </p>
        </div>
        <div className={styles.resultActions}>
          <Link className={styles.secondaryLink} to="/practice">
            Practice missed questions
          </Link>
        </div>
      </section>

      {weakUnits.length > 0 ? (
        <p className={styles.weak}>
          Focus next on: {weakUnits.map((unit) => `#${unit}`).join(", ")}
        </p>
      ) : null}

      <div className={styles.reviewList}>
        {result.taskResults.map((task) => (
          <article key={task.taskId} className={styles.reviewItem} data-correct={task.passed}>
            <div className={styles.reviewHead}>
              <span>{task.passed ? "Passed" : "Review"}</span>
              <span>
                {task.passedChecks}/{task.totalChecks}
              </span>
            </div>
            <h3>{task.title}</h3>
            <ul className={styles.taskCheckList}>
              {task.checks.map((check) => (
                <li key={check.label} data-passed={check.pass}>
                  {check.pass ? "✓" : "○"} {check.label}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}

const TASKS_PER_PAGE = 5;

export function LabExamPage() {
  const { trackId } = useParams({ from: "/lab-exam/$trackId" });
  const exam = getCertificationExam(trackId);
  const [phase, setPhase] = useState<"intro" | "running" | "review">("intro");
  const [selected, setSelected] = useState(0);
  const [page, setPage] = useState(0);
  const [remaining, setRemaining] = useState(45 * 60);
  const [result, setResult] = useState<LabResult | null>(null);
  const [runKey, setRunKey] = useState(0);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [, forceUpdate] = useReducer((value: number) => value + 1, 0);
  const durationSeconds = (exam?.durationMinutes ?? 0) * 60;
  const orderedTasks = useMemo(
    () =>
      exam === undefined
        ? []
        : [...exam.taskPool]
            .sort((left, right) => taskSortKey(left.id, runKey) - taskSortKey(right.id, runKey))
            .slice(0, exam.taskCount),
    [exam, runKey],
  );

  const runtimes = useMemo<TaskRuntime[]>(() => {
    if (exam === undefined) {
      return [];
    }
    return orderedTasks.map((task) => {
      const engine = new SimEngine({ intervalMs: 900 });
      engine.seed({
        nodes: task.scenario.nodes.map((node) => ({
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
        objects: task.scenario.objects,
        files: task.scenario.files,
      });
      return { task, engine };
    });
  }, [exam, orderedTasks]);

  const submit = useCallback(() => {
    if (phase !== "running") {
      return;
    }
    const next = scoreTasks(runtimes, exam?.passingScore ?? 70);
    runtimes.forEach((runtime) => {
      runtime.engine.pause();
    });
    setResult(next);
    setPhase("review");
    void saveLabExamAttempt({
      trackId: exam?.id ?? trackId,
      score: next.passedChecks,
      total: next.totalChecks,
      percent: next.percent,
      passed: next.passed,
      taskResults: next.taskResults.map(({ checks: _checks, ...task }) => task),
    });
  }, [exam?.id, exam?.passingScore, phase, runtimes, trackId]);

  useEffect(() => {
    if (phase !== "running" || deadline === null) {
      return;
    }
    const unsubscribers = runtimes.map((runtime) =>
      runtime.engine.clock.onTick(() => forceUpdate()),
    );
    runtimes.forEach((runtime) => {
      runtime.engine.start();
    });
    const updateRemaining = () => {
      const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(next);
      if (next === 0) {
        window.clearInterval(timer);
        submit();
      }
    };
    const timer = window.setInterval(updateRemaining, 1000);
    updateRemaining();

    return () => {
      runtimes.forEach((runtime) => {
        runtime.engine.pause();
      });
      unsubscribers.forEach((unsubscribe) => {
        unsubscribe();
      });
      window.clearInterval(timer);
    };
  }, [deadline, phase, runtimes, submit]);

  if (exam === undefined) {
    return (
      <div className={styles.page}>
        <h1>Certification track not found</h1>
        <Link to="/">Back to the roadmap</Link>
      </div>
    );
  }

  if (exam.taskCount === 0) {
    return (
      <div className={styles.page}>
        <h1>{exam.name} has no hands-on exam</h1>
        <p>This track uses a timed knowledge exam.</p>
        <Link className={styles.secondaryLink} to="/exam/$trackId" params={{ trackId: exam.id }}>
          Start knowledge exam
        </Link>
      </div>
    );
  }

  const runtime = runtimes[selected];
  const taskResults = runtimes.map((item) => ({
    runtime: item,
    checks: taskChecks(item),
  }));
  const totalPages = Math.max(1, Math.ceil(taskResults.length / TASKS_PER_PAGE));
  const pageTasks = taskResults.slice(page * TASKS_PER_PAGE, (page + 1) * TASKS_PER_PAGE);
  const selectPage = (nextPage: number) => {
    setPage(nextPage);
    setSelected(nextPage * TASKS_PER_PAGE);
  };

  const execute = (input: string): string => {
    if (runtime === undefined) {
      return "";
    }
    const response = runtime.engine.execute(input).output;
    forceUpdate();
    return response;
  };

  const start = () => {
    setDeadline(Date.now() + durationSeconds * 1000);
    setRemaining(durationSeconds);
    setPhase("running");
  };

  const retake = () => {
    setRunKey((value) => value + 1);
    setDeadline(null);
    setSelected(0);
    setPage(0);
    setResult(null);
    setPhase("intro");
  };

  return (
    <div className={styles.page}>
      <Link to="/" className={styles.back}>
        ← Roadmap
      </Link>
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Hands-on exam</p>
          <h1>{exam.name} lab</h1>
          <p>{exam.description}</p>
        </div>
        <div className={styles.examMeta}>
          <span>{exam.taskCount} tasks</span>
          <span>{Math.round(durationSeconds / 60)} min</span>
          <span>{phase === "review" ? "Review ready" : "Checkpoints hidden"}</span>
        </div>
      </div>

      {phase === "intro" ? (
        <section className={styles.introCard}>
          <h2>Timed hands-on exam</h2>
          <p>
            Solve each task in the simulator. Checkpoints stay hidden until you submit. The timer
            starts when you begin.
          </p>
          <Button onClick={start}>Start lab</Button>
          <p className={styles.labLabel}>
            {exam.taskCount} tasks · {exam.durationMinutes} minutes
          </p>
        </section>
      ) : null}

      {phase === "running" && runtime !== undefined ? (
        <div className={styles.labLayout}>
          <aside className={styles.taskList} aria-label="Exam tasks">
            <div className={styles.runnerHead}>
              <span>Time</span>
              <span className={styles.timer} role="timer" aria-label="Time remaining">
                {formatTime(remaining)}
              </span>
            </div>
            {pageTasks.map((item, index) => {
              const taskIndex = page * TASKS_PER_PAGE + index;
              return (
                <button
                  key={item.runtime.task.id}
                  type="button"
                  className={cx(styles.taskButton, taskIndex === selected && styles.taskSelected)}
                  aria-pressed={taskIndex === selected}
                  onClick={() => setSelected(taskIndex)}
                >
                  <span>Task {taskIndex + 1}</span>
                  <strong>{item.runtime.task.title}</strong>
                </button>
              );
            })}
            <div className={styles.taskPager}>
              <span>
                Page {page + 1} of {totalPages}
              </span>
              <div className={styles.pager}>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => selectPage(Math.max(0, page - 1))}
                >
                  Previous
                </Button>
                {page < totalPages - 1 ? (
                  <Button size="sm" onClick={() => selectPage(Math.min(totalPages - 1, page + 1))}>
                    Next page
                  </Button>
                ) : (
                  <Button size="sm" onClick={submit}>
                    Submit lab exam
                  </Button>
                )}
              </div>
            </div>
          </aside>

          <section className={styles.labTask}>
            <div className={styles.labTaskHead}>
              <span>Task {selected + 1}</span>
              <h2>{runtime.task.title}</h2>
            </div>
            <p className={styles.labInstruction}>{runtime.task.instruction}</p>
            <div className={styles.labTerminal}>
              <Terminal
                key={runtime.task.id}
                execute={execute}
                follow={(input, write) => runtime.engine.followLogs(input, write)}
              />
            </div>
          </section>
        </div>
      ) : null}

      {phase === "review" && result !== null ? (
        <>
          <LabReview result={result} />
          <div className={styles.resultActions}>
            <Button variant="secondary" onClick={retake}>
              Retake lab exam
            </Button>
            <Link className={styles.secondaryLink} to="/">
              Back to roadmap
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
