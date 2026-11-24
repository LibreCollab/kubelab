import { type CertificationExam, type ExamQuestion, getCertificationExam } from "@kubelab/content";
import { Button, cx } from "@kubelab/ui";
import { Link, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { type ExamResult, gradeExam, saveExamAttempt } from "../lib/certification";
import styles from "./certification.module.scss";

type ExamPhase = "intro" | "running" | "review";

function formatTime(seconds: number): string {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  const remainder = Math.max(0, seconds) % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function ExamQuestionCard({
  question,
  index,
  answer,
  onAnswer,
}: {
  question: ExamQuestion;
  index: number;
  answer: number | undefined;
  onAnswer: (answer: number) => void;
}) {
  const headingId = `exam-question-${question.id}`;

  return (
    <section className={styles.question} aria-labelledby={headingId}>
      <div className={styles.questionHead}>
        <span className={styles.questionNumber}>Q{index + 1}</span>
        <h3 id={headingId}>{question.prompt}</h3>
      </div>
      <div className={styles.options} role="radiogroup" aria-labelledby={headingId}>
        {question.options.map((option, optionIndex) => (
          <label
            key={option}
            className={cx(styles.option, answer === optionIndex && styles.selected)}
          >
            <input
              type="radio"
              name={question.id}
              checked={answer === optionIndex}
              onChange={() => onAnswer(optionIndex)}
            />
            <span className={styles.key} aria-hidden="true">
              {String.fromCharCode(65 + optionIndex)}
            </span>
            <span>{option}</span>
          </label>
        ))}
      </div>
    </section>
  );
}

function ExamRunner({
  exam,
  onFinish,
}: {
  exam: CertificationExam;
  onFinish: (answers: Record<string, number>) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [remaining, setRemaining] = useState(exam.durationMinutes * 60);
  const [startedAt] = useState(() => Date.now());

  const submit = useCallback(() => onFinish(answers), [answers, onFinish]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const next = exam.durationMinutes * 60 - elapsed;
      setRemaining(next);
      if (next <= 0) {
        window.clearInterval(timer);
        submit();
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [exam.durationMinutes, startedAt, submit]);

  const answered = Object.keys(answers).length;

  return (
    <div className={styles.runner}>
      <div className={styles.runnerHead}>
        <span>
          Answered <strong>{answered}</strong> / {exam.questions.length}
        </span>
        <span
          className={styles.timer}
          data-low={remaining <= 120 ? "true" : undefined}
          role="timer"
          aria-label="Time remaining"
        >
          {formatTime(remaining)}
        </span>
      </div>
      <div className={styles.questions}>
        {exam.questions.map((question, index) => (
          <ExamQuestionCard
            key={question.id}
            question={question}
            index={index}
            answer={answers[question.id]}
            onAnswer={(answer) => setAnswers((current) => ({ ...current, [question.id]: answer }))}
          />
        ))}
      </div>
      <div className={styles.runnerFoot}>
        <span>{exam.questions.length - answered} unanswered</span>
        <Button onClick={submit}>Submit exam</Button>
      </div>
    </div>
  );
}

function ExamReview({
  exam,
  answers,
  result,
  onRetake,
}: {
  exam: CertificationExam;
  answers: Record<string, number>;
  result: ExamResult;
  onRetake: () => void;
}) {
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
            {result.score}/{result.total} correct · pass mark {exam.passingScore}%
          </p>
        </div>
        <div className={styles.resultActions}>
          <Button variant="secondary" onClick={onRetake}>
            Retake exam
          </Button>
          <Link className={styles.secondaryLink} to="/practice">
            Practice missed questions
          </Link>
        </div>
      </section>

      {result.weakUnits.length > 0 ? (
        <p className={styles.weak}>
          Focus next on: {result.weakUnits.map((unit) => `#${unit}`).join(", ")}
        </p>
      ) : (
        <p className={styles.strong}>No weak areas detected. Strong run.</p>
      )}

      <div className={styles.reviewList}>
        {exam.questions.map((question, index) => {
          const selected = answers[question.id];
          const correct = selected === question.answer;
          return (
            <article key={question.id} className={styles.reviewItem} data-correct={correct}>
              <div className={styles.reviewHead}>
                <span>{correct ? "Correct" : "Review"}</span>
                <span>{String(index + 1).padStart(2, "0")}</span>
              </div>
              <h3>{question.prompt}</h3>
              <p>
                Answer: <strong>{question.options[question.answer]}</strong>
                {!correct ? (
                  <>
                    {" "}
                    · You chose{" "}
                    <em>{selected === undefined ? "nothing" : question.options[selected]}</em>
                  </>
                ) : null}
              </p>
              <Link to="/lesson/$lessonId" params={{ lessonId: question.lessonId }}>
                Review lesson: {question.lessonTitle}
              </Link>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function ExamPage() {
  const { trackId } = useParams({ from: "/exam/$trackId" });
  const exam = getCertificationExam(trackId);
  const [phase, setPhase] = useState<ExamPhase>("intro");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<ExamResult | null>(null);
  const [runKey, setRunKey] = useState(0);

  if (exam === undefined) {
    return (
      <div className={styles.page}>
        <h1>Certification track not found</h1>
        <Link to="/">Back to the roadmap</Link>
      </div>
    );
  }

  const finish = (nextAnswers: Record<string, number>) => {
    const graded = gradeExam(exam, nextAnswers);
    setAnswers(nextAnswers);
    setResult(graded);
    setPhase("review");
    void saveExamAttempt(exam, nextAnswers, graded);
  };

  const retake = () => {
    setRunKey((value) => value + 1);
    setAnswers({});
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
          <p className={styles.eyebrow}>Mock exam</p>
          <h1>{exam.name}</h1>
          <p>{exam.description}</p>
        </div>
        <div className={styles.examMeta}>
          <span>{exam.questions.length} questions</span>
          <span>{exam.durationMinutes} min</span>
          <span>{exam.passingScore}% to pass</span>
        </div>
      </div>

      {phase === "intro" ? (
        <section className={styles.introCard}>
          <h2>Timed mock exam</h2>
          <p>
            No feedback until you submit. Missed questions are scheduled for spaced-repetition
            practice. The timer starts when you begin.
          </p>
          <Button onClick={() => setPhase("running")}>Start exam</Button>
          {exam.labs.length > 0 ? (
            <div className={styles.labs}>
              <span className={styles.labLabel}>Hands-on labs</span>
              {exam.labs.map((lab) => (
                <Link key={lab.lessonId} to="/lesson/$lessonId" params={{ lessonId: lab.lessonId }}>
                  {lab.lessonTitle}
                </Link>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {phase === "running" ? <ExamRunner key={runKey} exam={exam} onFinish={finish} /> : null}

      {phase === "review" && result !== null ? (
        <ExamReview exam={exam} answers={answers} result={result} onRetake={retake} />
      ) : null}
    </div>
  );
}
