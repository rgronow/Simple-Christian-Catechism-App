// Utility functions for persisting state and common helpers.

export function loadState() {
  try {
    const raw = localStorage.getItem('catechismAppState');
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.warn('Failed to parse saved state', e);
    return {};
  }
}

export function saveState(state) {
  try {
    localStorage.setItem('catechismAppState', JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save state', e);
  }
}

// Shuffle array in place using Fisher-Yates algorithm
export function shuffle(array) {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Generate multiple choice options for a given question. Returns an array
// containing the correct answer and several distractors.
export function getMultipleChoiceOptions(questions, currentIndex, count = 4) {
  const correctAnswer = questions[currentIndex].answer;
  const otherAnswers = questions
    .filter((_, idx) => idx !== currentIndex)
    .map((q) => q.answer);
  const shuffled = shuffle(otherAnswers).slice(0, count - 1);
  const options = shuffle([correctAnswer, ...shuffled]);
  return options;
}

// From an answer string, generate blanks and possible words. Returns an
// object with blanks array and options array. The blanks array contains
// objects with the original word and a flag indicating whether the word
// should be hidden. The options array contains the hidden words plus
// distractors from other answers.
export function generateFillBlankData(questions, currentIndex, blankCount = 3) {
  const answer = questions[currentIndex].answer;
  const words = answer.split(/(\s+)/); // retain whitespace for reconstruction
  // choose indices of words (filtering out whitespace elements)
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
  // candidate words: hidden words from this answer + distractor words from other answers
  const hiddenWords = blanks
    .filter((b) => b.hidden)
    .map((b) => b.original);
  const otherWords = questions
    .filter((_, idx) => idx !== currentIndex)
    .flatMap((q) => q.answer.split(/\s+/))
    .filter((w) => w.length > 3); // filter trivial words
  const distractors = shuffle(otherWords).slice(0, blankCount);
  const options = shuffle([...hiddenWords, ...distractors]);
  return { blanks, options };
}