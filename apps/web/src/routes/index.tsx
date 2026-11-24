import {
  certificationTracks,
  curriculumLessons,
  type Lesson,
  lessons,
  units,
} from "@kubelab/content";
import { Button, cx } from "@kubelab/ui";
import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";

import { buildLessonAccess, currentLessonId, type LessonAccess } from "../lib/progress";
import { useProgress } from "../lib/progress-context";
import styles from "./index.module.scss";

const coreUnits = units.filter((unit) => unit.number <= 12);
const firstLesson = coreUnits[0]?.lessons[0] ?? lessons[0];

function accessState(access: LessonAccess | undefined): string {
  if (access?.completed) {
    return "completed";
  }
  if (access?.current) {
    return "current";
  }
  if (access?.locked) {
    return "locked";
  }
  return "available";
}

function LessonRows({
  items,
  access,
  testId,
}: {
  items: Lesson[];
  access: Record<string, LessonAccess>;
  testId?: string;
}) {
  return (
    <div className={styles.lessonList} {...(testId === undefined ? {} : { "data-testid": testId })}>
      {items.map((lesson) => {
        const state = access[lesson.id];
        const stateName = accessState(state);
        const className = cx(
          styles.lessonLink,
          state?.completed && styles.lessonDone,
          state?.current && styles.lessonCurrent,
          state?.locked && styles.lessonLocked,
        );
        const content = (
          <>
            <span>{lesson.title}</span>
            <span className={styles.lessonXp}>{lesson.xp} XP</span>
          </>
        );

        return state?.locked ? (
          <div
            key={lesson.id}
            className={className}
            data-lesson-id={lesson.id}
            data-state={stateName}
          >
            <span className={styles.srOnly}>Locked: </span>
            {content}
          </div>
        ) : (
          <Link
            key={lesson.id}
            className={className}
            data-lesson-id={lesson.id}
            data-state={stateName}
            to="/lesson/$lessonId"
            params={{ lessonId: lesson.id }}
          >
            {content}
          </Link>
        );
      })}
    </div>
  );
}

export function HomePage() {
  const reduceMotion = useReducedMotion();
  const { rows, loading, xp, streak, completed, reset, lastLessonId } = useProgress();
  const access = buildLessonAccess(curriculumLessons, rows);
  const currentId = currentLessonId(curriculumLessons, rows);
  const current = currentId ? lessons.find((lesson) => lesson.id === currentId) : undefined;
  const lastLesson = lastLessonId
    ? lessons.find((lesson) => lesson.id === lastLessonId)
    : undefined;
  const continueLesson = current ?? lastLesson;
  const progressPercent = (completed / curriculumLessons.length) * 100;

  const handleReset = () => {
    if (window.confirm("Reset all local progress, XP, and streaks?")) {
      void reset();
    }
  };

  return (
    <div className={styles.page}>
      <motion.section
        className={styles.hero}
        initial={reduceMotion ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Zero → certified</p>
            <h1 className={styles.title}>
              Learn Kubernetes by <span className={styles.titleAccent}>running it.</span>
            </h1>
            <p className={styles.lede}>
              Short theory, real kubectl in a simulated cluster, and animations that show what
              happens under the hood — from your first Pod to CKA-level troubleshooting.
            </p>
            <div className={styles.actions}>
              {firstLesson ? (
                <Link
                  className={styles.cta}
                  to="/lesson/$lessonId"
                  params={{ lessonId: firstLesson.id }}
                >
                  Start the first lesson
                </Link>
              ) : null}
              <span className={styles.meta}>No signup · runs in your browser</span>
            </div>
            <div className={styles.heroTags} aria-hidden="true">
              <span>kubectl</span>
              <span>simulated cluster</span>
              <span>CKA → CKS</span>
            </div>
          </div>

          <aside className={styles.preview} aria-hidden="true">
            <div className={styles.previewBar}>
              <span className={styles.windowDots}>
                <i />
                <i />
                <i />
              </span>
              <span className={styles.previewTitle}>cluster: kubelab</span>
              <span className={styles.live}>live</span>
            </div>
            <pre className={styles.previewCode}>
              <span className={styles.prompt}>$</span> kubectl get pods{"\n"}
              NAME{"   "}READY{"   "}STATUS{"\n"}
              web{"    "}1/1{"     "}
              <span className={styles.ok}>Running</span>
              {"\n"}
              api{"    "}1/1{"     "}
              <span className={styles.ok}>Running</span>
            </pre>
            <div className={styles.previewFooter}>
              <span className={styles.chip}>3 nodes</span>
              <span className={styles.chip}>2 pods</span>
              <span className={styles.xp}>+20 XP</span>
            </div>
          </aside>
        </div>
      </motion.section>

      <section
        className={styles.progressPanel}
        data-testid="progress-summary"
        data-completed={completed}
        data-xp={xp}
        data-streak={streak}
      >
        <div className={styles.progressHead}>
          <div>
            <span className={styles.unitLabel}>Your progress</span>
            <p className={styles.progressCopy}>
              <strong>{loading ? "…" : completed}</strong> / {curriculumLessons.length} lessons ·{" "}
              <strong>{xp}</strong> XP · <strong>{streak}</strong>-day streak
            </p>
          </div>
          <div className={styles.progressActions}>
            {continueLesson ? (
              <Link
                className={styles.continueLink}
                to="/lesson/$lessonId"
                params={{ lessonId: continueLesson.id }}
              >
                Continue: {continueLesson.title}
              </Link>
            ) : (
              <span className={styles.progressCopy}>All lessons complete</span>
            )}
            <Button variant="ghost" size="sm" onClick={handleReset}>
              Reset progress
            </Button>
          </div>
        </div>
        <div className={styles.progressBar} aria-hidden="true">
          <span className={styles.progressBarFill} style={{ width: `${progressPercent}%` }} />
        </div>
      </section>

      <section className={styles.stats} aria-label="Project facts">
        <div className={styles.stat}>
          <div className={styles.statValue}>{coreUnits.length}</div>
          <div className={styles.statLabel}>core units</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{lessons.length}</div>
          <div className={styles.statLabel}>lessons and readiness checks</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{certificationTracks.length}</div>
          <div className={styles.statLabel}>certification tracks</div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>Core roadmap</h2>
          <span>
            {coreUnits.length} units · {lessons.length} lessons
          </span>
        </div>
        <div className={styles.grid}>
          {coreUnits.map((unit) => {
            const unitAccess = unit.lessons.map((lesson) => access[lesson.id]);
            const unitComplete =
              unitAccess.length > 0 && unitAccess.every((state) => state?.completed);
            const unitLocked = unitAccess.length > 0 && unitAccess.every((state) => state?.locked);

            return (
              <article
                key={unit.id}
                className={cx(
                  styles.unitCard,
                  unitComplete && styles.unitComplete,
                  unitLocked && styles.unitLocked,
                )}
                aria-label={`Unit ${unit.number}: ${unit.title}`}
              >
                <div className={styles.unitMeta}>
                  <span className={styles.unitNumber}>{String(unit.number).padStart(2, "0")}</span>
                  <span className={styles.unitLabel}>Unit</span>
                  <span className={styles.unitState}>
                    {unitComplete ? "Complete" : unitLocked ? "Locked" : "Active"}
                  </span>
                </div>
                <h3>{unit.title}</h3>
                <p>{unit.description}</p>
                <LessonRows
                  items={unit.lessons}
                  access={access}
                  testId={`unit-lessons-${unit.id}`}
                />
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>Certification tracks</h2>
          <span>Readiness checks for the CNCF path</span>
        </div>
        <div className={styles.grid}>
          {certificationTracks.map((track, index) => {
            const trackAccess = track.lessons.map((lesson) => access[lesson.id]);
            const trackComplete =
              trackAccess.length > 0 && trackAccess.every((state) => state?.completed);
            const trackLocked =
              trackAccess.length > 0 && trackAccess.every((state) => state?.locked);

            return (
              <article
                key={track.id}
                className={cx(
                  styles.unitCard,
                  styles.trackCard,
                  trackComplete && styles.unitComplete,
                  trackLocked && styles.unitLocked,
                )}
                aria-label={`${track.name} certification track`}
              >
                <div className={styles.unitMeta}>
                  <span className={styles.unitNumber}>{String(index + 1).padStart(2, "0")}</span>
                  <span className={styles.unitLabel}>Certification</span>
                  <span className={styles.unitState}>
                    {trackComplete ? "Complete" : trackLocked ? "Locked" : "Active"}
                  </span>
                </div>
                <h3>{track.name}</h3>
                <p>{track.description}</p>
                <LessonRows items={track.lessons} access={access} />
                <Link
                  className={styles.trackExam}
                  to="/exam/$trackId"
                  params={{ trackId: track.id }}
                >
                  Start mock exam →
                </Link>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
