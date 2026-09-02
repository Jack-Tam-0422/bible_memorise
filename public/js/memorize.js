const booksSelect = document.getElementById('books');
const chapterSelect = document.getElementById('chapter');
const verseSelect = document.getElementById('verse');
const startMemorizeBtn = document.getElementById('startMemorizeBtn');
const retryMaskBtn = document.getElementById('retryMaskBtn');
const submitAnswersBtn = document.getElementById('submitAnswersBtn');
const nextVerseBtn = document.getElementById('nextVerseBtn');
const quizProgress = document.getElementById('quizProgress');
const memorizeResult = document.getElementById('memorizeResult');
const gradingResult = document.getElementById('gradingResult');
const memorizeMessage = document.getElementById('memorizeMessage');
const demoHeading = document.getElementById('demo-heading');
const bibleIndex = window.bibleIndex || {};
const memorizeDefaults = window.memorizeDefaults || {};

let quizVerses = [];
let currentVerseIndex = 0;
let correctCount = 0;
let totalBlankCount = 0;
let currentQuizMode = 'choice';
let currentQuizMeta = null;
let isGraded = false;

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

function hideActionButtons() {
  submitAnswersBtn.classList.add('hidden');
  nextVerseBtn.classList.add('hidden');
}

function clearQuizResults() {
  memorizeResult.innerHTML = '';
  gradingResult.innerHTML = '';
  quizProgress.classList.add('hidden');
  quizProgress.textContent = '';
  retryMaskBtn.classList.add('hidden');
  hideActionButtons();
  quizVerses = [];
  currentVerseIndex = 0;
  correctCount = 0;
  totalBlankCount = 0;
  currentQuizMeta = null;
  isGraded = false;
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

function buildQuizVerses(data) {
  return data.verses
    .filter((verseData) => Array.isArray(verseData.blanks) && verseData.blanks.length > 0)
    .map((verseData) => ({
      verse: verseData.number,
      maskedText: verseData.maskedText,
      blanks: verseData.blanks.map((blank) => ({
        id: blank.id,
        answer: blank.answer,
        choices: Array.isArray(blank.choices) ? blank.choices : null
      }))
    }));
}

function countAllBlanks(verses) {
  return verses.reduce((total, verseData) => total + verseData.blanks.length, 0);
}

function updateProgress() {
  if (quizVerses.length === 0) {
    quizProgress.classList.add('hidden');
    quizProgress.textContent = '';
    return;
  }

  const current = quizVerses[currentVerseIndex];
  quizProgress.classList.remove('hidden');
  quizProgress.textContent = `第 ${currentVerseIndex + 1} / ${quizVerses.length} 節（本節 ${current.blanks.length} 題）`;
}

function canGoNextVerse() {
  if (!currentQuizMeta) {
    return false;
  }

  if (currentVerseIndex + 1 < quizVerses.length) {
    return true;
  }

  const book = booksSelect.value || currentQuizMeta.book;
  const chapter = chapterSelect.value || String(currentQuizMeta.chapter);
  const verseCount = bibleIndex[book]?.[chapter];
  if (!Number.isInteger(verseCount) || verseCount <= 0) {
    return false;
  }

  const currentVerse = Number(
    verseSelect.value || currentQuizMeta.verse || quizVerses[currentVerseIndex]?.verse || 0
  );
  if (!Number.isInteger(currentVerse) || currentVerse <= 0) {
    return verseCount > 1;
  }

  return currentVerse < verseCount;
}

function createChoiceGroup(blank) {
  const item = document.createElement('div');
  item.className = 'answer-item choice-item';
  item.dataset.blankId = String(blank.id);

  const label = document.createElement('p');
  label.className = 'choice-label';
  label.textContent = `空格 ${blank.id}`;
  item.appendChild(label);

  const group = document.createElement('div');
  group.className = 'choice-group';
  group.dataset.correctAnswer = blank.answer;
  group.dataset.blankId = String(blank.id);
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', `空格 ${blank.id}`);

  const choices = blank.choices && blank.choices.length === 3
    ? blank.choices
    : [blank.answer];

  choices.forEach((choice) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choice-button';
    button.textContent = choice;
    button.dataset.answer = choice;
    button.setAttribute('aria-pressed', 'false');

    button.addEventListener('click', () => {
      if (isGraded) {
        return;
      }

      group.querySelectorAll('.choice-button').forEach((choiceButton) => {
        choiceButton.classList.remove('selected');
        choiceButton.setAttribute('aria-pressed', 'false');
      });
      button.classList.add('selected');
      button.setAttribute('aria-pressed', 'true');
      refreshSubmitAvailability();
    });

    group.appendChild(button);
  });

  item.appendChild(group);
  return item;
}

function createBlankInput(blank) {
  const item = document.createElement('div');
  item.className = 'answer-item';
  item.dataset.blankId = String(blank.id);

  const label = document.createElement('label');
  const inputId = `answer-b${blank.id}`;
  label.setAttribute('for', inputId);
  label.textContent = `空格 ${blank.id}`;

  const input = document.createElement('input');
  input.type = 'text';
  input.id = inputId;
  input.dataset.answer = blank.answer;
  input.dataset.blank = String(blank.id);
  input.placeholder = '請輸入答案';
  input.addEventListener('input', () => {
    if (!isGraded) {
      refreshSubmitAvailability();
    }
  });

  item.appendChild(label);
  item.appendChild(input);
  return item;
}

function allBlanksAnswered() {
  const current = quizVerses[currentVerseIndex];
  if (!current) {
    return false;
  }

  return current.blanks.every((blank) => {
    if (currentQuizMode === 'choice') {
      const selected = memorizeResult.querySelector(
        `.choice-group[data-blank-id="${blank.id}"] .choice-button.selected`
      );
      return Boolean(selected);
    }

    const input = memorizeResult.querySelector(`input[data-blank="${blank.id}"]`);
    return Boolean(input && input.value.trim());
  });
}

function refreshSubmitAvailability() {
  if (isGraded || quizVerses.length === 0) {
    submitAnswersBtn.classList.add('hidden');
    return;
  }

  submitAnswersBtn.classList.remove('hidden');
  submitAnswersBtn.disabled = !allBlanksAnswered();
}

function renderCurrentVerse() {
  memorizeResult.innerHTML = '';
  gradingResult.innerHTML = '';
  hideActionButtons();
  isGraded = false;

  if (!currentQuizMeta || quizVerses.length === 0) {
    updateProgress();
    setMessage('此範圍沒有可練習的題目，請更換章節或重新出題。', true);
    return;
  }

  if (currentVerseIndex >= quizVerses.length) {
    showFinalSummary();
    return;
  }

  const verseData = quizVerses[currentVerseIndex];
  updateProgress();
  updateDemoHeading(currentQuizMeta.book, currentQuizMeta.chapter, verseData.verse);

  const header = document.createElement('h2');
  header.textContent = `${currentQuizMeta.book} ${currentQuizMeta.chapter}:${verseData.verse}`;
  memorizeResult.appendChild(header);

  const verseBlock = document.createElement('article');
  verseBlock.className = 'memorize-verse-block question-block';

  const line = document.createElement('p');
  line.className = 'verse-line';
  line.innerHTML = `<span class="verse-number">${verseData.verse}</span> ${verseData.maskedText}`;
  verseBlock.appendChild(line);

  const prompt = document.createElement('p');
  prompt.className = 'hint-text';
  prompt.textContent =
    currentQuizMode === 'choice'
      ? `本節共 ${verseData.blanks.length} 題選擇題，請全部作答後再提交。`
      : `本節共 ${verseData.blanks.length} 個空格，請全部填寫後再提交。`;
  verseBlock.appendChild(prompt);

  const answerArea = document.createElement('div');
  answerArea.className = 'answer-area answer-grid';

  verseData.blanks.forEach((blank) => {
    if (currentQuizMode === 'choice') {
      answerArea.appendChild(createChoiceGroup(blank));
    } else {
      answerArea.appendChild(createBlankInput(blank));
    }
  });

  verseBlock.appendChild(answerArea);
  memorizeResult.appendChild(verseBlock);
  refreshSubmitAvailability();
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

function submitCurrentVerseAnswers() {
  const verseData = quizVerses[currentVerseIndex];
  if (!verseData || isGraded) {
    return;
  }

  if (!allBlanksAnswered()) {
    setMessage('請先完成本節所有空格再提交。', true);
    return;
  }

  isGraded = true;
  submitAnswersBtn.classList.add('hidden');
  gradingResult.innerHTML = '';

  let verseCorrect = 0;
  const details = document.createElement('div');
  details.className = 'grading-details';

  verseData.blanks.forEach((blank) => {
    let userAnswer = '';
    let isCorrect = false;

    if (currentQuizMode === 'choice') {
      const group = memorizeResult.querySelector(`.choice-group[data-blank-id="${blank.id}"]`);
      const selected = group?.querySelector('.choice-button.selected');
      userAnswer = selected?.dataset.answer || '';
      isCorrect = userAnswer === blank.answer;
      if (group) {
        markChoiceGroup(group, userAnswer, blank.answer);
      }
    } else {
      const input = memorizeResult.querySelector(`input[data-blank="${blank.id}"]`);
      userAnswer = input?.value.trim() || '';
      isCorrect = userAnswer === blank.answer;
      if (input) {
        input.classList.toggle('correct', isCorrect);
        input.classList.toggle('incorrect', !isCorrect);
        input.disabled = true;
      }
    }

    if (isCorrect) {
      verseCorrect += 1;
      correctCount += 1;
    }

    const item = document.createElement('p');
    item.className = `grading-item ${isCorrect ? 'ok' : 'bad'}`;
    item.textContent = isCorrect
      ? `空格 ${blank.id}：正確`
      : `空格 ${blank.id}：錯誤（正確：${blank.answer}）`;
    details.appendChild(item);
  });

  const summary = document.createElement('h3');
  summary.textContent = `本節結果：${verseCorrect} / ${verseData.blanks.length} 正確`;
  gradingResult.appendChild(summary);
  gradingResult.appendChild(details);

  setMessage(
    verseCorrect === verseData.blanks.length
      ? '本節全部答對！可按「下一節」繼續。'
      : '已完成本節批改，請參考正解後按「下一節」。',
    verseCorrect !== verseData.blanks.length
  );

  if (canGoNextVerse() || currentVerseIndex + 1 < quizVerses.length) {
    nextVerseBtn.classList.remove('hidden');
  }
}

function showFinalSummary() {
  memorizeResult.innerHTML = '';
  gradingResult.innerHTML = '';
  hideActionButtons();

  const summary = document.createElement('h3');
  summary.textContent = `作答完成：${correctCount} / ${totalBlankCount} 正確`;
  gradingResult.appendChild(summary);

  if (correctCount === totalBlankCount && totalBlankCount > 0) {
    setMessage('太好了，全部答對！', false);
  } else {
    setMessage('已完成本次練習，可重新出題或更換章節。', false);
  }

  quizProgress.classList.add('hidden');
  isGraded = false;
}

function renderMemorizeResult(data) {
  clearQuizResults();
  currentQuizMode = data.mode || 'choice';
  currentQuizMeta = {
    book: data.book,
    chapter: data.chapter,
    verse: data.verses.length === 1 ? data.verses[0].number : null
  };
  quizVerses = buildQuizVerses(data);
  totalBlankCount = countAllBlanks(quizVerses);
  retryMaskBtn.classList.remove('hidden');

  if (quizVerses.length === 0) {
    setMessage('此範圍沒有可練習的題目，請更換章節或重新出題。', true);
    return;
  }

  currentVerseIndex = 0;
  correctCount = 0;
  renderCurrentVerse();
  setMessage(
    currentQuizMode === 'choice'
      ? '請答完本節所有選擇題後再提交，批改後可按「下一節」。'
      : '請填完本節所有空格後再提交，批改後可按「下一節」。',
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

function goToNextVerse() {
  if (currentVerseIndex + 1 < quizVerses.length) {
    currentVerseIndex += 1;
    renderCurrentVerse();
    setMessage(
      currentQuizMode === 'choice'
        ? '請答完本節所有選擇題後再提交。'
        : '請填完本節所有空格後再提交。',
      false
    );
    return;
  }

  const book = booksSelect.value || currentQuizMeta?.book;
  const chapter = chapterSelect.value || String(currentQuizMeta?.chapter || '');

  if (!book || !chapter || !bibleIndex[book]) {
    setMessage('無法載入下一節，請重新選擇章節。', true);
    return;
  }

  const verseCount = bibleIndex[book][chapter];
  const currentVerse = Number(
    verseSelect.value || currentQuizMeta?.verse || quizVerses[currentVerseIndex]?.verse || 0
  );
  const nextVerse = Number.isInteger(currentVerse) && currentVerse > 0 ? currentVerse + 1 : 2;

  if (!Number.isInteger(verseCount) || nextVerse > verseCount) {
    showFinalSummary();
    setMessage('已到本章最後一節。', false);
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
submitAnswersBtn.addEventListener('click', submitCurrentVerseAnswers);
nextVerseBtn.addEventListener('click', goToNextVerse);

document.querySelectorAll('input[name="quizMode"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    if (quizVerses.length > 0 || memorizeDefaults.autoStart) {
      startMemorize();
    }
  });
});

applyDefaults();

if (memorizeDefaults.autoStart) {
  startMemorize();
}
