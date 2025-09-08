// App.js (main entry)
import React, { useMemo, useState, useEffect } from "react";
import { Sparkles, BookOpen, ListChecks } from "lucide-react";
import LearnView from "./LearnView";
import GamesView from "./GamesView";
import { loadState, saveState } from "./utils";
import seedQuestions from "./catechism.json";

export default function App() {
  const [state, setState] = useState(() => {
    const saved = loadState();

    if (saved && saved.questions) {
      // merge unlock state from JSON (so updates in catechism.json are always respected)
      return {
        questions: seedQuestions.map((q) => {
          const savedQ = saved.questions.find((sq) => sq.id === q.id);
          return savedQ
            ? { ...q, unlocked: savedQ.unlocked ?? q.unlocked }
            : q;
        }),
      };
    }

    return { questions: seedQuestions };
  });

  // Save state on change
  useEffect(() => saveState(state), [state]);

  // Compute unlocked/locked
  const unlocked = useMemo(
    () => state.questions.filter((q) => q.unlocked),
    [state.questions]
  );
  const locked = useMemo(
    () => state.questions.filter((q) => !q.unlocked),
    [state.questions]
  );

  // Active tab + active question
  const [tab, setTab] = useState("learn");
  const [activeId, setActiveId] = useState(unlocked[0]?.id ?? null);
  const active =
    state.questions.find((q) => q.id === activeId) || unlocked[0];

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900">
      <header className="sticky top-0 z-40 backdrop-blur bg-white/80 border-b border-neutral-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Sparkles className="w-6 h-6" />
          <h1 className="font-semibold text-lg">
            Simple Christian Catechism
          </h1>
          <div className="ml-auto flex items-center gap-2">
            <NavTab
              icon={<BookOpen className="w-4 h-4" />}
              label="Learn"
              active={tab === "learn"}
              onClick={() => setTab("learn")}
            />
            <NavTab
              icon={<ListChecks className="w-4 h-4" />}
              label="Games"
              active={tab === "games"}
              onClick={() => setTab("games")}
            />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {tab === "learn" && (
          <LearnView
            unlocked={unlocked}
            locked={locked}
            active={active}
            onSelect={setActiveId}
          />
        )}
        {tab === "games" && <GamesView questions={unlocked} />}
      </main>
    </div>
  );
}

function NavTab({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm border ${
        active
          ? "bg-neutral-900 text-white border-neutral-900"
          : "bg-white text-neutral-700 hover:bg-neutral-50 border-neutral-300"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
