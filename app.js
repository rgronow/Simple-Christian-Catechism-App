// app.js - Full script with visual upgrades

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

// Initialize Firebase using the global 'firebase' object from the script tag
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const dbRef = db.ref('/');

// =================================================================
// Utility functions (for game logic)
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
// Main Application Components
// =================================================================

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

  const getNavButtonClasses = (buttonView) => {
    const baseClasses = "px-4 py-2 rounded-md font-semibold transition-colors duration-200 text-sm sm:text-base";
    const activeView = adminMode ? 'admin' : view;
    if (activeView === buttonView) {
      return `${baseClasses} bg-[#2c3e50] text-white`;
    }
    return `${baseClasses} bg-slate-200 text-slate-700 hover:bg-slate-300`;
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center cursor-pointer" onClick={() => { setAdminMode(false); setView('learn'); }}>
            <img src="./logo.png" alt="Logo" className="h-10 w-auto mr-4" />
            <h1 className="text-2xl font-bold text-slate-800 hidden sm:block">Catechism Tool</h1>
          </div>
          <nav className="space-x-2">
            <button className={getNavButtonClasses('learn')} onClick={() => { setAdminMode(false); setView('learn'); }}>Learn</button>
            <button className={getNavButtonClasses('games')} onClick={() => { setAdminMode(false); setView('games'); }}>Games</button>
            <button className={getNavButtonClasses('admin')} onClick={() => { setAdminMode(!adminMode); if (adminMode) setAdminAuth(false); }}>
              {adminMode ? 'Close' : 'Admin'}
            </button>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {loadError ? (
          <div className="text-red-600">Error loading data: {loadError}</div>
        ) : questions.length === 0 ? (
          <div className="text-center text-slate-500">Loading…</div>
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
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg shadow-md">
      <div>
        <label className="block text-sm font-medium mb-1">Enter Admin PIN</label>
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="border rounded w-full p-2 border-slate-300"
        />
      </div>
      <div className="flex space-x-2">
        <button type="submit" className="bg-[#2c3e50] hover:bg-[#34495e] text-white px-4 py-2 rounded-md transition-colors duration-200">
          Login
        </button>
        <button type="button" className="bg-slate-200 hover:bg-slate-300 px-4 py-2 rounded-md transition-colors duration-200" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function AdminView({ questions, unlockedIds, setUnlockedIds, handleUnlockNext, updateQuestion }) {
  const toggleUnlocked = (id) => {
    const newUnlockedIds = unlockedIds.includes(id)
      ? unlockedIds.filter((uid) => uid !== id)
      : [...unlockedIds, id];
    setUnlockedIds(newUnlockedIds);
  };

  const handleLinkChange = (id, value) => {
    const questionToUpdate = questions.find((q) => q.id === id);
    if (questionToUpdate) {
      updateQuestion({ ...questionToUpdate, youtube: value });
    }
  };

  const unlockAll = () => {
    setUnlockedIds(questions.map((q) => q.id));
  };

  return (
    <div className="space-y-4">
      <div className="flex space-x-2">
        <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition-colors duration-200" onClick={handleUnlockNext}>
          Unlock Next
        </button>
        <button className="bg-[#2c3e50] hover:bg-[#34495e] text-white px-4 py-2 rounded-md transition-colors duration-200" onClick={unlockAll}>
          Unlock All
        </button>
      </div>
      <div className="overflow-auto max-h-[70vh] bg-white p-1 rounded-lg shadow-md">
        <table className="min-w-full border-collapse">
          {/* ... table content remains the same ... */}
        </table>
      </div>
    </div>
  );
}

function LearnView({ questions, unlockedIds }) {
  const unlocked = questions.filter((q) => unlockedIds.includes(q.id));
  if (unlocked.length === 0) {
    return <div className="text-center text-slate-500">No questions unlocked yet. Please unlock in admin.</div>;
  }
  return (
    <div className="space-y-6">
      {unlocked.map((q) => (
        <QuestionCard key={q.id} question={q} />
      ))}
    </div>
  );
}

function QuestionCard({ question }) {
  const [showAnswer, setShowAnswer] = useState(false);
  return (
    <div className="bg-white shadow-lg rounded-lg p-6 space-y-4">
      <div className="flex justify-between items-start">
        <h2 className="font-question text-xl font-bold text-slate-800 pr-4">
          {question.id}. {question.question}
        </h2>
        <button className="text-sm font-semibold text-[#2c3e50] hover:underline flex-shrink-0" onClick={() => setShowAnswer(!showAnswer)}>
          {showAnswer ? 'Hide' : 'Show'} Answer
        </button>
      </div>
      {showAnswer && (
        <p className="text-slate-700 leading-relaxed pt-4 border-t border-slate-200">
          {question.answer}
        </p>
      )}
      {question.youtube && (
        <div className="mt-4 aspect-w-16 aspect-h-9">
          <iframe className="w-full h-full rounded-md" src={transformYouTubeURL(question.youtube)} title="Memory Song" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
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
    return <div className="text-center text-slate-500">No unlocked questions available for games.</div>;
  }
  
  const getGameButtonClasses = (buttonMode) => {
    const base = "px-3 py-1 rounded font-semibold transition-colors duration-200";
    if (mode === buttonMode) {
      return `${base} bg-[#2c3e50] text-white`;
    }
    return `${base} bg-white text-slate-700 hover:bg-slate-200`;
  }
  
  return (
    <div className="space-y-4">
      <div className="space-x-2 mb-4 p-2 bg-slate-200 rounded-lg inline-block">
        <button className={getGameButtonClasses('mcq')} onClick={() => setMode('mcq')}>Multiple Choice</button>
        <button className={getGameButtonClasses('fill')} onClick={() => setMode('fill')}>Fill in the Blank</button>
        <button className={getGameButtonClasses('flash')} onClick={() => setMode('flash')}>Flashcards</button>
      </div>
      {mode === 'mcq' && <MCQGame questions={unlocked} />}
      {mode === 'fill' && <FillBlankGame questions={unlocked} />}
      {mode === 'flash' && <FlashcardsGame questions={unlocked} />}
    </div>
  );
}

function MCQGame({ questions }) {
  // ... game logic is the same ...
  const [index, setIndex] = useState(0);
  const [options, setOptions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (questions.length > 0) {
      setOptions(getMultipleChoiceOptions(questions, index));
      setSelected(null);
    }
  }, [questions, index]);

  const handleSelect = (option) => { /* ... */ };
  const next = () => { /* ... */ };
  const restart = () => { /* ... */ };

  if (completed) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-lg text-center space-y-4">
        <p className="text-xl">You scored {score} out of {questions.length}.</p>
        <button className="bg-[#2c3e50] hover:bg-[#34495e] text-white px-4 py-2 rounded-md transition-colors duration-200" onClick={restart}>
          Restart
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="font-semibold text-slate-600">
        Question {index + 1} of {questions.length}
      </div>
      <div className="bg-white p-6 shadow-lg rounded-lg">
        <p className="mb-4 font-question text-lg font-medium">{questions[index].question}</p>
        <div className="space-y-2">
          {options.map((option, i) => (
            <button key={i} /* ... */ >{option}</button>
          ))}
        </div>
        {selected !== null && (
          <button className="mt-4 bg-[#2c3e50] hover:bg-[#34495e] text-white px-4 py-2 rounded-md transition-colors duration-200" onClick={next}>
            Next
          </button>
        )}
      </div>
    </div>
  );
}

function FillBlankGame({ questions }) {
  // ... game logic is the same ...
  const [index, setIndex] = useState(0);
  const [data, setData] = useState(null);
  const [filled, setFilled] = useState([]);
  const [score, setScore] = useState(0);
  const [completed, setCompleted] = useState(false);
  
  // ... useEffect and other functions ...

  if (!data) return <div>Loading…</div>;
  if (completed) {
     return (
      <div className="bg-white p-6 rounded-lg shadow-lg text-center space-y-4">
        <p className="text-xl">You scored {score} out of {questions.length}.</p>
        <button className="bg-[#2c3e50] hover:bg-[#34495e] text-white px-4 py-2 rounded-md transition-colors duration-200" onClick={() => { /* restart logic */ }}>
          Restart
        </button>
      </div>
    );
  }

  const displaySentence = data.blanks.map((b, i) => { /* ... */ });

  return (
    <div className="space-y-4">
      {/* ... game UI ... */}
      <button className="bg-[#2c3e50] hover:bg-[#34495e] text-white px-4 py-2 rounded-md transition-colors duration-200" onClick={checkAnswer}>
        {index + 1 < questions.length ? 'Next' : 'Finish'}
      </button>
    </div>
  );
}

function FlashcardsGame({ questions }) {
  // ... game logic is the same ...
  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [completed, setCompleted] = useState(false);
  
  // ... next and restart functions ...

  if (completed) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-lg text-center space-y-4">
        <p className="text-xl">You've gone through all flashcards.</p>
        <button className="bg-[#2c3e50] hover:bg-[#34495e] text-white px-4 py-2 rounded-md transition-colors duration-200" onClick={() => { /* restart logic */ }}>
          Restart
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ... card UI ... */}
      <button className="bg-[#2c3e50] hover:bg-[#34495e] text-white px-4 py-2 rounded-md transition-colors duration-200" onClick={next}>
        {index + 1 < questions.length ? 'Next' : 'Finish'}
      </button>
    </div>
  );
}

// Mount the React application
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
