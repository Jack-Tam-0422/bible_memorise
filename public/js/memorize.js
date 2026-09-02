const booksSelect = document.getElementById('books');
const chapterSelect = document.getElementById('chapter');
const verseSelect = document.getElementById('verse');
const startMemorizeBtn = document.getElementById('startMemorizeBtn');
const retryMaskBtn = document.getElementById('retryMaskBtn');
const nextQuestionBtn = document.getElementById('nextQuestionBtn');
const nextVerseBtn = document.getElementById('nextVerseBtn');
const quizProgress = document.getElementById('quizProgress');
const memorizeResult = document.getElementById('memorizeResult');
const gradingResult = document.getElementById('gradingResult');
const memorizeMessage = document.getElementById('memorizeMessage');
const demoHeading = document.getElementById('demo-heading');
const bibleIndex = window.bibleIndex || {};
const memorizeDefaults = window.memorizeDefaults || {};

let quizQuestions = [];
let currentQuestionIndex = 0;
let correctCount = 0;
let currentQuizMode = 'choice';
let currentQuizMeta = null;
let isAnswering = false;

function getSelectedQuizMode() {
  const selected = document.querySelector('input[name="quizMode"]:checked');
  return selected ? selected.value : 'choice';
}

function resetSelect(selectElement, placeholder) {
  selectElement.innerHTML = '';
  const option = document.createElement('option');
  option.value = '';
  option.textContent = placeholder;
  selectElement.appendChild(option);
}

function populateSelect(selectElement, values) {
  values.forEach((value) => {
    const option = document.createElement('option');
    option.value = String(value);
    option.textContent = String(value);
    selectElement.appendChild(option);
  });
}

function setMessage(text, isError) {
  memorizeMessage.textContent = text;
  memorizeMessage.classList.toggle('error', isError);
}

function hideNavButtons() {
  nextQuestionBtn.classList.add('hidden');
  nextVerseBtn.classList.add('hidden');
}

function clearQuizResults() {
  memorizeResult.innerHTML = '';
  gradingResult.innerHTML = '';
  quizProgress.classList.add('hidden');
  quizProgress.textContent = '';
  retryMaskBtn.classList.add('hidden');
  hideNavButtons();
  quizQuestions = [];
  currentQuestionIndex = 0;
  correctCount = 0;
  currentQuizMeta = null;
  isAnswering = false;
}

function updateDemoHeading(book, chapter, verse) {
  if (!demoHeading) {
    return;
  }

  if (verse) {
    demoHeading.textContent = `練習題：${book} ${chapter}:${verse}`;
    return;
  }

  demoHeading.textContent = `練習題：${book} 第 ${chapter} 章`;
}

function updateChapters(options = {}) {
  const { clearQuiz = true } = options;
  const selectedBook = booksSelect.value;
  resetSelect(chapterSelect, '請選擇章');
  resetSelect(verseSelect, '請選擇節');

  if (clearQuiz) {
    clearQuizResults();
  }

  if (!selectedBook || !bibleIndex[selectedBook]) {
    return;
  }

  const chapterNumbers = Object.keys(bibleIndex[selectedBook])
    .map((chapter) => Number(chapter))
    .sort((a, b) => a - b);

  populateSelect(chapterSelect, chapterNumbers);
}

function updateVerses(options = {}) {
  const { clearQuiz = true } = options;
  const selectedBook = booksSelect.value;
  const selectedChapter = chapterSelect.value;
  resetSelect(verseSelect, '請選擇節');

  if (clearQuiz) {
    clearQuizResults();
  }

  if (!selectedBook || !selectedChapter) {
    return;
  }

  const verseCount = bibleIndex[selectedBook]?.[selectedChapter];
  if (!Number.isInteger(verseCount) || verseCount <= 0) {
    return;
  }

  const verseNumbers = Array.from({ length: verseCount }, (_, index) => index + 1);
  populateSelect(verseSelect, verseNumbers);
}

function buildQuizQuestions(data) {
  const questions = [];

  data.verses.forEach((verseData) => {
    verseData.blanks.forEach((blank) => {
      questions.push({
        verse: verseData.number,
        blank: blank.id,
        answer: blank.answer,
        maskedText: verseData.maskedText,
        choices: Array.isArray(blank.choices) ? blank.choices : null
      });
    });
  });

  return questions;
}

function updateProgress() {
  if (quizQuestions.length === 0) {
    quizProgress.classList.add('hidden');
    quizProgress.textContent = '';
    return;
  }

  quizProgress.classList.remove('hidden');
  quizProgress.textContent = `第 ${currentQuestionIndex + 1} / ${quizQuestions.length} 題`;
}

function createChoiceButtons(question) {
  const group = document.createElement('div');
  group.className = 'choice-group';
  group.dataset.correctAnswer = question.answer;
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', `第 ${question.verse} 節空格 ${question.blank}`);

  const choices = question.choices && question.choices.length === 3
    ? question.choices
    : [question.answer];

  choices.forEach((choice) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choice-button';
    button.textContent = choice;
    button.dataset.answer = choice;

    button.addEventListener('click', () => {
      if (isAnswering) {
        return;
      }
      handleChoiceAnswer(question, choice, group);
    });

    group.appendChild(button);
  });

  return group;
}

function createBlankInput(question) {
  const item = document.createElement('div');
  item.className = 'answer-item';

  const input = document.createElement('input');
  input.type = 'text';
  input.id = `answer-v${question.verse}-b${question.blank}`;
  input.placeholder = '請輸入答案';

  const submitBtn = document.createElement('button');
  submitBtn.type = 'button';
  submitBtn.textContent = '確認';
  submitBtn.addEventListener('click', () => {
    if (isAnswering) {
      return;
    }
    handleBlankAnswer(question, input.value.trim(), item);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !isAnswering) {
      handleBlankAnswer(question, input.value.trim(), item);
    }
  });

  item.appendChild(input);
  item.appendChild(submitBtn);
  return item;
}

function showQuestionFeedback(container, isCorrect, expectedAnswer) {
  const feedback = document.createElement('p');
  feedback.className = `question-feedback ${isCorrect ? 'ok' : 'bad'}`;

  if (isCorrect) {
    feedback.textContent = '答對了！';
  } else {
    feedback.textContent = `答錯了，正確答案：${expectedAnswer}`;
  }

  container.appendChild(feedback);
}

function hasMoreQuestions() {
  return currentQuestionIndex + 1 < quizQuestions.length;
}

function canGoNextVerse() {
  if (!currentQuizMeta) {
    return false;
  }

  const book = booksSelect.value || currentQuizMeta.book;
  const chapter = chapterSelect.value || String(currentQuizMeta.chapter);
  const verseCount = bibleIndex[book]?.[chapter];
  if (!Number.isInteger(verseCount) || verseCount <= 0) {
    return false;
  }

  const currentVerse = Number(verseSelect.value || currentQuizMeta.verse || 0);
  if (!Number.isInteger(currentVerse) || currentVerse <= 0) {
    return verseCount > 1;
  }

  return currentVerse < verseCount;
}

function showPostAnswerNav() {
  hideNavButtons();

  if (hasMoreQuestions()) {
    nextQuestionBtn.classList.remove('hidden');
  }

  if (canGoNextVerse()) {
    nextVerseBtn.classList.remove('hidden');
  }
}

function showFinalSummary() {
  memorizeResult.innerHTML = '';
  gradingResult.innerHTML = '';
  hideNavButtons();

  const summary = document.createElement('h3');
  summary.textContent = `作答完成：${correctCount} / ${quizQuestions.length} 正確`;
  gradingResult.appendChild(summary);

  if (correctCount === quizQuestions.length) {
    setMessage('太好了，全部答對！可按「下一節」繼續。', false);
  } else {
    setMessage('已完成本節練習，可重新出題或按「下一節」。', false);
  }

  quizProgress.classList.add('hidden');
  isAnswering = false;

  if (canGoNextVerse()) {
    nextVerseBtn.classList.remove('hidden');
  }
}

function renderCurrentQuestion() {
  memorizeResult.innerHTML = '';
  gradingResult.innerHTML = '';
  hideNavButtons();
  isAnswering = false;

  if (!currentQuizMeta || quizQuestions.length === 0) {
    updateProgress();
    setMessage('此範圍沒有可練習的題目，請更換章節或重新出題。', true);
    return;
  }

  if (currentQuestionIndex >= quizQuestions.length) {
    showFinalSummary();
    return;
  }

  const question = quizQuestions[currentQuestionIndex];
  updateProgress();
  updateDemoHeading(
    currentQuizMeta.book,
    currentQuizMeta.chapter,
    currentQuizMeta.verse || question.verse
  );

  const header = document.createElement('h2');
  header.textContent = `${currentQuizMeta.book} ${currentQuizMeta.chapter}:${question.verse}`;
  memorizeResult.appendChild(header);

  const verseBlock = document.createElement('article');
  verseBlock.className = 'memorize-verse-block question-block';

  const line = document.createElement('p');
  line.className = 'verse-line';
  line.innerHTML = `<span class="verse-number">${question.verse}</span> ${question.maskedText}`;
  verseBlock.appendChild(line);

  const prompt = document.createElement('p');
  prompt.className = 'hint-text';
  prompt.textContent =
    currentQuizMode === 'choice'
      ? `空格 ${question.blank}：請點選正確答案`
      : `空格 ${question.blank}：請填入正確答案`;
  verseBlock.appendChild(prompt);

  const answerArea = document.createElement('div');
  answerArea.className = 'answer-area';

  if (currentQuizMode === 'choice') {
    answerArea.appendChild(createChoiceButtons(question));
  } else {
    answerArea.appendChild(createBlankInput(question));
  }

  verseBlock.appendChild(answerArea);
  memorizeResult.appendChild(verseBlock);
}

function markChoiceGroup(group, selectedAnswer, expectedAnswer) {
  group.querySelectorAll('.choice-button').forEach((button) => {
    const isExpected = button.dataset.answer === expectedAnswer;
    const isSelected = button.dataset.answer === selectedAnswer;
    button.classList.toggle('correct', isExpected);
    button.classList.toggle('incorrect', isSelected && !isExpected);
    button.disabled = true;
  });
}

function handleChoiceAnswer(question, selectedAnswer, group) {
  isAnswering = true;
  const isCorrect = selectedAnswer === question.answer;

  markChoiceGroup(group, selectedAnswer, question.answer);

  if (isCorrect) {
    correctCount += 1;
  }

  showQuestionFeedback(group.parentElement, isCorrect, question.answer);
  showPostAnswerNav();
}

function handleBlankAnswer(question, userAnswer, item) {
  if (!userAnswer) {
    setMessage('請先輸入答案。', true);
    return;
  }

  isAnswering = true;
  const isCorrect = userAnswer === question.answer;
  const input = item.querySelector('input');
  const submitBtn = item.querySelector('button');

  if (input) {
    input.classList.toggle('correct', isCorrect);
    input.classList.toggle('incorrect', !isCorrect);
    input.disabled = true;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
  }

  if (isCorrect) {
    correctCount += 1;
  }

  showQuestionFeedback(item, isCorrect, question.answer);
  showPostAnswerNav();
}

function renderMemorizeResult(data) {
  clearQuizResults();
  currentQuizMode = data.mode || 'choice';
  currentQuizMeta = {
    book: data.book,
    chapter: data.chapter,
    verse: data.verses.length === 1 ? data.verses[0].number : null
  };
  quizQuestions = buildQuizQuestions(data);
  retryMaskBtn.classList.remove('hidden');

  updateDemoHeading(
    currentQuizMeta.book,
    currentQuizMeta.chapter,
    currentQuizMeta.verse
  );

  if (quizQuestions.length === 0) {
    setMessage('此範圍沒有可練習的題目，請更換章節或重新出題。', true);
    return;
  }

  currentQuestionIndex = 0;
  correctCount = 0;
  renderCurrentQuestion();
  setMessage(
    currentQuizMode === 'choice'
      ? '請點選答案；答完後可按「下一題」或「下一節」。'
      : '請填寫答案；答完後可按「下一題」或「下一節」。',
    false
  );
}

async function startMemorize() {
  const book = booksSelect.value;
  const chapter = chapterSelect.value;
  const verse = verseSelect.value;
  const mode = getSelectedQuizMode();

  if (!book || !chapter) {
    setMessage('書卷與章為必選，請先完成選擇。', true);
    clearQuizResults();
    return;
  }

  setMessage('正在產生背誦題目...', false);
  const params = new URLSearchParams({ book, chapter, mode });
  if (verse) {
    params.set('verse', verse);
  }

  try {
    const response = await fetch(`/api/memorize?${params.toString()}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '無法產生背誦題目。');
    }

    renderMemorizeResult(data);
  } catch (error) {
    clearQuizResults();
    setMessage(error.message, true);
  }
}

function goToNextQuestion() {
  if (!hasMoreQuestions()) {
    showFinalSummary();
    return;
  }

  currentQuestionIndex += 1;
  renderCurrentQuestion();
}

function goToNextVerse() {
  const book = booksSelect.value || currentQuizMeta?.book;
  const chapter = chapterSelect.value || String(currentQuizMeta?.chapter || '');

  if (!book || !chapter || !bibleIndex[book]) {
    setMessage('無法載入下一節，請重新選擇章節。', true);
    return;
  }

  const verseCount = bibleIndex[book][chapter];
  const currentVerse = Number(verseSelect.value || currentQuizMeta?.verse || 0);
  let nextVerse = Number.isInteger(currentVerse) && currentVerse > 0 ? currentVerse + 1 : 2;

  if (!Number.isInteger(verseCount) || nextVerse > verseCount) {
    setMessage('已到本章最後一節。', false);
    hideNavButtons();
    return;
  }

  if (!verseSelect.querySelector(`option[value="${nextVerse}"]`)) {
    updateVerses({ clearQuiz: false });
  }

  verseSelect.value = String(nextVerse);
  startMemorize();
}

function applyDefaults() {
  const { defaultBook, defaultChapter, defaultVerse } = memorizeDefaults;

  if (defaultBook && bibleIndex[defaultBook]) {
    booksSelect.value = defaultBook;
    updateChapters({ clearQuiz: false });

    if (defaultChapter) {
      chapterSelect.value = String(defaultChapter);
      updateVerses({ clearQuiz: false });

      if (defaultVerse) {
        verseSelect.value = String(defaultVerse);
      }
    }
  }
}

booksSelect.addEventListener('change', () => updateChapters({ clearQuiz: false }));
chapterSelect.addEventListener('change', () => updateVerses({ clearQuiz: false }));
startMemorizeBtn.addEventListener('click', startMemorize);
retryMaskBtn.addEventListener('click', startMemorize);
nextQuestionBtn.addEventListener('click', goToNextQuestion);
nextVerseBtn.addEventListener('click', goToNextVerse);

document.querySelectorAll('input[name="quizMode"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    if (quizQuestions.length > 0 || memorizeDefaults.autoStart) {
      startMemorize();
    }
  });
});

applyDefaults();

if (memorizeDefaults.autoStart) {
  startMemorize();
}
