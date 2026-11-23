import { certificationTracks, lessons, units } from "@kubelab/content";
import { cx } from "@kubelab/ui";
import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";

import styles from "./index.module.scss";

const coreUnits = units.filter((unit) => unit.number <= 12);
const firstLesson = coreUnits[0]?.lessons[0] ?? lessons[0];

export function HomePage() {
  const reduceMotion = useReducedMotion();

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
            <p className={styles.eyebrow}>Zero → certified · interactive</p>
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
          {coreUnits.map((unit) => (
            <article
              key={unit.id}
              className={styles.unitCard}
              aria-label={`Unit ${unit.number}: ${unit.title}`}
            >
              <div className={styles.unitMeta}>
                <span className={styles.unitNumber}>{String(unit.number).padStart(2, "0")}</span>
                <span className={styles.unitLabel}>Unit</span>
              </div>
              <h3>{unit.title}</h3>
              <p>{unit.description}</p>
              <div className={styles.lessonList}>
                {unit.lessons.map((lesson) => (
                  <Link
                    key={lesson.id}
                    className={styles.lessonLink}
                    to="/lesson/$lessonId"
                    params={{ lessonId: lesson.id }}
                  >
                    <span>{lesson.title}</span>
                    <span className={styles.lessonXp}>{lesson.xp} XP</span>
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>Certification tracks</h2>
          <span>Readiness checks for the CNCF path</span>
        </div>
        <div className={styles.grid}>
          {certificationTracks.map((track, index) => (
            <article
              key={track.id}
              className={cx(styles.unitCard, styles.trackCard)}
              aria-label={`${track.name} certification track`}
            >
              <div className={styles.unitMeta}>
                <span className={styles.unitNumber}>{String(index + 1).padStart(2, "0")}</span>
                <span className={styles.unitLabel}>Certification</span>
              </div>
              <h3>{track.name}</h3>
              <p>{track.description}</p>
              <div className={styles.lessonList}>
                {track.lessons.map((lesson) => (
                  <Link
                    key={lesson.id}
                    className={styles.lessonLink}
                    to="/lesson/$lessonId"
                    params={{ lessonId: lesson.id }}
                  >
                    <span>{lesson.title}</span>
                    <span className={styles.lessonXp}>{lesson.xp} XP</span>
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
