// app.js - Firebase + Lightweight Identity (Global Admin Unlocks, 3 Video Fields)

const { useState, useEffect } = React;

// =================================================================
// 1. INITIALIZE FIREBASE
// =================================================================
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

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const dbRef = db.ref('/');

// =================================================================
// Utility functions
// =================================================================
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
  const options = shuffle([correctAnswer, ...shuffled]);
  return options;
}

function generateFillBlankData(questions, currentIndex, blankCount = 3) {
  const answer = questions[currentIndex].answer;
  const words = answer.split(/(\s+)/);
  const wordIndices = words
    .map((w, idx) => (/\s/.test(w) ? null : idx))
    .filter((idx) => idx !== null);
  const shuffledIndices = shuffle(wordIndices);
  const blanksToHide = shuffledIndices.slice(0, Math.min(blankCount, wordIndices.length));
  const blanks = words.map((w, idx) => {
    if (blanksToHide.includes(idx) && !/\s/.test(w)) {
      return { original: w, hidden: true };
    }
    return { original: w, hidden: false };
  });
  const hiddenWords = blanks.filter((b) => b.hidden).map((b) => b.original);
  const otherWords = questions
    .filter((_, idx) => idx !== currentIndex)
    .flatMap((q) => q.answer.split(/\s+/))
    .filter((w) => w.length > 3);
  const distractors = shuffle(otherWords).slice(0, blankCount);
  const options = shuffle([...hiddenWords, ...distractors]);
  return { blanks, options };
}

// =================================================================
// MAIN APP
// =================================================================
function App() {
  const [questions, setQuestions] = useState([]);
  const [unlockedIds, setUnlockedIds] = useState([]);
  const [view, setView] = useState('learn');
  const [adminMode, setAdminMode] = useState(false);
  const [adminAuth, setAdminAuth] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const [user, setUser] = useState(localStorage.getItem("catechismUser") || "");

  // Fetch data from Firebase
  useEffect(() => {
    const unsubscribe = dbRef.on('value', (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const allQuestions = (data.questions || []).filter(Boolean);
        setQuestions(allQuestions);
        setUnlockedIds(data.unlockedIds || []); // global unlocks
      } else {
        setLoadError('No data found in the database.');
      }
    }, (error) => {
      console.error(error);
      setLoadError(error.message);
    });
    return () => unsubscribe();
  }, []);

  const updateUnlockedIdsInFirebase = (newUnlockedIds) => {
    db.ref(`/unlockedIds`).set(newUnlockedIds);
  };

  const updateQuestionInFirebase = (updatedQuestion) => {
    db.ref(`/questions/${updatedQuestion.id}`).set(updatedQuestion);
  };

  const handleUnlockNext = () => {
    const sortedQuestions = [...questions].sort((a, b) => a.id - b.id);
    const locked = sortedQuestions.find((q) => !unlockedIds.includes(q.id));
    if (locked) {
      const newUnlockedIds = [...unlockedIds, locked.id];
      updateUnlockedIdsInFirebase(newUnlockedIds);
    }
  };

  // If no nickname chosen, show user entry screen
  if (!user) {
    return <UserSelect onSubmit={(name) => {
      setUser(name);
      localStorage.setItem("catechismUser", name);
    }} />;
  }

  // If admin mode active but not logged in
  if (adminMode && !adminAuth) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <h1 className="text-2xl font-bold mb-4">Admin Login</h1>
        <AdminLogin onSuccess={() => setAdminAuth(true)} onCancel={() => setAdminMode(false)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* HEADER */}
      <header className="bg-white shadow">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-semibold mb-2 sm:mb-0 text-center sm:text-left">
            Simple Christian Catechism
          </h1>
          <nav className="flex flex-wrap justify-center gap-2">
            <button
              className="px-3 py-1 rounded text-white"
              style={{ backgroundColor: view === 'learn' ? '#0097b2' : '#ccc' }}
              onClick={() => setView('learn')}
            >
              Learn
            </button>
            <button
              className="px-3 py-1 rounded text-white"
              style={{ backgroundColor: view === 'games' ? '#0097b2' : '#ccc' }}
              onClick={() => setView('games')}
            >
              Games
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
        ) : view === 'learn' ? (
          <LearnView questions={questions} unlockedIds={unlockedIds} />
        ) : (
          <GamesView questions={questions} unlockedIds={unlockedIds} />
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-gray-100 border-t p-4 text-center space-x-2">
        <span className="text-sm text-gray-600 mr-4">User: {user}</span>
        <button
          className="px-3 py-1 rounded text-white"
          style={{ backgroundColor: adminMode ? '#0097b2' : '#ccc' }}
          onClick={() => {
            setAdminMode(!adminMode);
            if (adminMode) setAdminAuth(false);
          }}
        >
          {adminMode ? 'Close Admin' : 'Admin'}
        </button>
        <button
          className="px-3 py-1 rounded text-white"
          style={{ backgroundColor: '#f59e0b' }}
          onClick={() => {
            setUser("");
            localStorage.removeItem("catechismUser");
          }}
        >
          Switch User
        </button>
        <button
          className="px-3 py-1 rounded text-white disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#dc2626' }}
          disabled={user.toLowerCase() === "admin"}
          onClick={() => {
            if (window.confirm("Are you sure you want to permanently delete this user?")) {
              db.ref(`/users/${user}`).remove().then(() => {
                localStorage.removeItem("catechismUser");
                setUser("");
              });
            }
          }}
        >
          Delete User
        </button>
      </footer>
    </div>
  );
}

// =================================================================
// USER SELECTION SCREEN (nickname + admin PIN check)
// =================================================================
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
      setIsAdminLogin(true);
      return;
    }

    try {
      const snapshot = await db.ref(`/users/${nickname}`).once("value");
      if (!snapshot.exists()) {
        await db.ref(`/users/${nickname}`).set({ created: Date.now() });
      }
      onSubmit(nickname);
      localStorage.setItem("catechismUser", nickname);
    } catch (err) {
      console.error("Error logging in:", err);
      setError("Something went wrong. Please try again.");
    }
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (pin === "godfirst") {
      onSubmit("admin");
      localStorage.setItem("catechismUser", "admin");
    } else {
      setError("Invalid Admin PIN");
    }
  };

  if (!isAdminLogin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <form
          onSubmit={handleSubmit}
          className="bg-white shadow-md rounded p-6 space-y-4 w-full max-w-sm"
        >
          <h1 className="text-xl font-semibold text-center">Pick a nickname</h1>
          <input
            type="text"
            placeholder="Enter your nickname"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border rounded w-full p-2"
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            className="w-full text-white px-4 py-2 rounded"
            style={{ backgroundColor: '#0097b2' }}
          >
            Continue
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form
        onSubmit={handleAdminLogin}
        className="bg-white shadow-md rounded p-6 space-y-4 w-full max-w-sm"
      >
        <h1 className="text-xl font-semibold text-center">Admin Login</h1>
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
          style={{ backgroundColor: '#0097b2' }}
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

// =================================================================
// ADMIN LOGIN COMPONENT
// =================================================================
function AdminLogin({ onSuccess, onCancel }) {
  const [pin, setPin] = useState('');
  const handleSubmit = (e) => {
    e.preventDefault();
    if (pin === 'godfirst') {
      onSuccess();
    } else {
      alert('Invalid PIN');
    }
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Enter Admin PIN</label>
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
          style={{ backgroundColor: '#0097b2' }}
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
// =================================================================
// ADMIN VIEW (global unlocks apply to all users)
// =================================================================
function AdminView({ questions, unlockedIds, setUnlockedIds, handleUnlockNext, updateQuestion }) {
  const toggleUnlocked = (id) => {
    let newUnlockedIds;
    if (unlockedIds.includes(id)) {
      newUnlockedIds = unlockedIds.filter((uid) => uid !== id);
    } else {
      newUnlockedIds = [...unlockedIds, id];
    }
    setUnlockedIds(newUnlockedIds);
  };

  const handleFieldChange = (id, field, value) => {
    const questionToUpdate = questions.find((q) => q.id === id);
    if (questionToUpdate) {
      updateQuestion({ ...questionToUpdate, [field]: value });
    }
  };

  const unlockAll = () => {
    const allIds = questions.map((q) => q.id);
    setUnlockedIds(allIds);
  };

  return (
    <div className="space-y-4">
      <div className="flex space-x-2">
        <button
          className="text-white px-4 py-2 rounded"
          style={{ backgroundColor: '#16a34a' }}
          onClick={handleUnlockNext}
        >
          Unlock Next
        </button>
        <button
          className="text-white px-4 py-2 rounded"
          style={{ backgroundColor: '#0097b2' }}
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
              <th className="border px-2 py-1 text-left">Answer Video</th>
              <th className="border px-2 py-1 text-left">Song</th>
              <th className="border px-2 py-1 text-left">Sermon</th>
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
                    value={q.youtube || ''}
                    onChange={(e) => handleFieldChange(q.id, 'youtube', e.target.value)}
                    placeholder="Paste Answer video link"
                  />
                </td>
                <td className="border px-2 py-1">
                  <input
                    type="text"
                    className="border rounded w-full p-1 text-xs"
                    value={q.song || ''}
                    onChange={(e) => handleFieldChange(q.id, 'song', e.target.value)}
                    placeholder="Paste Song link"
                  />
                </td>
                <td className="border px-2 py-1">
                  <input
                    type="text"
                    className="border rounded w-full p-1 text-xs"
                    value={q.sermon || ''}
                    onChange={(e) => handleFieldChange(q.id, 'sermon', e.target.value)}
                    placeholder="Paste Sermon link"
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

// =================================================================
// LEARN VIEW
// =================================================================
function LearnView({ questions, unlockedIds }) {
  const unlocked = questions.filter((q) => unlockedIds.includes(q.id));
  if (unlocked.length === 0) {
    return <div>No questions unlocked yet. Please unlock in admin.</div>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">Unlocked {unlocked.length} of {questions.length} questions</p>
      {unlocked.map((q) => (
        <QuestionCard key={q.id} question={q} />
      ))}
    </div>
  );
}

// =================================================================
// QUESTION CARD
// =================================================================
function QuestionCard({ question }) {
  const [showAnswer, setShowAnswer] = useState(false);
  const [showSong, setShowSong] = useState(false);
  const [showSermon, setShowSermon] = useState(false);

  return (
    <div className="bg-white shadow hover:shadow-lg transition rounded p-4 space-y-2">
      <h2 className="text-lg font-semibold">
        {question.id}. {question.question}
      </h2>

      {/* Buttons row */}
      <div className="flex flex-wrap gap-2">
        <button
          className="px-3 py-1 rounded text-white"
          style={{ backgroundColor: '#0097b2' }}
          onClick={() => setShowAnswer(!showAnswer)}
        >
          {showAnswer ? 'Hide' : 'Show'} Answer
        </button>

        {question.song && (
          <button
            className="px-3 py-1 rounded text-white"
            style={{ backgroundColor: '#0097b2' }}
            onClick={() => setShowSong(!showSong)}
          >
            {showSong ? 'Hide Song' : 'Song'}
          </button>
        )}

        {question.sermon && (
          <button
            className="px-3 py-1 rounded text-white"
            style={{ backgroundColor: '#0097b2' }}
            onClick={() => setShowSermon(!showSermon)}
          >
            {showSermon ? 'Hide Sermon' : '5 min Sermon'}
          </button>
        )}
      </div>

      {/* Answer */}
      {showAnswer && (
        <p className="text-gray-700 leading-relaxed">
          {question.answer}
        </p>
      )}

      {/* Song video */}
      {showSong && (
        <div className="mt-2 rounded-lg overflow-hidden shadow-md">
          <iframe
            className="w-full h-48"
            src={transformYouTubeURL(question.song)}
            title="Song"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        </div>
      )}

      {/* Sermon video */}
      {showSermon && (
        <div className="mt-2 rounded-lg overflow-hidden shadow-md">
          <iframe
            className="w-full h-48"
            src={transformYouTubeURL(question.sermon)}
            title="Mini Sermon"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        </div>
      )}
    </div>
  );
}

function transformYouTubeURL(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v) return `https://www.youtube.com/embed/${v}`;
    }
    if (u.hostname === 'youtu.be') {
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    }
    return url;
  } catch (e) {
    return url;
  }
}
// =================================================================
// GAMES VIEW
// =================================================================
function GamesView({ questions, unlockedIds }) {
  const unlocked = questions.filter((q) => unlockedIds.includes(q.id));
  const [mode, setMode] = useState('mcq');

  if (unlocked.length === 0) {
    return <div>No unlocked questions available for games.</div>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Unlocked {unlocked.length} of {questions.length} questions
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          className="px-3 py-1 rounded text-white"
          style={{ backgroundColor: mode === 'mcq' ? '#0097b2' : '#ccc' }}
          onClick={() => setMode('mcq')}
        >
          Multiple Choice
        </button>
        <button
          className="px-3 py-1 rounded text-white"
          style={{ backgroundColor: mode === 'fill' ? '#0097b2' : '#ccc' }}
          onClick={() => setMode('fill')}
        >
          Fill in the Blank
        </button>
        <button
          className="px-3 py-1 rounded text-white"
          style={{ backgroundColor: mode === 'flash' ? '#0097b2' : '#ccc' }}
          onClick={() => setMode('flash')}
        >
          Flashcards
        </button>
      </div>
      {mode === 'mcq' && <MCQGame questions={unlocked} />}
      {mode === 'fill' && <FillBlankGame questions={unlocked} />}
      {mode === 'flash' && <FlashcardsGame questions={unlocked} />}
    </div>
  );
}

// =================================================================
// MULTIPLE CHOICE GAME
// =================================================================
function MCQGame({ questions }) {
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
      setScore(score + 1);
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
        <button
          className="px-4 py-2 rounded text-white"
          style={{ backgroundColor: '#0097b2' }}
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
                  ? 'bg-gray-100'
                  : option === questions[index].answer
                  ? 'bg-green-200'
                  : option === selected
                  ? 'bg-red-200'
                  : 'bg-gray-100'
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
            style={{ backgroundColor: '#0097b2' }}
            onClick={next}
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}

// =================================================================
// FILL IN THE BLANK GAME
// =================================================================
function FillBlankGame({ questions }) {
  const [index, setIndex] = useState(0);
  const [data, setData] = useState(null);
  const [filled, setFilled] = useState([]);
  const [score, setScore] = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (questions.length > 0) {
      const d = generateFillBlankData(questions, index);
      setData(d);
      setFilled(d.blanks.map(() => ''));
    }
  }, [questions, index]);

  const fillWord = (word) => {
    const idx = data.blanks.findIndex((b, i) => b.hidden && filled[i] === '');
    if (idx === -1) return;
    const newFilled = [...filled];
    newFilled[idx] = word;
    setFilled(newFilled);
  };

  const checkAnswer = () => {
    const isCorrect = data.blanks.every((b, i) => (!b.hidden || b.original === filled[i]));
    if (isCorrect) setScore(score + 1);
    if (index + 1 < questions.length) {
      setIndex(index + 1);
    } else {
      setCompleted(true);
    }
  };

  if (!data) return <div>Loading…</div>;
  if (completed) {
    return (
      <div className="space-y-4">
        <p>You scored {score} out of {questions.length}.</p>
        <button
          className="px-4 py-2 rounded text-white"
          style={{ backgroundColor: '#0097b2' }}
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

  const displaySentence = data.blanks.map((b, i) => {
    if (!b.hidden) return b.original;
    return filled[i] || '____';
  });

  return (
    <div className="space-y-4">
      <div className="font-semibold">
        Question {index + 1} of {questions.length}
      </div>
      <div className="bg-white p-4 shadow rounded">
        <p className="mb-4 font-medium">{questions[index].question}</p>
        <p className="mb-4 text-lg">{displaySentence.join('')}</p>
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
          style={{ backgroundColor: '#0097b2' }}
          onClick={checkAnswer}
        >
          {index + 1 < questions.length ? 'Next' : 'Finish'}
        </button>
      </div>
    </div>
  );
}

// =================================================================
// FLASHCARDS GAME
// =================================================================
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
          style={{ backgroundColor: '#0097b2' }}
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
        className="bg-white p-6 shadow rounded cursor-pointer relative hover:shadow-lg transition"
        onClick={() => setShowAnswer(!showAnswer)}
        style={{ minHeight: '8rem' }}
      >
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
      <button
        className="px-4 py-2 rounded text-white"
        style={{ backgroundColor: '#0097b2' }}
        onClick={next}
      >
        {index + 1 < questions.length ? 'Next' : 'Finish'}
      </button>
    </div>
  );
}

// =================================================================
// MOUNT APP
// =================================================================
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
