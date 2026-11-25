import type { ExamQuestion } from "@kubelab/content";
import { examQuestionsById } from "@kubelab/content";
import { Button, cx } from "@kubelab/ui";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
  answerReviewCard,
  dueReviewCards,
  type ExamAttempt,
  type LabExamAttempt,
  latestExamAttempts,
  latestLabExamAttempts,
  type ReviewCard,
} from "../lib/certification";
import styles from "./certification.module.scss";

interface PracticeItem {
  card: ReviewCard;
  question: ExamQuestion;
}

export function PracticePage() {
  const [items, setItems] = useState<PracticeItem[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | undefined>(undefined);
  const [answered, setAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [labAttempts, setLabAttempts] = useState<LabExamAttempt[]>([]);

  useEffect(() => {
    void Promise.all([dueReviewCards(), latestExamAttempts(), latestLabExamAttempts()]).then(
      ([cards, recent, labs]) => {
        setItems(
          cards.flatMap((card) => {
            const question = examQuestionsById.get(card.questionId);
            return question === undefined ? [] : [{ card, question }];
          }),
        );
        setAttempts(recent);
        setLabAttempts(labs);
        setLoading(false);
      },
    );
  }, []);

  const item = items[index];

  const submit = () => {
    if (item === undefined || selected === undefined) {
      return;
    }
    const correct = selected === item.question.answer;
    setAnswered(true);
    if (correct) {
      setCorrectCount((value) => value + 1);
    }
    void answerReviewCard(item.card, correct);
  };

  const next = () => {
    setSelected(undefined);
    setAnswered(false);
    setIndex((value) => value + 1);
  };

  return (
    <div className={styles.page}>
      <Link to="/" className={styles.back}>
        ← Roadmap
      </Link>
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Spaced repetition</p>
          <h1>Practice queue</h1>
          <p>Missed exam questions return here on a spaced schedule.</p>
        </div>
        <div className={styles.examMeta}>
          <span>{items.length} due</span>
          <span>{correctCount} correct today</span>
        </div>
      </div>

      {loading ? <p className={styles.muted}>Loading review cards…</p> : null}

      {!loading && item === undefined ? (
        <section className={styles.introCard}>
          <h2>{items.length === 0 ? "Nothing due right now" : "Queue complete"}</h2>
          <p>
            {items.length === 0
              ? "Take a mock exam or come back when your next review is due."
              : "Nice work. Your next reviews are scheduled automatically."}
          </p>
          <div className={styles.resultActions}>
            <Link className={styles.secondaryLink} to="/exam/$trackId" params={{ trackId: "cka" }}>
              Start CKA mock exam
            </Link>
            <Link className={styles.secondaryLink} to="/">
              Back to roadmap
            </Link>
          </div>
        </section>
      ) : null}

      {attempts.length + labAttempts.length > 0 ? (
        <section className={styles.history}>
          <h2>Recent exams</h2>
          {attempts.map((attempt) => (
            <div key={`mcq-${attempt.id}`} className={styles.historyRow}>
              <Link to="/exam/$trackId" params={{ trackId: attempt.trackId }}>
                {attempt.trackId.toUpperCase()} knowledge
              </Link>
              <span>
                {attempt.score}/{attempt.total}
              </span>
              <span data-passed={attempt.passed}>{attempt.passed ? "Passed" : "Not passed"}</span>
              <span>{new Date(attempt.completedAt).toLocaleDateString()}</span>
            </div>
          ))}
          {labAttempts.map((attempt) => (
            <div key={`lab-${attempt.id}`} className={styles.historyRow}>
              <Link to="/lab-exam/$trackId" params={{ trackId: attempt.trackId }}>
                {attempt.trackId.toUpperCase()} hands-on
              </Link>
              <span>
                {attempt.score}/{attempt.total}
              </span>
              <span data-passed={attempt.passed}>{attempt.passed ? "Passed" : "Not passed"}</span>
              <span>{new Date(attempt.completedAt).toLocaleDateString()}</span>
            </div>
          ))}
        </section>
      ) : null}

      {item !== undefined ? (
        <section className={styles.practiceCard}>
          <div className={styles.practiceMeta}>
            <span>
              {index + 1}/{items.length}
            </span>
            <span>{item.question.lessonTitle}</span>
          </div>
          <h2>{item.question.prompt}</h2>
          <div className={styles.options} role="radiogroup" aria-label={item.question.prompt}>
            {item.question.options.map((option, optionIndex) => {
              const isSelected = selected === optionIndex;
              const isCorrect = item.question.answer === optionIndex;
              const state = answered
                ? isCorrect
                  ? "correct"
                  : isSelected
                    ? "wrong"
                    : undefined
                : undefined;
              return (
                <label
                  key={option}
                  className={cx(styles.option, isSelected && styles.selected)}
                  data-answer-state={state}
                >
                  <input
                    type="radio"
                    name={item.question.id}
                    checked={isSelected}
                    disabled={answered}
                    onChange={() => setSelected(optionIndex)}
                  />
                  <span className={styles.key} aria-hidden="true">
                    {String.fromCharCode(65 + optionIndex)}
                  </span>
                  <span>{option}</span>
                </label>
              );
            })}
          </div>
          {answered ? (
            <p className={styles.practiceResult} data-correct={selected === item.question.answer}>
              {selected === item.question.answer ? "Correct." : "Review this one again soon."}
            </p>
          ) : null}
          <div className={styles.runnerFoot}>
            <Link
              className={styles.secondaryLink}
              to="/lesson/$lessonId"
              params={{ lessonId: item.question.lessonId }}
            >
              Review lesson
            </Link>
            {answered ? (
              <Button onClick={next}>Next card</Button>
            ) : (
              <Button onClick={submit} disabled={selected === undefined}>
                Check answer
              </Button>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
