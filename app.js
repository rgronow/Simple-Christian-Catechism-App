// app.js - Firebase + Lightweight Identity + HomeScreen + Leaderboard + Scoring
const { useState, useEffect, useMemo } = React;
const CLOUD_PAUSED = true;

const PARTS = [
  { id: "part1", label: "Part 1", title: "God, creation & our need", start: 1, end: 18 },
  { id: "part2", label: "Part 2", title: "The Redeemer & salvation", start: 19, end: 31 },
  { id: "part3", label: "Part Three", title: "Growing in faith", start: 32, end: Infinity, visible: false },
];

function questionsForPart(questions, part) {
  const section = PARTS.find((item) => item.id === part) || PARTS[0];
  return questions.filter((q) => q.id >= section.start && q.id <= section.end);
}

function isAvailable(question, unlockedIds) {
  return question.id <= 31 || unlockedIds.includes(question.id);
}

function PartPicker({ value, onChange, questions }) {
  return (
    <div className="part-picker" role="group" aria-label="Catechism part">
      {PARTS.filter((part) => part.visible !== false && questionsForPart(questions, part.id).length).map((part) => (
        <button key={part.id} type="button" className={value === part.id ? "part-choice active" : "part-choice"}
          aria-pressed={value === part.id} onClick={() => onChange(part.id)}>
          <span>{part.label}</span><small>{part.title}</small>
        </button>
      ))}
    </div>
  );
}

/* ----------------------------- YT URL Helpers ----------------------------- */
function transformYouTubeURL(urlOrId) {
  if (!urlOrId) return "";
  const s = String(urlOrId).trim();
  if (s.includes("1zblTCsThDE")) return "";

  // Already an /embed/ URL
  if (s.includes("/embed/")) return s;

  // Shorts (e.g., https://www.youtube.com/shorts/VIDEOID?si=...)
  if (s.includes("youtube.com/shorts/")) {
    const id = s.split("/shorts/")[1]?.split(/[?&]/)[0] || "";
    return id ? `https://www.youtube.com/embed/${id}` : "";
  }

  // Standard watch URL
  if (s.includes("youtube.com/watch?v=")) {
    const id = s.split("v=")[1]?.split("&")[0] || "";
    return id ? `https://www.youtube.com/embed/${id}` : "";
  }

  // Short youtu.be
  if (s.includes("youtu.be/")) {
    const id = s.split("youtu.be/")[1]?.split(/[?&]/)[0] || "";
    return id ? `https://www.youtube.com/embed/${id}` : "";
  }

  // Plain 11-char ID
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) {
    return `https://www.youtube.com/embed/${s}`;
  }

  return "";
}

// Detect Shorts so we can use a 9:16 frame
function isYouTubeShorts(urlOrId) {
  if (!urlOrId) return false;
  return String(urlOrId).includes("/shorts/");
}

/* -------------------------------- Firebase -------------------------------- */
const firebaseConfig = {
  apiKey: "AIzaSyAlZ5IsphN3IOLOKoGvQecJfEunjwbeolw",
  authDomain: "simplechristiancatechism.firebaseapp.com",
  databaseURL: "https://simplechristiancatechism-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "simplechristiancatechism",
  storageBucket: "simplechristiancatechism.appspot.com",
  messagingSenderId: "605718866345",
  appId: "1:605718866345:web:60c9e790e5148ff78fbcb8",
  measurementId: "G-JKY86F4M6H"
};

if (!CLOUD_PAUSED) firebase.initializeApp(firebaseConfig);
const db = CLOUD_PAUSED ? null : firebase.database();
const unlockedRef = CLOUD_PAUSED ? null : db.ref('/unlockedIds');

/* --------------------------------- Utils ---------------------------------- */
function shuffle(array) {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getMultipleChoiceOptions(questions, currentIndex, count = 4) {
  const correctAnswer = questions[currentIndex].answer;
  const otherAnswers = questions
    .filter((_, idx) => idx !== currentIndex)
    .map((q) => q.answer);
  const shuffled = shuffle(otherAnswers).slice(0, Math.max(0, count - 1));
  return shuffle([correctAnswer, ...shuffled]);
}

function generateFillBlankData(questions, currentIndex, blankCount = 3) {
  const answer = questions[currentIndex].answer;
  const words = answer.split(/(\s+)/);
  const wordIndices = words
    .map((w, idx) => (/\s/.test(w) ? null : idx))
    .filter((idx) => idx !== null);
  const shuffledIndices = shuffle(wordIndices);
  const blanksToHide = shuffledIndices.slice(0, Math.min(blankCount, wordIndices.length));
  const blanks = words.map((w, idx) =>
    blanksToHide.includes(idx) && !/\s/.test(w)
      ? { original: w, hidden: true }
      : { original: w, hidden: false }
  );
  const hiddenWords = blanks.filter((b) => b.hidden).map((b) => b.original);
  const otherWords = questions
    .filter((_, idx) => idx !== currentIndex)
    .flatMap((q) => q.answer.split(/\s+/))
    .filter((w) => w.length > 3);
  const distractors = shuffle(otherWords).slice(0, blankCount);
  return { blanks, options: shuffle([...hiddenWords, ...distractors]) };
}

/* --------------------------------- App ------------------------------------ */
function App() {
  const [questions, setQuestions] = useState([]);
  const [unlockedIds, setUnlockedIds] = useState([]);
  const [view, setView] = useState('home');
  const [part, setPart] = useState('part1');
  const [adminMode, setAdminMode] = useState(false);
  const [adminAuth, setAdminAuth] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [user, setUser] = useState(localStorage.getItem("catechismUser") || "");

  useEffect(() => {
    let active = true;
    fetch('./catechism.json')
      .then((response) => {
        if (!response.ok) throw new Error(`Question file could not be loaded (${response.status}).`);
        return response.json();
      })
      .then((data) => { if (active) setQuestions(data); })
      .catch((error) => { if (active) setLoadError(error.message); });
    if (CLOUD_PAUSED) {
      setUnlockedIds(Array.from({ length: 31 }, (_, index) => index + 1));
      return () => { active = false; };
    }
    unlockedRef.on(
      "value",
      (snapshot) => {
        if (active) setUnlockedIds(Object.values(snapshot.val() || {}).map(Number));
      },
      (error) => {
        console.error(error);
      }
    );
    return () => { active = false; unlockedRef.off('value'); };
  }, []);

  const updateUnlockedIdsInFirebase = (newUnlockedIds) =>
    CLOUD_PAUSED ? Promise.resolve() : db.ref(`/unlockedIds`).set(newUnlockedIds);

  const handleUnlockNext = () => {
    const sorted = questions.filter((q) => q.id <= 31).sort((a, b) => a.id - b.id);
    const locked = sorted.find((q) => !isAvailable(q, unlockedIds));
    if (locked) {
      updateUnlockedIdsInFirebase([...unlockedIds, locked.id]);
    }
  };

  const awardPoints = (username, amount) => {
    if (CLOUD_PAUSED) return;
    if (!username || username === "__guest__" || username === "admin") return;
    const ref = db.ref(`/users/${username}/points`);
    ref.transaction((curr) => (curr || 0) + amount);
  };

  if (!user) {
    return (
      <UserSelect
        onSubmit={(name) => {
          setUser(name);
          localStorage.setItem("catechismUser", name);
        }}
      />
    );
  }

  if (adminMode && !adminAuth) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <h1 className="text-2xl font-bold mb-4">Admin Login</h1>
        <AdminLogin
          onSuccess={() => setAdminAuth(true)}
          onCancel={() => setAdminMode(false)}
        />
      </div>
    );
  }

  return (
    <div className="app-shell min-h-screen flex flex-col">
      {/* HEADER */}
      <header className="site-header">
        <div className="header-inner">
          <button className="brand" onClick={() => setView('home')} aria-label="Simple Christian Catechism home">
            <img src="logo.png" alt="" /><span>Simple Christian<br />Catechism</span>
          </button>
          <nav className="main-nav" aria-label="Main navigation">
            <button className={view === 'home' ? 'active' : ''}
              onClick={() => setView("home")}>Home</button>
            <button className={view === 'learn' ? 'active' : ''}
              onClick={() => setView("learn")}>Learn</button>
            <button className={view === 'games' ? 'active' : ''}
              onClick={() => setView("games")}>Games</button>
            {!CLOUD_PAUSED && <button className={view === 'leaderboard' ? 'active' : ''}
              onClick={() => setView("leaderboard")}>Leaderboard</button>}
          </nav>
        </div>
      </header>

      {/* MAIN */}
      <main className="main-content flex-1">
        {loadError ? (
          <div className="text-red-600">Error loading data: {loadError}</div>
        ) : questions.length === 0 ? (
          <div>Loading…</div>
        ) : adminMode ? (
          <AdminView
            questions={questions.filter((q) => q.id <= 31)}
            unlockedIds={unlockedIds}
            setUnlockedIds={updateUnlockedIdsInFirebase}
            handleUnlockNext={handleUnlockNext}
          />
        ) : view === "home" ? (
          <HomeScreen onNavigate={setView} onPartChange={setPart} />
        ) : view === "learn" ? (
          <LearnView questions={questions} unlockedIds={unlockedIds} part={part} setPart={setPart} />
        ) : view === "games" ? (
          <GamesView
            questions={questions}
            unlockedIds={unlockedIds}
            part={part}
            setPart={setPart}
            awardPoints={(amt) => awardPoints(user, amt)}
          />
        ) : view === "leaderboard" ? (
          <Leaderboard />
        ) : null}
      </main>

      {/* FOOTER */}
      <footer className="site-footer">
        <span className="text-sm text-gray-600 mr-4">
          User: {user === "__guest__" ? "Guest" : user}
        </span>

        {!CLOUD_PAUSED && <button className="px-3 py-1 rounded text-white"
          style={{ backgroundColor: adminMode ? "#0097b2" : "#33c0d4" }}
          onClick={() => {
            setAdminMode(!adminMode);
            if (adminMode) setAdminAuth(false);
          }}>
          {adminMode ? "Close Admin" : "Admin"}
        </button>}

        <button className="px-3 py-1 rounded text-white"
          style={{ backgroundColor: "#0097b2" }}
          onClick={() => {
            setUser("");
            localStorage.removeItem("catechismUser");
          }}>
          Switch User
        </button>

        {!CLOUD_PAUSED && <button className="px-3 py-1 rounded text-white disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: "#ef4444" }}
          disabled={user === "admin" || user === "__guest__"}
          onClick={() => {
            if (!user || user === "admin" || user === "__guest__") return;
            const ok = window.confirm(
              `Delete user "${user}" and all their points? This cannot be undone.`
            );
            if (!ok) return;
            db.ref(`/users/${user}/points`).remove()
              .then(() => {
                localStorage.removeItem("catechismUser");
                setUser("");
                alert("User deleted.");
              })
              .catch((err) => {
                console.error(err);
                alert("Sorry, something went wrong deleting this user.");
              });
          }}>
          Delete User
        </button>}
      </footer>
    </div>
  );
}

/* ------------------------------ Screens ----------------------------------- */
function HomeScreen({ onNavigate, onPartChange }) {
  return (
    <div className="home-page">
      <section className="hero">
        <div className="eyebrow">A simple way to learn the Christian faith</div>
        <h1>Small questions.<br /><em>Lasting truth.</em></h1>
        <p>Read the catechism, take your time with each answer, and practise what you have learned.</p>
        <div className="hero-actions">
          <button className="primary-action" onClick={() => { onPartChange('part2'); onNavigate('learn'); }}>Explore Part 2 <span aria-hidden="true">→</span></button>
          <button className="secondary-action" onClick={() => { onPartChange('part1'); onNavigate('learn'); }}>Start with Part 1</button>
        </div>
        <div className="hero-decoration" aria-hidden="true">✦</div>
      </section>
      <section className="home-grid" aria-label="Explore the catechism">
        <button className="home-tile" onClick={() => { onPartChange('part1'); onNavigate('learn'); }}>
          <span className="tile-kicker">01 · THE FOUNDATIONS</span>
          <strong>Part 1</strong><span>God, creation, the law and our need for a Redeemer.</span>
          <span className="tile-link">Read questions 1–18 →</span>
        </button>
        <button className="home-tile featured" onClick={() => { onPartChange('part2'); onNavigate('learn'); }}>
          <span className="tile-kicker">02 · THE GOOD NEWS</span>
          <strong>Part 2 <span className="new-badge">New</span></strong><span>The Redeemer, salvation, judgment and our hope.</span>
          <span className="tile-link">Read questions 1–13 →</span>
        </button>
        <button className="home-tile" onClick={() => { onPartChange('part2'); onNavigate('games'); }}>
          <span className="tile-kicker">LEARN BY DOING</span>
          <strong>Practise</strong><span>Try multiple choice, fill in the blank, or flashcards.</span>
          <span className="tile-link">Play the games →</span>
        </button>
      </section>
    </div>
  );
}

/* ------------------------------ Leaderboard ------------------------------- */
function Leaderboard() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = db.ref("/users").orderByChild("points").limitToLast(10);
    const handler = ref.on("value", (snap) => {
      const val = snap.val() || {};
      const list = Object.entries(val)
        .filter(([name]) => name !== "admin" && name !== "__guest__")
        .map(([name, data]) => ({
          name,
          points: Number((data && data.points) || 0),
        }))
        .sort((a, b) => b.points - a.points);
      setRows(list);
      setLoading(false);
    });
    return () => ref.off("value", handler);
  }, []);

  const formatName = (name) =>
    name ? name.charAt(0).toUpperCase() + name.slice(1) : "";

  if (loading) return <div>Loading…</div>;
  if (!rows.length) return <div>No scores yet. Be the first!</div>;

  return (
    <div className="leaderboard-page max-w-md mx-auto space-y-4 text-center">
      <h2 className="text-2xl font-bold">Leaderboard</h2>
      <p className="text-gray-600 text-sm">
        The leaderboard shows the top users based on points earned in the games.
        Each correct answer adds to your score — keep playing to climb higher!
      </p>
      <h3 className="text-lg font-medium mt-4">Top 10</h3>
      <ol className="bg-white shadow rounded divide-y">
        {rows.map((r, i) => (
          <li key={r.name} className="flex items-center justify-between px-3 py-2">
            <span className="font-medium">{i + 1}. {formatName(r.name)}</span>
            <span className="ml-4 tabular-nums">{r.points} pts</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ------------------------------ User Select ------------------------------- */
function UserSelect({ onSubmit }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const [pin, setPin] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nickname = name.trim().toLowerCase();
    if (!nickname) return;
    if (nickname === "admin") {
      if (CLOUD_PAUSED) {
        setError("Admin controls are temporarily paused while we secure the database.");
        return;
      }
      setIsAdminLogin(true);
      return;
    }

    if (CLOUD_PAUSED) {
      onSubmit(nickname);
      return;
    }

    try {
      const ref = db.ref(`/users/${nickname}/points`);
      const snap = await ref.once("value");
      if (!snap.exists()) {
        await ref.set(0);
      }
      onSubmit(nickname);
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    }
  };

  const continueAsGuest = () => {
    onSubmit("__guest__");
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (pin === "godfirst") onSubmit("admin");
    else setError("Invalid Admin PIN");
  };

  if (isAdminLogin) {
    return (
      <div className="welcome-screen min-h-screen flex items-center justify-center">
        <form onSubmit={handleAdminLogin} className="welcome-card bg-white p-6 space-y-4 w-full max-w-sm">
          <h1 className="text-xl font-semibold text-center">Admin login</h1>
          <input type="password" placeholder="Enter Admin PIN" value={pin}
            onChange={(e) => setPin(e.target.value)} className="border rounded w-full p-2" />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button type="submit" className="w-full text-white px-4 py-2 rounded"
            style={{ backgroundColor: "#0097b2" }}>Login as Admin</button>
          <button type="button" className="w-full border px-4 py-2 rounded"
            onClick={() => { setIsAdminLogin(false); setError(""); }}>Back</button>
        </form>
      </div>
    );
  }

  return (
    <div className="welcome-screen min-h-screen flex items-center justify-center">
      <form onSubmit={handleSubmit}
        className="welcome-card bg-white p-6 space-y-4 w-full max-w-sm">
        <img src="logo.png" alt="Simple Christian Catechism Logo"
          className="w-28 h-28 mx-auto mb-2 rounded" />
        <h1 className="text-xl font-semibold text-center">Pick a nickname (optional)</h1>
        <p className="text-sm text-center text-gray-600">Choose a name for this device, or continue as a guest. Cloud scores are temporarily paused.</p>

        <input type="text" placeholder="Enter your nickname"
          value={name} onChange={(e) => setName(e.target.value)}
          className="border rounded w-full p-2" />

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button type="submit" className="w-full text-white px-4 py-2 rounded"
          style={{ backgroundColor: "#0097b2" }}>
          Continue
        </button>

        <button type="button" className="w-full text-white px-4 py-2 rounded"
          style={{ backgroundColor: "#33c0d4" }} onClick={continueAsGuest}>
          Continue without nickname
        </button>

        <p className="text-xs text-center text-gray-500">
          Guests can play without saving a score to the leaderboard.
        </p>
        {!CLOUD_PAUSED && <button type="button" className="w-full text-xs text-gray-500 underline"
          onClick={() => { setIsAdminLogin(true); setError(""); }}>Admin login</button>}
      </form>
    </div>
  );
}

/* ------------------------------- Admin ------------------------------------ */
function AdminLogin({ onSuccess, onCancel }) {
  const [pin, setPin] = useState("");
  const handleSubmit = (e) => {
    e.preventDefault();
    if (pin === "godfirst") onSuccess();
    else alert("Invalid PIN");
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Enter Admin PIN</label>
        <input type="password" value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="border rounded w-full p-2" />
      </div>
      <div className="flex space-x-2">
        <button type="submit" className="text-white px-4 py-2 rounded"
          style={{ backgroundColor: "#0097b2" }}>Login</button>
        <button type="button" className="bg-gray-300 px-4 py-2 rounded"
          onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function AdminView({ questions, unlockedIds, setUnlockedIds, handleUnlockNext }) {
  const toggleUnlocked = (id) => {
    const next = unlockedIds.includes(id)
      ? unlockedIds.filter((u) => u !== id)
      : [...unlockedIds, id];
    setUnlockedIds(next);
  };

  const unlockAll = () => setUnlockedIds(questions.map((q) => q.id));

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">Part 2 is available to everyone. Media links are published with the app, so they cannot be changed from this screen.</p>
      <div className="flex space-x-2">
        <button className="text-white px-4 py-2 rounded"
          style={{ backgroundColor: "#22c55e" }} onClick={handleUnlockNext}>
          Unlock Next
        </button>
        <button className="text-white px-4 py-2 rounded"
          style={{ backgroundColor: "#0097b2" }} onClick={unlockAll}>
          Unlock All
        </button>
      </div>

      <div className="overflow-auto max-h-[70vh]">
        <table className="min-w-full border text-sm">
          <thead>
            <tr>
              <th className="border px-2 py-1 text-left">#</th>
              <th className="border px-2 py-1 text-left">Question</th>
              <th className="border px-2 py-1 text-center">Unlocked</th>
              <th className="border px-2 py-1 text-left">Song</th>
              <th className="border px-2 py-1 text-left">Mini sermon</th>
            </tr>
          </thead>
          <tbody>
            {questions.map((q) => (
              <tr key={q.id} className="odd:bg-gray-50">
                <td className="border px-2 py-1 whitespace-nowrap">{q.id}</td>
                <td className="border px-2 py-1">
                  <div className="max-w-xs truncate" title={q.question}>{q.question}</div>
                </td>
                <td className="border px-2 py-1 text-center">
                  <input type="checkbox"
                    checked={isAvailable(q, unlockedIds)}
                    disabled={q.id >= 19 && q.id <= 31}
                    onChange={() => toggleUnlocked(q.id)} />
                </td>

                <td className="border px-2 py-1">{q.song ? "Linked" : "Off"}</td>
                <td className="border px-2 py-1">{q.sermon ? "Linked" : "Off"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ----------------------------- Learn & Card ------------------------------- */
function LearnView({ questions, unlockedIds, part, setPart }) {
  const section = PARTS.find((item) => item.id === part) || PARTS[0];
  const available = questionsForPart(questions, part).filter((q) => isAvailable(q, unlockedIds));

  return (
    <div className="content-page">
      <div className="page-heading"><span className="eyebrow">LEARN AT YOUR OWN PACE</span><h1>{section.title}</h1><p>Open a question to reflect on its answer. Return whenever you like.</p></div>
      <PartPicker value={part} onChange={setPart} questions={questions} />
      <p className="section-count">{available.length} questions available</p>
      {available.length === 0 && <div className="empty-state">No questions are available in this part yet.</div>}
      <div className="question-list">{available.map((q) => (
        <QuestionCard key={q.id} question={q} />
      ))}</div>
    </div>
  );
}

function QuestionCard({ question }) {
  const [showAnswer, setShowAnswer] = useState(false);
  const [showSong, setShowSong] = useState(false);
  const [showSermon, setShowSermon] = useState(false);

  const songEmbed = transformYouTubeURL(question.song);
  const sermonEmbed = transformYouTubeURL(question.sermon);
  const songIsShorts = isYouTubeShorts(question.song);
  const sermonIsShorts = isYouTubeShorts(question.sermon);

  const iframeCommon = {
    className: "w-full",
    allow:
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
    allowFullScreen: true,
  };

  return (
    <article className="question-card">
      <div className="question-label">{question.id >= 19 && question.id <= 31 ? `PART 2 · QUESTION ${question.id - 18}` : `QUESTION ${question.id}`}</div>
      <h2>{question.question}</h2>

      <div className="flex flex-wrap gap-2">
        <button className="px-3 py-1 rounded text-white"
          style={{ backgroundColor: "#0097b2" }}
          aria-expanded={showAnswer}
          onClick={() => setShowAnswer((s) => !s)}>
          {showAnswer ? "Hide answer" : "Read answer"}
        </button>

        {songEmbed && (
          <button className="px-3 py-1 rounded text-white"
            style={{ backgroundColor: "#0097b2" }}
            onClick={() => setShowSong((s) => !s)}>
            {showSong ? "Hide Song" : "Song"}
          </button>
        )}

        {sermonEmbed && (
          <button className="px-3 py-1 rounded text-white"
            style={{ backgroundColor: "#0097b2" }}
            onClick={() => setShowSermon((s) => !s)}>
            {showSermon ? "Hide mini sermon" : "Mini sermon"}
          </button>
        )}
      </div>

      {showAnswer && <p className="answer-text">{question.answer}</p>}

      {showSong && songEmbed && (
        <div className="mt-2 rounded-lg overflow-hidden shadow-md">
          <iframe
            {...iframeCommon}
            style={{ aspectRatio: songIsShorts ? "9 / 16" : "16 / 9", height: "auto" }}
            src={songEmbed}
            title="Song"
          ></iframe>
        </div>
      )}

      {showSermon && sermonEmbed && (
        <div className="mt-2 rounded-lg overflow-hidden shadow-md">
          <iframe
            {...iframeCommon}
            style={{ aspectRatio: sermonIsShorts ? "9 / 16" : "16 / 9", height: "auto" }}
            src={sermonEmbed}
            title="Mini sermon"
          ></iframe>
        </div>
      )}
    </article>
  );
}

/* -------------------------------- Games ----------------------------------- */
function GamesView({ questions, unlockedIds, awardPoints, part, setPart }) {
  const unlocked = useMemo(
    () => questionsForPart(questions, part).filter((q) => isAvailable(q, unlockedIds)),
    [questions, unlockedIds, part]
  );
  const [mode, setMode] = useState("mcq");

  return (
    <div className="content-page games-page">
      <div className="page-heading"><span className="eyebrow">PRACTISE WHAT YOU KNOW</span><h1>Learn by playing</h1><p>Choose a part and a way to practise.</p></div>
      {CLOUD_PAUSED && <p className="text-sm text-gray-600 mb-4">Games work as usual, but points are not being saved to the leaderboard right now.</p>}
      <PartPicker value={part} onChange={setPart} questions={questions} />
      <p className="section-count">{unlocked.length} questions available</p>
      {unlocked.length === 0 ? <div className="empty-state">No questions are available in this part yet.</div> : <>
      <div className="flex flex-wrap gap-2 mb-4">
        <button className="px-3 py-1 rounded text-white"
          style={{ backgroundColor: mode === "mcq" ? "#0097b2" : "#33c0d4" }}
          onClick={() => setMode("mcq")}>Multiple Choice</button>
        <button className="px-3 py-1 rounded text-white"
          style={{ backgroundColor: mode === "fill" ? "#0097b2" : "#33c0d4" }}
          onClick={() => setMode("fill")}>Fill in the Blank</button>
        <button className="px-3 py-1 rounded text-white"
          style={{ backgroundColor: mode === "flash" ? "#0097b2" : "#33c0d4" }}
          onClick={() => setMode("flash")}>Flashcards</button>
      </div>

      {mode === "mcq" && <MCQGame key={`${part}-mcq`} questions={unlocked} awardPoints={awardPoints} />}
      {mode === "fill" && <FillBlankGame key={`${part}-fill`} questions={unlocked} awardPoints={awardPoints} />}
      {mode === "flash" && <FlashcardsGame key={`${part}-flash`} questions={unlocked} />}
      </>}
    </div>
  );
}

/* ------------------------------- MCQ Game --------------------------------- */
function MCQGame({ questions, awardPoints }) {
  const [index, setIndex] = useState(0);
  const [options, setOptions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (questions.length > 0) setOptions(getMultipleChoiceOptions(questions, index));
  }, [questions, index]);

  const handleSelect = (option) => {
    if (selected !== null) return;
    setSelected(option);
    if (option === questions[index].answer) {
      setScore((s) => s + 1);
      awardPoints && awardPoints(10);
    }
  };

  const next = () => {
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      setSelected(null);
    } else {
      setCompleted(true);
    }
  };

  if (completed) {
    return (
      <div className="space-y-4">
        <p>You scored {score} out of {questions.length}.</p>
        <button className="px-4 py-2 rounded text-white"
          style={{ backgroundColor: "#0097b2" }}
          onClick={() => {
            setIndex(0); setSelected(null); setScore(0); setCompleted(false);
          }}>
          Restart
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="font-semibold">Question {index + 1} of {questions.length}</div>
      <div className="bg-white p-4 shadow rounded">
        <p className="mb-4 font-medium">{questions[index].question}</p>
        <div className="space-y-2">
          {options.map((option, i) => (
            <button key={i}
              className={`block w-full text-left px-3 py-2 rounded border ${
                selected === null
                  ? "bg-gray-100"
                  : option === questions[index].answer
                  ? "bg-green-200"
                  : option === selected
                  ? "bg-red-200"
                  : "bg-gray-100"
              }`}
              onClick={() => handleSelect(option)}>
              {option}
            </button>
          ))}
        </div>
        {selected !== null && (
          <button className="mt-4 px-4 py-2 rounded text-white"
            style={{ backgroundColor: "#0097b2" }}
            onClick={next}>Next</button>
        )}
      </div>
    </div>
  );
}

/* --------------------------- Fill-in-the-Blank ---------------------------- */
function FillBlankGame({ questions, awardPoints }) {
  const [index, setIndex] = useState(0);
  const [data, setData] = useState(null);
  const [filled, setFilled] = useState([]);
  const [score, setScore] = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (questions.length > 0) {
      const d = generateFillBlankData(questions, index);
      setData(d);
      setFilled(d.blanks.map(() => ""));
    }
  }, [questions, index]);

  const fillWord = (word) => {
    const idx = data.blanks.findIndex((b, i) => b.hidden && filled[i] === "");
    if (idx === -1) return;
    const next = [...filled];
    next[idx] = word;
    setFilled(next);
  };

  const checkAnswer = () => {
    const ok = data.blanks.every((b, i) => !b.hidden || b.original === filled[i]);
    if (ok) {
      setScore((s) => s + 1);
      awardPoints && awardPoints(10);
    }
    if (index + 1 < questions.length) setIndex(index + 1);
    else setCompleted(true);
  };

  if (!data) return <div>Loading…</div>;

  if (completed) {
    return (
      <div className="space-y-4">
        <p>You scored {score} out of {questions.length}.</p>
        <button className="px-4 py-2 rounded text-white"
          style={{ backgroundColor: "#0097b2" }}
          onClick={() => { setIndex(0); setScore(0); setCompleted(false); }}>
          Restart
        </button>
      </div>
    );
  }

  const displaySentence = data.blanks.map((b, i) =>
    !b.hidden ? b.original : filled[i] || "____"
  );

  return (
    <div className="space-y-4">
      <div className="font-semibold">Question {index + 1} of {questions.length}</div>
      <div className="bg-white p-4 shadow rounded">
        <p className="mb-4 font-medium">{questions[index].question}</p>
        <p className="mb-4 text-lg">{displaySentence.join("")}</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {data.options.map((word, idx) => (
            <button key={idx}
              className="bg-gray-200 px-2 py-1 rounded hover:bg-gray-300"
              onClick={() => fillWord(word)}>
              {word}
            </button>
          ))}
        </div>
        <button className="px-4 py-2 rounded text-white"
          style={{ backgroundColor: "#0097b2" }}
          onClick={checkAnswer}>
          {index + 1 < questions.length ? "Next" : "Finish"}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------ Flashcards -------------------------------- */
function FlashcardsGame({ questions }) {
  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [completed, setCompleted] = useState(false);

  const next = () => {
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      setShowAnswer(false);
    } else {
      setCompleted(true);
    }
  };

  if (completed) {
    return (
      <div className="space-y-4">
        <p>You've gone through all flashcards.</p>
        <button className="px-4 py-2 rounded text-white"
          style={{ backgroundColor: "#0097b2" }}
          onClick={() => { setIndex(0); setShowAnswer(false); setCompleted(false); }}>
          Restart
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="font-semibold">Card {index + 1} of {questions.length}</div>
      <div className="bg-white p-6 shadow rounded cursor-pointer hover:shadow-lg transition"
        onClick={() => setShowAnswer((s) => !s)} style={{ minHeight: "8rem" }}>
        {!showAnswer ? (
          <div className="text-center">
            <p className="font-medium">{questions[index].question}</p>
            <p className="text-sm text-gray-500 mt-2">Tap card to reveal answer</p>
          </div>
        ) : (
          <div className="text-center">
            <p className="font-medium">{questions[index].answer}</p>
            <p className="text-sm text-gray-500 mt-2">Tap card to hide answer</p>
          </div>
        )}
      </div>
      <button className="px-4 py-2 rounded text-white"
        style={{ backgroundColor: "#0097b2" }}
        onClick={next}>
        {index + 1 < questions.length ? "Next" : "Finish"}
      </button>
    </div>
  );
}

/* ------------------------------- Mount ------------------------------------ */
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
