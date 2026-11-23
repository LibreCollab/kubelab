import { lessons } from "@kubelab/content";
import { Card, cx } from "@kubelab/ui";
import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";

import styles from "./index.module.scss";

const firstLesson = lessons[0];

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
          <div className={styles.statValue}>5</div>
          <div className={styles.statLabel}>certifications mapped</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>12–15</div>
          <div className={styles.statLabel}>lessons in the MVP</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>0</div>
          <div className={styles.statLabel}>servers running your commands</div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>Roadmap</h2>
          <span>4 units planned for the MVP</span>
        </div>
        <div className={styles.grid}>
          <Card className={styles.unitCard}>
            <span className={styles.unitLabel}>Unit 01 · Foundations</span>
            <h3>Containers, Pods, Deployments</h3>
            <p>
              Understand why orchestration exists, then create and inspect your first workload in a
              simulated cluster.
            </p>
            {lessons.map((lesson) => (
              <Link
                key={lesson.id}
                className={styles.lessonLink}
                to="/lesson/$lessonId"
                params={{ lessonId: lesson.id }}
              >
                <span>{lesson.title}</span>
                <span>{lesson.xp} XP</span>
              </Link>
            ))}
          </Card>
          <Card className={cx(styles.unitCard, styles.locked)}>
            <span className={styles.unitLabel}>Unit 02 · Services</span>
            <h3>Networking &amp; exposure</h3>
            <p>Services, DNS, and request flow — coming in Phase 2.</p>
            <span className={styles.lockedBadge}>Locked</span>
          </Card>
          <Card className={cx(styles.unitCard, styles.locked)}>
            <span className={styles.unitLabel}>Unit 03 · Config</span>
            <h3>Configuration &amp; storage</h3>
            <p>ConfigMaps, Secrets, volumes, and persistence — coming in Phase 2.</p>
            <span className={styles.lockedBadge}>Locked</span>
          </Card>
        </div>
      </section>
    </div>
  );
}
