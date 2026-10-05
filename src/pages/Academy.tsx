import { useState } from "react";
import { COURSE, type Lesson } from "../lib/academy/course";
import { useStore } from "../store";

export function Academy() {
  const { data } = useStore();
  const done = new Set(data.academy.completed);
  const firstOpen = COURSE.find((l) => !done.has(l.day))?.day ?? 1;
  const [day, setDay] = useState(firstOpen);
  const lesson = COURSE.find((l) => l.day === day) ?? COURSE[0]!;
  const progress = done.size / COURSE.length;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>7-Day Academy</h1>
          <p>One short lesson a day on how Etsy search, traffic and selling work. Each ends with a quiz and a task to do in your own shop.</p>
        </div>
        <div style={{ minWidth: 200 }}>
          <div className="row small" style={{ justifyContent: "space-between" }}>
            <span>Progress</span>
            <span className="num">
              {done.size}/{COURSE.length} days
            </span>
          </div>
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={COURSE.length} aria-valuenow={done.size}>
            <div style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      </div>

      <div className="split split-nav-main">
        <nav className="day-list" aria-label="Lessons">
          {COURSE.map((l) => (
            <button key={l.day} className="day-item" aria-current={l.day === day} onClick={() => setDay(l.day)}>
              <span className={`day-num${done.has(l.day) ? " done" : ""}`}>{done.has(l.day) ? "✓" : l.day}</span>
              <span>
                <span className="tiny muted">
                  Day {l.day} · {l.minutes} min
                </span>
                <br />
                <span className="small" style={{ fontWeight: 600 }}>
                  {l.title}
                </span>
              </span>
            </button>
          ))}
        </nav>
        <LessonView key={lesson.day} lesson={lesson} onNext={() => setDay(Math.min(COURSE.length, lesson.day + 1))} />
      </div>
    </div>
  );
}

function LessonView({ lesson, onNext }: { lesson: Lesson; onNext: () => void }) {
  const { data, update, go } = useStore();
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [checked, setChecked] = useState(false);
  const completed = data.academy.completed.includes(lesson.day);
  const score = lesson.quiz.reduce((s, q, i) => s + (answers[i] === q.answer ? 1 : 0), 0);
  const best = data.academy.quiz[lesson.day];

  const check = () => {
    setChecked(true);
    update((s) => ({
      academy: {
        completed: score === lesson.quiz.length ? [...new Set([...s.academy.completed, lesson.day])] : s.academy.completed,
        quiz: { ...s.academy.quiz, [lesson.day]: Math.max(score, s.academy.quiz[lesson.day] ?? 0) },
      },
    }));
  };

  return (
    <article className="card lesson">
      <span className="badge badge-accent">
        Day {lesson.day} of {COURSE.length}
      </span>
      <h1 style={{ marginTop: 8, fontSize: "1.45rem" }}>{lesson.title}</h1>
      <p className="sub">{lesson.goal}</p>

      {lesson.sections.map((s) => (
        <section key={s.heading}>
          <h2>{s.heading}</h2>
          {s.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
          {s.bullets && (
            <ul className="plain" style={{ color: "var(--ink)" }}>
              {s.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <div className="callout" style={{ marginTop: 20 }}>
        <strong>Key takeaways</strong>
        <ul className="plain" style={{ color: "var(--ink)" }}>
          {lesson.takeaways.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>

      <h2>Quick quiz</h2>
      <div>
        {lesson.quiz.map((q, qi) => (
          <fieldset key={qi} className="quiz-q" style={{ margin: 0 }}>
            <legend className="small" style={{ fontWeight: 600, padding: "0 4px" }}>
              {qi + 1}. {q.q}
            </legend>
            {q.options.map((opt, oi) => {
              const picked = answers[qi] === oi;
              const cls = checked ? (oi === q.answer ? " correct" : picked ? " wrong" : "") : "";
              return (
                <label key={oi} className={`quiz-opt${cls}`}>
                  <input
                    type="radio"
                    name={`q-${lesson.day}-${qi}`}
                    checked={picked}
                    onChange={() => {
                      setAnswers((a) => ({ ...a, [qi]: oi }));
                      setChecked(false);
                    }}
                  />
                  <span>
                    {opt}
                    {checked && oi === q.answer && <span className="visually-hidden"> (correct answer)</span>}
                  </span>
                </label>
              );
            })}
            {checked && answers[qi] !== undefined && (
              <p className="small" style={{ margin: "6px 6px 0", color: "var(--ink-2)" }}>
                {answers[qi] === q.answer ? "✓ Correct. " : "✗ Not quite. "}
                {q.explain}
              </p>
            )}
          </fieldset>
        ))}
      </div>

      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn btn-primary" onClick={check} disabled={Object.keys(answers).length < lesson.quiz.length}>
          Check answers
        </button>
        {checked && (
          <span className="small" role="status">
            {score}/{lesson.quiz.length} correct{score === lesson.quiz.length ? " — day complete!" : " — review the explanations and try again."}
          </span>
        )}
        {!checked && best !== undefined && <span className="small muted">Best score: {best}/{lesson.quiz.length}</span>}
      </div>

      <div className="callout row" style={{ marginTop: 20, justifyContent: "space-between" }}>
        <span>
          <strong>Apply it:</strong> {lesson.apply.text}
        </span>
        <div className="row">
          <button className="btn btn-sm" onClick={() => go(lesson.apply.tab)}>
            {lesson.apply.cta}
          </button>
          {!completed && (
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => update((s) => ({ academy: { ...s.academy, completed: [...new Set([...s.academy.completed, lesson.day])] } }))}
            >
              Mark complete
            </button>
          )}
          {lesson.day < COURSE.length && (
            <button className="btn btn-sm btn-primary" onClick={onNext}>
              Next day →
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
