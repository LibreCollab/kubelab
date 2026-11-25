import { certificationDomains, getCertificationExam, getLesson } from "@kubelab/content";
import { Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import {
  type ExamAttempt,
  type LabExamAttempt,
  latestExamAttempts,
  latestLabExamAttempts,
} from "../lib/certification";
import {
  calculateReadiness,
  latestReadinessSnapshots,
  type ReadinessSnapshot,
  saveReadinessSnapshot,
} from "../lib/certification-roadmap";
import { dateKey } from "../lib/progress";
import { useProgress } from "../lib/progress-context";
import styles from "./certification.module.scss";

export function CertificationRoadmapPage() {
  const { trackId } = useParams({ from: "/certification/$trackId" });
  const exam = getCertificationExam(trackId);
  const { rows, loading } = useProgress();
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [labAttempts, setLabAttempts] = useState<LabExamAttempt[]>([]);
  const [snapshots, setSnapshots] = useState<ReadinessSnapshot[]>([]);
  const [loadingEvidence, setLoadingEvidence] = useState(true);

  useEffect(() => {
    void Promise.all([
      latestExamAttempts(),
      latestLabExamAttempts(),
      latestReadinessSnapshots(trackId),
    ])
      .then(([knowledge, labs, history]) => {
        setAttempts(knowledge);
        setLabAttempts(labs);
        setSnapshots(history);
      })
      .finally(() => setLoadingEvidence(false));
  }, [trackId]);

  const domains = useMemo(
    () => certificationDomains.filter((domain) => domain.trackId === trackId),
    [trackId],
  );
  const readiness = useMemo(
    () => calculateReadiness(trackId, rows, attempts, labAttempts, domains),
    [attempts, domains, labAttempts, rows, trackId],
  );

  useEffect(() => {
    if (loading || loadingEvidence || exam === undefined) {
      return;
    }
    void saveReadinessSnapshot(trackId, dateKey(), readiness.score)
      .then(() => latestReadinessSnapshots(trackId))
      .then(setSnapshots);
  }, [exam, loading, loadingEvidence, readiness.score, trackId]);

  if (exam === undefined) {
    return (
      <div className={styles.page}>
        <h1>Certification track not found</h1>
        <Link to="/">Back to the roadmap</Link>
      </div>
    );
  }

  const recentKnowledge = attempts.filter((attempt) => attempt.trackId === trackId).slice(0, 3);
  const recentLabs = labAttempts.filter((attempt) => attempt.trackId === trackId).slice(0, 3);
  const trend = snapshots.slice(-5);

  return (
    <div className={styles.page}>
      <Link to="/" className={styles.back}>
        ← Roadmap
      </Link>

      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Certification roadmap</p>
          <h1>{exam.name}</h1>
          <p>{exam.description}</p>
        </div>
        <div className={styles.examMeta}>
          <span>{exam.format === "knowledge" ? "Knowledge exam" : "Hands-on exam"}</span>
          <span>
            {exam.format === "knowledge"
              ? `${exam.questionCount} questions`
              : `${exam.taskCount} tasks`}
          </span>
          <span>{exam.durationMinutes} min</span>
          <span>{exam.passingScore}% to pass</span>
        </div>
      </div>

      <section className={styles.readinessCard}>
        <div>
          <span className={styles.eyebrow}>Readiness</span>
          <strong className={styles.readinessScore}>{readiness.score}%</strong>
          <p>{readiness.band}</p>
        </div>
        <div className={styles.readinessBody}>
          <p>
            Weighted from mapped lesson coverage and recent local exam evidence. This is practice
            guidance, not an official certification prediction.
          </p>
          {readiness.nextAction === undefined ? null : readiness.nextAction.type === "lesson" ? (
            <Link
              className={styles.primaryLink}
              to="/lesson/$lessonId"
              params={{ lessonId: readiness.nextAction.lessonId ?? "" }}
            >
              {readiness.nextAction.label} →
            </Link>
          ) : exam.format === "hands-on" ? (
            <Link className={styles.primaryLink} to="/lab-exam/$trackId" params={{ trackId }}>
              {readiness.nextAction.label} →
            </Link>
          ) : (
            <Link className={styles.primaryLink} to="/exam/$trackId" params={{ trackId }}>
              {readiness.nextAction.label} →
            </Link>
          )}
        </div>
      </section>

      <section className={styles.history}>
        <h2>Domains</h2>
        <div className={styles.domainGrid}>
          {readiness.domains.map((item) => {
            const domain = item.domain;
            const nextLesson = item.nextLessonId ? getLesson(item.nextLessonId) : undefined;
            return (
              <article
                key={domain.id}
                className={styles.domainCard}
                data-state={item.weak ? "weak" : item.strong ? "strong" : "developing"}
              >
                <div className={styles.domainHead}>
                  <span>{domain.weight}% of exam</span>
                  <span>{item.score}%</span>
                </div>
                <h3>{domain.title}</h3>
                <p>
                  {item.completedLessons}/{item.totalLessons} lessons complete
                  {item.evidence === undefined
                    ? " · no exam evidence yet"
                    : ` · ${Math.round(item.evidence * 100)}% recent evidence`}
                </p>
                <div className={styles.progressBar} aria-hidden="true">
                  <span
                    className={styles.progressBarFill}
                    style={{ width: `${item.coverage * 100}%` }}
                  />
                </div>
                <div className={styles.domainFoot}>
                  <span>{item.weak ? "Weak" : item.strong ? "Strong" : "Developing"}</span>
                  {nextLesson === undefined ? null : (
                    <Link to="/lesson/$lessonId" params={{ lessonId: nextLesson.id }}>
                      Next: {nextLesson.title}
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.history}>
        <h2>Recent evidence</h2>
        {recentKnowledge.length + recentLabs.length === 0 ? (
          <p className={styles.muted}>No exam attempts yet. Your domain evidence starts at zero.</p>
        ) : (
          <>
            {recentKnowledge.map((attempt) => (
              <div key={`knowledge-${attempt.id}`} className={styles.historyRow}>
                <span>Knowledge</span>
                <span>
                  {attempt.score}/{attempt.total}
                </span>
                <span data-passed={attempt.passed}>{attempt.passed ? "Passed" : "Not passed"}</span>
                <span>{new Date(attempt.completedAt).toLocaleDateString()}</span>
              </div>
            ))}
            {recentLabs.map((attempt) => (
              <div key={`lab-${attempt.id}`} className={styles.historyRow}>
                <span>Hands-on</span>
                <span>
                  {attempt.score}/{attempt.total}
                </span>
                <span data-passed={attempt.passed}>{attempt.passed ? "Passed" : "Not passed"}</span>
                <span>{new Date(attempt.completedAt).toLocaleDateString()}</span>
              </div>
            ))}
          </>
        )}
        <div className={styles.trend}>
          <span>Readiness trend</span>
          {trend.length === 0 ? (
            <small>Not enough history yet</small>
          ) : (
            <div className={styles.trendBars} role="img" aria-label="Readiness trend">
              {trend.map((snapshot) => (
                <i
                  key={`${snapshot.dateKey}-${snapshot.id ?? snapshot.createdAt}`}
                  style={{ height: `${Math.max(8, snapshot.score)}%` }}
                  title={`${snapshot.dateKey}: ${snapshot.score}%`}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <div className={styles.resultActions}>
        {exam.format === "knowledge" ? (
          <Link className={styles.primaryLink} to="/exam/$trackId" params={{ trackId }}>
            Start knowledge exam →
          </Link>
        ) : (
          <Link className={styles.primaryLink} to="/lab-exam/$trackId" params={{ trackId }}>
            Start hands-on exam →
          </Link>
        )}
        <Link className={styles.secondaryLink} to="/practice">
          Review weak areas →
        </Link>
      </div>
    </div>
  );
}
