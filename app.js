// app.js - Full updated script with UI enhancements

const { useState, useEffect } = React;

// =================================================================
// 1. INITIALIZE FIREBASE
// =================================================================
// PASTE YOUR FIREBASE CONFIG HERE
const firebaseConfig = {
   apiKey: "AIzaSyAlZ5IsphN3IOLOKoGvQecJfEunjwbeolw",
  authDomain: "simplechristiancatechism.firebaseapp.com",
  databaseURL: "https://simplechristiancatechism-default-rtdb.europe-west1.firebasedatabase.app/",
  projectId: "simplechristiancatechism",
  storageBucket: "simplechristiancatechism.appspot.com",
  messagingSenderId: "605718866345",
  appId: "1:605718866345:web:60c9e790e5148ff78fbcb8",
  measurementId: "G-JKY86F4M6H",

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const dbRef = db.ref('/');

// =================================================================
// Utility functions (These are still needed by the game logic)
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


function App() {
  const [questions, setQuestions] = useState([]);
  const [unlockedIds, setUnlockedIds] = useState([]);
  const [view, setView] = useState('learn');
  const [adminMode, setAdminMode] = useState(false);
  const [adminAuth, setAdminAuth] = useState(false);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    const unsubscribe = dbRef.on('value', (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const allQuestions = (data.questions || []).filter(Boolean);
        setQuestions(allQuestions);
        setUnlockedIds(data.unlockedIds || []);
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
    db.ref('/unlockedIds').set(newUnlockedIds);
  };
  
  const updateQuestionInFirebase = (updatedQuestion) => {
    db.ref(`/questions/${updatedQuestion.id}`).set(updatedQuestion);
  };
  
  const unlocked = questions.filter((q) => unlockedIds.includes(q.id));

  const handleUnlockNext = () => {
    const sortedQuestions = [...questions].sort((a,b) => a.id - b.id);
    const locked = sortedQuestions.find((q) => !unlockedIds.includes(q.id));
    if (locked) {
      const newUnlockedIds = [...unlockedIds, locked.id];
      updateUnlockedIdsInFirebase(newUnlockedIds);
    }
  };

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
      <header className="bg-white shadow">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Catechism Learning Tool</h1>
          <nav className="space-x-2">
            <button
              className={`px-3 py-1 rounded ${view === 'learn' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
              onClick={() => setView('learn')}
            >
              Learn
            </button>
            <button
              className={`px-3 py-1 rounded ${view === 'games' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
              onClick={() => setView('games')}
            >
              Games
            </button>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-5xl mx-auto p-4 w-full">
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
      <footer className="py-4">
        <div className="text-center">
          <button
            className={`px-4 py-2 rounded text-sm ${adminMode ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            onClick={() => {
              setAdminMode(!adminMode);
              if (adminMode) setAdminAuth(false);
            }}
          >
            {adminMode ? 'Close Admin' : 'Admin Panel'}
          </button>
        </div>
      </footer>
    </div>
  );
}

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
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
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

  const handleLinkChange = (id, value) => {
    const questionToUpdate = questions.find((q) => q.id === id);
    if (questionToUpdate) {
      updateQuestion({ ...questionToUpdate, youtube: value });
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
          className="bg-green-600 text-white px-4 py-2 rounded"
          onClick={handleUnlockNext}
        >
          Unlock Next
        </button>
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded"
          onClick={unlockAll}
        >
          Unlock All
        </button>
      </div>
      <div className="overflow-auto max-h-[70vh]">
        <table className="min-w-full border">
          <thead>
            <tr>
              <th className="border px-2 py-1 text-left">#</th>
              <th className="border px-2 py-1 text-left">Question</th>
              <th className="border px-2 py-1 text-left">Unlocked</th>
              <th className="border px-2 py-1 text-left">YouTube Link</th>
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
                    onChange={(e) => handleLinkChange(q.id, e.target.value)}
                    placeholder="Paste YouTube link here"
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

function LearnView({ questions, unlockedIds }) {
  const unlocked = questions.filter((q) => unlockedIds.includes(q.id));
  if (unlocked.length === 0) {
    return <div>No questions unlocked yet. Please unlock in admin.</div>;
  }
  return (
    <div className="space-y-4">
      {unlocked.map((q) => (
        <QuestionCard key={q.id} question={q} />
      ))}
    </div>
  );
}

function QuestionCard({ question }) {
  const [showAnswer, setShowAnswer] = useState(false);
  return (
    <div className="bg-white shadow-md rounded-lg p-4 space-y-3 border border-gray-200 transition-shadow duration-200 hover:shadow-lg">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-lg">
          {question.id}. {question.question}
        </h2>
        <button
          className="px-3 py-1 bg-blue-500 text-white rounded-md text-sm font-semibold shadow-sm hover:bg-blue-600"
          onClick={() => setShowAnswer(!showAnswer)}
        >
          {showAnswer ? 'Hide' : 'Show'} Answer
        </button>
      </div>
      {showAnswer && (
        <div className="pt-2">
          <p className="text-gray-800">
            {question.answer}
          </p>
          {question.youtube && (
            <div className="mt-4">
              <iframe
                className="w-full h-48 rounded"
                src={transformYouTubeURL(question.youtube)}
                title="Memory Song"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          )}
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

function GamesView({ questions, unlockedIds }) {
  const unlocked = questions.filter((q) => unlockedIds.includes(q.id));
  const [mode, setMode] = useState('mcq');
  if (unlocked.length === 0) {
    return <div>No unlocked questions available for games.</div>;
  }
  return (
    <div className="space-y-4">
      <div className="space-x-2 mb-4">
        <button
          className={`px-3 py-1 rounded ${mode === 'mcq' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          onClick={() => setMode('mcq')}
        >
          Multiple Choice
        </button>
        <button
          className={`px-3 py-1 rounded ${mode === 'fill' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          onClick={() => setMode('fill')}
        >
          Fill in the Blank
        </button>
        <button
          className={`px-3 py-1 rounded ${mode === 'flash' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
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
          className="bg-blue-600 text-white px-4 py-2 rounded"
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
              className={`block w-full text-left px-3 py-2 rounded border ${selected === null ? 'bg-gray-100' : option === questions[index].answer ? 'bg-green-200' : option === selected ? 'bg-red-200' : 'bg-gray-100'}`}
              onClick={() => handleSelect(option)}
            >
              {option}
            </button>
          ))}
        </div>
        {selected !== null && (
          <button className="mt-4 bg-blue-600 text-white px-4 py-2 rounded" onClick={next}>
            Next
          </button>
        )}
      </div>
    </div>
  );
}

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
          className="bg-blue-600 text-white px-4 py-2 rounded"
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
              className="bg-gray-200 px-2 py-1 rounded"
              onClick={() => fillWord(word)}
            >
              {word}
            </button>
          ))}
        </div>
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded"
          onClick={checkAnswer}
        >
          {index + 1 < questions.length ? 'Next' : 'Finish'}
        </button>
      </div>
    </div>
  );
}

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
          className="bg-blue-600 text-white px-4 py-2 rounded"
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
        className="bg-white p-6 shadow rounded cursor-pointer relative"
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
        className="bg-blue-600 text-white px-4 py-2 rounded"
        onClick={next}
      >
        {index + 1 < questions.length ? 'Next' : 'Finish'}
      </button>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
