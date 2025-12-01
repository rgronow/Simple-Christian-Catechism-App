// app.js - Firebase + Lightweight Identity + HomeScreen + Leaderboard + Scoring
const { useState, useEffect } = React;

/* ----------------------------- YT URL Helpers ----------------------------- */
function transformYouTubeURL(urlOrId) {
  if (!urlOrId) return "";
  const s = String(urlOrId).trim();

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
  databaseURL:
    "https://simplechristiancatechism-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "simplechristiancatechism",
  storageBucket: "simplechristiancatechism.appspot.com",
  messagingSenderId: "605718866345",
  appId: "1:605718866345:web:60c9e790e5148ff78fbcb8",
  measurementId: "G-JKY86F4M6H",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const dbRef = db.ref("/");

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
  const blanksToHide = shuffledIndices.slice(
    0,
    Math.min(blankCount, wordIndices.length)
  );
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
  const [view, setView] = useState("home");
  const [adminMode, setAdminMode] = useState(false);
  const [adminAuth, setAdminAuth] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [user, setUser] = useState(
    localStorage.getItem("catechismUser") || ""
  );

  useEffect(() => {
    const unsubscribe = dbRef.on(
      "value",
      (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setQuestions((data.questions || []).filter(Boolean));
          setUnlockedIds(data.unlockedIds || []);
        } else {
          setLoadError("No data found in the database.");
        }
      },
      (error) => {
        console.error(error);
        setLoadError(error.message);
      }
    );
    return () => unsubscribe();
  }, []);

  const updateUnlockedIdsInFirebase = (newUnlockedIds) =>
    db.ref(`/unlockedIds`).set(newUnlockedIds);

  const updateQuestionInFirebase = (updatedQuestion) =>
    db.ref(`/questions/${updatedQuestion.id}`).set(updatedQuestion);

  const handleUnlockNext = () => {
    const sorted = [...questions].sort((a, b) => a.id - b.id);
    const locked = sorted.find((q) => !unlockedIds.includes(q.id));
    if (locked) {
      updateUnlockedIdsInFirebase([...unlockedIds, locked.id]);
    }
  };

  // Award points only for real nicknames (not guest or admin)
  const awardPoints = (username, amount) => {
    if (!username || username === "__guest__" || username === "admin") return;
    const ref = db.ref(`/users/${username}/points`);
    ref.transaction((curr) => (curr || 0) + amount);
  };

  // No user chosen yet -> landing / nickname screen
  if (!user) {
    return (
      <UserSelect
        onSubmit={(name) => {
          setUser(name);
        }}
      />
    );
  }

  // Admin mode gate
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
    <div className="min-h-screen flex flex-col">
      {/* HEADER */}
      <header className="shadow" style={{ backgroundColor: "#ffbd59" }}>
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-semibold mb-2 sm:mb-0 text-center sm:text-left text-white">
            Simple Christian Catechism
          </h1>
          <nav className="flex flex-wrap justify-center gap-2">
            <button
              className="px-3 py-1 rounded text-white"
              style={{
                backgroundColor: view === "home" ? "#0097b2" : "#33c0d4",
              }}
              onClick={() => setView("home")}
            >
              Home
            </button>
            <button
              className="px-3 py-1 rounded text-white"
              style={{
                backgroundColor: view === "learn" ? "#0097b2" : "#33c0d4",
              }}
              onClick={() => setView("learn")}
            >
              Learn
            </button>
            <button
              className="px-3 py-1 rounded text-white"
              style={{
                backgroundColor: view === "games" ? "#0097b2" : "#33c0d4",
              }}
              onClick={() => setView("games")}
            >
              Games
            </button>
            <button
              className="px-3 py-1 rounded text-white"
              style={{
                backgroundColor:
                  view === "leaderboard" ? "#0097b2" : "#33c0d4",
              }}
              onClick={() => setView("leaderboard")}
            >
              Leaderboard
            </button>
          </nav>
        </div>
      </header>

      {/* MAIN */}
      <main className="flex-1 max-w-5xl mx-auto p-4">
        {loadError ? (
          <div className="text-red-600">Error loading data: {loadError}</div>
        ) : questions.length === 0 ? (
          <div>Loading…</div>
        ) : adminMode ? (
          <AdminView
            questions={questions}
            unlockedIds={unlockedIds}
            setUnlockedIds={updateUnlockedIdsInFirebase}
            handleUnlockNext={handleUnlockNext}
            updateQuestion={updateQuestionInFirebase}
          />
        ) : view === "home" ? (
          <HomeScreen onNavigate={setView} />
        ) : view === "learn" ? (
          <LearnView questions={questions} unlockedIds={unlockedIds} />
        ) : view === "games" ? (
          <GamesView
            questions={questions}
            unlockedIds={unlockedIds}
            awardPoints={(amt) => awardPoints(user, amt)}
          />
        ) : view === "leaderboard" ? (
          <Leaderboard />
        ) : null}
      </main>

      {/* FOOTER */}
      <footer className="bg-gray-100 border-t p-4 text-center space-x-2">
        <span className="text-sm text-gray-600 mr-4">
          User: {user === "__guest__" ? "Guest" : user}
        </span>

        {/* Admin toggle */}
        <button
          className="px-3 py-1 rounded text-white"
          style={{ backgroundColor: adminMode ? "#0097b2" : "#33c0d4" }}
          onClick={() => {
            setAdminMode(!adminMode);
            if (adminMode) setAdminAuth(false);
          }}
        >
          {adminMode ? "Close Admin" : "Admin"}
        </button>

        {/* Switch user */}
        <button
          className="px-3 py-1 rounded text-white"
          style={{ backgroundColor: "#0097b2" }}
          onClick={() => {
            setUser("");
            localStorage.removeItem("catechismUser");
          }}
        >
          Switch User
        </button>

        {/* Delete user – only real nicknames, not admin or guest */}
        <button
          className="px-3 py-1 rounded text-white disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: "#ef4444" }}
          disabled={user === "admin" || user === "__guest__"}
          onClick={() => {
            if (!user || user === "admin" || user === "__guest__") return;
            const ok = window.confirm(
              `Delete user "${user}" and all their points? This cannot be undone.`
            );
            if (!ok) return;

            // Remove only the points key (rules allow this; Firebase prunes empty parent)
            db.ref(`/users/${user}/points`)
              .remove()
              .then(() => {
                localStorage.removeItem("catechismUser");
                setUser("");
                alert("User deleted.");
              })
              .catch((err) => {
                console.error("Error deleting user:", err);
                alert("Sorry, something went wrong deleting this user.");
              });
          }}
        >
          Delete User
        </button>
      </footer>
    </div>
  );
}

/* ------------------------------ Home Screen ------------------------------- */
function HomeScreen({ onNavigate }) {
  return (
    <div className="max-w-2xl mx-auto text-center space-y-6">
      <h2 className="text-2xl font-bold">Welcome!</h2>
      <p className="text-gray-700">
        This app helps you learn the Simple Christian Catechism through reading,
        reflection, and interactive games.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="p-4 bg-white shadow rounded space-y-2">
          <h3 className="font-semibold" style={{ color: "#0097b2" }}>
            Learn
          </h3>
          <p className="text-sm text-gray-600">
            Read each question, see the answer, and watch the song or the
            2-minute sermon that goes with it.
          </p>
          <button
            className="px-4 py-2 rounded text-white"
            style={{ backgroundColor: "#0097b2" }}
            onClick={() => onNavigate("learn")}
          >
            Go to Learn
          </button>
        </div>
        <div className="p-4 bg-white shadow rounded space-y-2">
          <h3 className="font-semibold" style={{ color: "#0097b2" }}>
            Games
          </h3>
          <p className="text-sm text-gray-600">
            Test your knowledge with multiple choice, fill-in-the-blank, and
            flashcards. Earn points for correct answers!
          </p>
          <button
            className="px-4 py-2 rounded text-white"
            style={{ backgroundColor: "#0097b2" }}
            onClick={() => onNavigate("games")}
          >
            Go to Games
          </button>
        </div>
      </div>
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
    <div className="max-w-md mx-auto space-y-4 text-center">
      <h2 className="text-2xl font-bold">Leaderboard</h2>
      <p className="text-gray-600 text-sm">
        The leaderboard shows the top users based on points earned in the
        games. Each correct answer adds to your score — keep playing to climb
        higher!
      </p>
      <h3 className="text-lg font-medium mt-4">Top 10</h3>
      <ol className="bg-white shadow rounded divide-y">
        {rows.map((r, i) => (
          <li
            key={r.name}
            className="flex items-center justify-between px-3 py-2"
          >
            <span className="font-medium">
              {i + 1}. {formatName(r.name)}
            </span>
            <span className="ml-4 tabular-nums">{r.points} pts</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ------------------------------ User Select ------------------------------- */
// USER SELECTION SCREEN (nickname optional + admin via "admin")
function UserSelect({ onSubmit }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const [pin, setPin] = useState("");

  // Normal nickname flow
  const handleSubmit = async (e) => {
    e.preventDefault();
    const rawName = name.trim();
    if (!rawName) return;

    const nicknameKey = rawName.toLowerCase();

    // Special case: "admin" goes to PIN screen
    if (nicknameKey === "admin") {
      setIsAdminLogin(true);
      return;
    }

    try {
      // We ONLY ever write to /users/<nickname>/points
      const snap = await db.ref(`/users/${nicknameKey}/points`).once("value");

      // First time this nickname is used: create with 0 points
      if (!snap.exists()) {
        await db.ref(`/users/${nicknameKey}/points`).set(0);
      }

      onSubmit(nicknameKey);
      localStorage.setItem("catechismUser", nicknameKey);
    } catch (err) {
      console.error("Error logging in:", err?.code, err?.message);
      setError("Something went wrong. Please try again.");
    }
  };

  // Admin PIN flow
  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (pin === "godfirst") {
      onSubmit("admin");
      localStorage.setItem("catechismUser", "admin");
    } else {
      setError("Invalid Admin PIN");
    }
  };

  // ----- Normal nickname form -----
  if (!isAdminLogin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <form
          onSubmit={handleSubmit}
          className="bg-white shadow-md rounded p-6 space-y-4 w-full max-w-sm text-center"
        >
          {/* Logo (1:1 image) */}
          <div className="flex justify-center mb-2">
            <img
              src="logo.png"
              alt="Simple Christian Catechism"
              className="w-24 h-24 rounded-full object-contain"
            />
          </div>

          <h1 className="text-xl font-semibold">Welcome</h1>
          <p className="text-sm text-gray-600">
            You can use the app anonymously or choose a nickname so that your
            quiz scores appear on the leaderboard.
          </p>

          <input
            type="text"
            placeholder="Enter a nickname (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border rounded w-full p-2"
          />

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="space-y-2">
            {/* Continue with nickname (creates /users/<name>/points) */}
            <button
              type="submit"
              className="w-full text-white px-4 py-2 rounded"
              style={{ backgroundColor: "#0097b2" }}
            >
              Continue with nickname
            </button>

            {/* Anonymous usage: guest mode uses sentinel "__guest__" */}
            <button
              type="button"
              className="w-full border px-4 py-2 rounded"
              onClick={() => {
                onSubmit("__guest__");
                localStorage.setItem("catechismUser", "__guest__");
              }}
            >
              Continue without nickname
            </button>

            {/* Hidden admin link */}
            <button
              type="button"
              className="w-full text-xs text-gray-500 underline mt-2"
              onClick={() => setIsAdminLogin(true)}
            >
              Admin login
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ----- Admin PIN form -----
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form
        onSubmit={handleAdminLogin}
        className="bg-white shadow-md rounded p-6 space-y-4 w-full max-w-sm text-center"
      >
        <h1 className="text-xl font-semibold">Admin Login</h1>
        <input
          type="password"
          placeholder="Enter Admin PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="border rounded w-full p-2"
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          className="w-full text-white px-4 py-2 rounded"
          style={{ backgroundColor: "#0097b2" }}
        >
          Login as Admin
        </button>
        <button
          type="button"
          className="w-full bg-gray-300 text-black px-4 py-2 rounded hover:bg-gray-400"
          onClick={() => setIsAdminLogin(false)}
        >
          Back
        </button>
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
        <label className="block text-sm font-medium mb-1">
          Enter Admin PIN
        </label>
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="border rounded w-full p-2"
        />
      </div>
      <div className="flex space-x-2">
        <button
          type="submit"
          className="text-white px-4 py-2 rounded"
          style={{ backgroundColor: "#0097b2" }}
        >
          Login
        </button>
        <button
          type="button"
          className="bg-gray-300 px-4 py-2 rounded"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function AdminView({
  questions,
  unlockedIds,
  setUnlockedIds,
  handleUnlockNext,
  updateQuestion,
}) {
  const toggleUnlocked = (id) => {
    const next = unlockedIds.includes(id)
      ? unlockedIds.filter((u) => u !== id)
      : [...unlockedIds, id];
    setUnlockedIds(next);
  };

  const handleFieldChange = (id, field, value) => {
    const q = questions.find((x) => x.id === id);
    if (q) updateQuestion({ ...q, [field]: value });
  };

  const unlockAll = () => setUnlockedIds(questions.map((q) => q.id));

  return (
    <div className="space-y-4">
      <div className="flex space-x-2">
        <button
          className="text-white px-4 py-2 rounded"
          style={{ backgroundColor: "#22c55e" }}
          onClick={handleUnlockNext}
        >
          Unlock Next
        </button>
        <button
          className="text-white px-4 py-2 rounded"
          style={{ backgroundColor: "#0097b2" }}
          onClick={unlockAll}
        >
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
              <th className="border px-2 py-1 text-left">2-min Sermon</th>
            </tr>
          </thead>
          <tbody>
            {questions.map((q) => (
              <tr key={q.id} className="odd:bg-gray-50">
                <td className="border px-2 py-1 whitespace-nowrap">{q.id}</td>
                <td className="border px-2 py-1">
                  <div
                    className="max-w-xs truncate"
                    title={q.question}
                  >{q.question}</div>
                </td>
                <td className="border px-2 py-1 text-center">
                  <input
                    type="checkbox"
                    checked={unlockedIds.includes(q.id)}
                    onChange={() => toggleUnlocked(q.id)}
                  />
                </td>

                <td className="border px-2 py-1">
                  <input
                    type="text"
                    className="border rounded w-full p-1 text-xs"
                    value={q.song || ""}
                    onChange={(e) =>
                      handleFieldChange(q.id, "song", e.target.value)
                    }
                    placeholder="Paste Song YouTube link or ID"
                  />
                </td>

                <td className="border px-2 py-1">
                  <input
                    type="text"
                    className="border rounded w-full p-1 text-xs"
                    value={q.sermon || ""}
                    onChange={(e) =>
                      handleFieldChange(q.id, "sermon", e.target.value)
                    }
                    placeholder="Paste 2-min Sermon YouTube link or ID"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ----------------------------- Learn & Card ------------------------------- */
function LearnView({ questions, unlockedIds }) {
  const unlocked = questions.filter((q) => unlockedIds.includes(q.id));
  if (unlocked.length === 0)
    return <div>No questions unlocked yet. Please unlock in admin.</div>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Unlocked {unlocked.length} of {questions.length} questions
      </p>
      {unlocked.map((q) => (
        <QuestionCard key={q.id} question={q} />
      ))}
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
    <div className="bg-white shadow hover:shadow-lg transition rounded p-4 space-y-2">
      <h2 className="text-lg font-semibold">
        {question.id}. {question.question}
      </h2>

      <div className="flex flex-wrap gap-2">
        <button
          className="px-3 py-1 rounded text-white"
          style={{ backgroundColor: "#0097b2" }}
          onClick={() => setShowAnswer((s) => !s)}
        >
          {showAnswer ? "Hide" : "Answer"}
        </button>

        {songEmbed && (
          <button
            className="px-3 py-1 rounded text-white"
            style={{ backgroundColor: "#0097b2" }}
            onClick={() => setShowSong((s) => !s)}
          >
            {showSong ? "Hide Song" : "Song"}
          </button>
        )}

        {sermonEmbed && (
          <button
            className="px-3 py-1 rounded text-white"
            style={{ backgroundColor: "#0097b2" }}
            onClick={() => setShowSermon((s) => !s)}
          >
            {showSermon ? "Hide Sermon" : "2-min Sermon"}
          </button>
        )}
      </div>

      {showAnswer && (
        <p className="text-gray-800 leading-relaxed">{question.answer}</p>
      )}

      {showSong && songEmbed && (
        <div className="mt-2 rounded-lg overflow-hidden shadow-md">
          <iframe
            {...iframeCommon}
            style={{
              aspectRatio: songIsShorts ? "9 / 16" : "16 / 9",
              height: "auto",
            }}
            src={songEmbed}
            title="Song"
          ></iframe>
        </div>
      )}

      {showSermon && sermonEmbed && (
        <div className="mt-2 rounded-lg overflow-hidden shadow-md">
          <iframe
            {...iframeCommon}
            style={{
              aspectRatio: sermonIsShorts ? "9 / 16" : "16 / 9",
              height: "auto",
            }}
            src={sermonEmbed}
            title="2-min Sermon"
          ></iframe>
        </div>
      )}
    </div>
  );
}

/* -------------------------------- Games ----------------------------------- */
function GamesView({ questions, unlockedIds, awardPoints }) {
  const unlocked = questions.filter((q) => unlockedIds.includes(q.id));
  const [mode, setMode] = useState("mcq");
  if (unlocked.length === 0)
    return <div>No unlocked questions available for games.</div>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Unlocked {unlocked.length} of {questions.length} questions
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          className="px-3 py-1 rounded text-white"
          style={{ backgroundColor: mode === "mcq" ? "#0097b2" : "#33c0d4" }}
          onClick={() => setMode("mcq")}
        >
          Multiple Choice
        </button>
        <button
          className="px-3 py-1 rounded text-white"
          style={{ backgroundColor: mode === "fill" ? "#0097b2" : "#33c0d4" }}
          onClick={() => setMode("fill")}
        >
          Fill in the Blank
        </button>
        <button
          className="px-3 py-1 rounded text-white"
          style={{ backgroundColor: mode === "flash" ? "#0097b2" : "#33c0d4" }}
          onClick={() => setMode("flash")}
        >
          Flashcards
        </button>
      </div>

      {mode === "mcq" && (
        <MCQGame questions={unlocked} awardPoints={awardPoints} />
      )}
      {mode === "fill" && (
        <FillBlankGame questions={unlocked} awardPoints={awardPoints} />
      )}
      {mode === "flash" && <FlashcardsGame questions={unlocked} />}
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
    if (questions.length > 0) {
      setOptions(getMultipleChoiceOptions(questions, index));
    }
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
        <p>
          You scored {score} out of {questions.length}.
        </p>
        <button
          className="px-4 py-2 rounded text-white"
          style={{ backgroundColor: "#0097b2" }}
          onClick={() => {
            setIndex(0);
            setSelected(null);
            setScore(0);
            setCompleted(false);
          }}
        >
          Restart
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="font-semibold">
        Question {index + 1} of {questions.length}
      </div>
      <div className="bg-white p-4 shadow rounded">
        <p className="mb-4 font-medium">{questions[index].question}</p>
        <div className="space-y-2">
          {options.map((option, i) => (
            <button
              key={i}
              className={`block w-full text-left px-3 py-2 rounded border ${
                selected === null
                  ? "bg-gray-100"
                  : option === questions[index].answer
                  ? "bg-green-200"
                  : option === selected
                  ? "bg-red-200"
                  : "bg-gray-100"
              }`}
              onClick={() => handleSelect(option)}
            >
              {option}
            </button>
          ))}
        </div>
        {selected !== null && (
          <button
            className="mt-4 px-4 py-2 rounded text-white"
            style={{ backgroundColor: "#0097b2" }}
            onClick={next}
          >
            Next
          </button>
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
    const ok = data.blanks.every(
      (b, i) => !b.hidden || b.original === filled[i]
    );
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
        <p>
          You scored {score} out of {questions.length}.
        </p>
        <button
          className="px-4 py-2 rounded text-white"
          style={{ backgroundColor: "#0097b2" }}
          onClick={() => {
            setIndex(0);
            setScore(0);
            setCompleted(false);
          }}
        >
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
      <div className="font-semibold">
        Question {index + 1} of {questions.length}
      </div>
      <div className="bg-white p-4 shadow rounded">
        <p className="mb-4 font-medium">{questions[index].question}</p>
        <p className="mb-4 text-lg">{displaySentence.join("")}</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {data.options.map((word, idx) => (
            <button
              key={idx}
              className="bg-gray-200 px-2 py-1 rounded hover:bg-gray-300"
              onClick={() => fillWord(word)}
            >
              {word}
            </button>
          ))}
        </div>
        <button
          className="px-4 py-2 rounded text-white"
          style={{ backgroundColor: "#0097b2" }}
          onClick={checkAnswer}
        >
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
        <button
          className="px-4 py-2 rounded text-white"
          style={{ backgroundColor: "#0097b2" }}
          onClick={() => {
            setIndex(0);
            setShowAnswer(false);
            setCompleted(false);
          }}
        >
          Restart
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="font-semibold">
        Card {index + 1} of {questions.length}
      </div>
      <div
        className="bg-white p-6 shadow rounded cursor-pointer hover:shadow-lg transition"
        onClick={() => setShowAnswer((s) => !s)}
        style={{ minHeight: "8rem" }}
      >
        {!showAnswer ? (
          <div className="text-center">
            <p className="font-medium">{questions[index].question}</p>
            <p className="text-sm text-gray-500 mt-2">
              Tap card to reveal answer
            </p>
          </div>
        ) : (
          <div className="text-center">
            <p className="font-medium">{questions[index].answer}</p>
            <p className="text-sm text-gray-500 mt-2">
              Tap card to hide answer
            </p>
          </div>
        )}
      </div>
      <button
        className="px-4 py-2 rounded text-white"
        style={{ backgroundColor: "#0097b2" }}
        onClick={next}
      >
        {index + 1 < questions.length ? "Next" : "Finish"}
      </button>
    </div>
  );
}

/* ------------------------------- Mount ------------------------------------ */
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
