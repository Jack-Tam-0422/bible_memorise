const booksSelect = document.getElementById('books');
const chapterSelect = document.getElementById('chapter');
const verseSelect = document.getElementById('verse');
const startMemorizeBtn = document.getElementById('startMemorizeBtn');
const retryMaskBtn = document.getElementById('retryMaskBtn');
const submitAnswersBtn = document.getElementById('submitAnswersBtn');
const prevVerseBtn = document.getElementById('prevVerseBtn');
const nextVerseBtn = document.getElementById('nextVerseBtn');
const memorizeResult = document.getElementById('memorizeResult');
const gradingResult = document.getElementById('gradingResult');
const continueHint = document.getElementById('continueHint');
const quizMessage = document.getElementById('quizMessage');
const memorizeMessage = document.getElementById('memorizeMessage');
const customSelectPanel = document.getElementById('customSelectPanel');
const bibleIndex = window.bibleIndex || {};
const memorizeDefaults = window.memorizeDefaults || {};
const DENSITY_STORAGE_KEY = 'memorizeBlankDensity';
const VALID_DENSITIES = new Set(['low', 'medium', 'high']);

let quizVerses = [];
let currentVerseIndex = 0;
let correctCount = 0;
let totalBlankCount = 0;
let currentQuizMode = 'choice';
let currentQuizMeta = null;
let isGraded = false;
let navigationUnlockTimer = null;
let navigationLocked = false;

function getSelectedQuizMode() {
  const selected = document.querySelector('input[name="quizMode"]:checked');
  return selected ? selected.value : 'choice';
}

function getSelectedBlankDensity() {
  const selected = document.querySelector('input[name="blankDensity"]:checked');
  if (selected && VALID_DENSITIES.has(selected.value)) {
    return selected.value;
  }
  return memorizeDefaults.defaultDensity || 'medium';
}

function setBlankDensitySelection(density) {
  const value = VALID_DENSITIES.has(density) ? density : 'medium';
  const radio = document.querySelector(`input[name="blankDensity"][value="${value}"]`);
  if (radio) {
    radio.checked = true;
  }
}

function loadSavedBlankDensity() {
  try {
    const saved = localStorage.getItem(DENSITY_STORAGE_KEY);
    if (VALID_DENSITIES.has(saved)) {
      setBlankDensitySelection(saved);
      return;
    }
  } catch (error) {
    // Ignore storage failures and fall back to defaults.
  }
  setBlankDensitySelection(memorizeDefaults.defaultDensity || 'medium');
}

function saveBlankDensity(density) {
  if (!VALID_DENSITIES.has(density)) {
    return;
  }
  try {
    localStorage.setItem(DENSITY_STORAGE_KEY, density);
  } catch (error) {
    // Ignore storage failures.
  }
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

function setQuizMessage(text, isError) {
  if (!quizMessage) {
    return;
  }

  if (!text) {
    quizMessage.textContent = '';
    quizMessage.classList.add('hidden');
    quizMessage.classList.remove('error');
    return;
  }

  quizMessage.textContent = text;
  quizMessage.classList.remove('hidden');
  quizMessage.classList.toggle('error', isError);
}

function collapseCustomSelectPanel() {
  if (customSelectPanel) {
    customSelectPanel.open = false;
  }
}

function hideActionButtons() {
  submitAnswersBtn.classList.add('hidden');
  prevVerseBtn.classList.add('hidden');
  nextVerseBtn.classList.add('hidden');
  if (continueHint) {
    continueHint.classList.add('hidden');
  }
}

function clearNavigationUnlockTimer() {
  if (navigationUnlockTimer) {
    clearTimeout(navigationUnlockTimer);
    navigationUnlockTimer = null;
  }
}

function unlockNavigation() {
  clearNavigationUnlockTimer();
  navigationLocked = false;
}

function setContinueHintVisible(visible) {
  if (!continueHint) {
    return;
  }
  continueHint.classList.toggle('hidden', !visible);
}

function hasStartedAnswering() {
  const current = quizVerses[currentVerseIndex];
  if (!current || isGraded) {
    return false;
  }

  return current.blanks.some((blank) => {
    if (currentQuizMode === 'choice') {
      return Boolean(
        memorizeResult.querySelector(
          `.choice-group[data-blank-id="${blank.id}"] .choice-button.selected`
        )
      );
    }

    const input = memorizeResult.querySelector(`input[data-blank="${blank.id}"]`);
    return Boolean(input && input.value.trim());
  });
}

function updateVerseNavButtons() {
  // Keep 上一節/下一節 available while answering multi-blank questions,
  // and also after grading so the user can continue.
  const allowNav = !navigationLocked;
  const showPrev = allowNav && canGoPreviousVerse();
  const showNext = allowNav && canGoNextVerse();
  prevVerseBtn.classList.toggle('hidden', !showPrev);
  nextVerseBtn.classList.toggle('hidden', !showNext);
  prevVerseBtn.disabled = !allowNav;
  nextVerseBtn.disabled = !allowNav;
  setContinueHintVisible(false);
}

function getCurrentVerseNumber() {
  return Number(
    verseSelect.value || currentQuizMeta?.verse || quizVerses[currentVerseIndex]?.verse || 0
  );
}

function clearQuizResults() {
  unlockNavigation();
  memorizeResult.innerHTML = '';
  gradingResult.innerHTML = '';
  setQuizMessage('');
  retryMaskBtn.classList.add('hidden');
  hideActionButtons();
  quizVerses = [];
  currentVerseIndex = 0;
  correctCount = 0;
  totalBlankCount = 0;
  currentQuizMeta = null;
  isGraded = false;
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

function canGoPreviousVerse() {
  if (currentVerseIndex > 0) {
    return true;
  }

  const currentVerse = getCurrentVerseNumber();
  return Number.isInteger(currentVerse) && currentVerse > 1;
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

  const currentVerse = getCurrentVerseNumber();
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
      updateVerseNavButtons();

      // Choice mode: once every blank is answered, grade immediately so
      // the user sees right/wrong before 下一節 appears.
      if (allBlanksAnswered()) {
        submitCurrentVerseAnswers();
      }
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
      updateVerseNavButtons();
    }
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !isGraded && allBlanksAnswered()) {
      event.preventDefault();
      submitCurrentVerseAnswers();
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

  // Choice mode auto-grades when all blanks are selected.
  if (currentQuizMode === 'choice') {
    submitAnswersBtn.classList.add('hidden');
    return;
  }

  submitAnswersBtn.classList.remove('hidden');
  submitAnswersBtn.disabled = !allBlanksAnswered();
}

function renderCurrentVerse() {
  unlockNavigation();
  memorizeResult.innerHTML = '';
  gradingResult.innerHTML = '';
  setQuizMessage('');
  hideActionButtons();
  isGraded = false;

  if (!currentQuizMeta || quizVerses.length === 0) {
    setMessage('此範圍沒有可練習的題目，請更換章節或重新出題。', true);
    return;
  }

  if (currentVerseIndex >= quizVerses.length) {
    showFinalSummary();
    return;
  }

  const verseData = quizVerses[currentVerseIndex];

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
      ? `本節共 ${verseData.blanks.length} 題選擇題：選完後會以綠/紅顯示對錯，再按「下一節」繼續。`
      : `本節共 ${verseData.blanks.length} 個空格：全部填完後提交，綠/紅顯示對錯，再按「下一節」繼續。`;
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
  updateVerseNavButtons();
}

function findAnswerItem(blankId) {
  return memorizeResult.querySelector(`.answer-item[data-blank-id="${blankId}"]`);
}

function markAnswerItem(container, isCorrect) {
  if (!container) {
    return;
  }

  container.classList.toggle('answered-ok', isCorrect);
  container.classList.toggle('answered-bad', !isCorrect);

  container.querySelectorAll('.blank-result-label').forEach((node) => node.remove());
  const label = document.createElement('p');
  label.className = `blank-result-label ${isCorrect ? 'ok' : 'bad'}`;
  label.textContent = isCorrect ? '答對' : '答錯';
  container.appendChild(label);
}

function markChoiceGroup(group, selectedAnswer, expectedAnswer) {
  group.querySelectorAll('.choice-button').forEach((button) => {
    const isExpected = button.dataset.answer === expectedAnswer;
    const isSelected = button.dataset.answer === selectedAnswer;
    button.classList.remove('selected');
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
    setQuizMessage('請先完成本節所有空格再提交。', true);
    return;
  }

  // Stay on this verse and show green/red only. Nav unlocks so the user
  // can press 下一節 after checking the colors.
  isGraded = true;
  clearNavigationUnlockTimer();
  navigationLocked = false;
  submitAnswersBtn.classList.add('hidden');
  setContinueHintVisible(false);
  setQuizMessage('');
  gradingResult.innerHTML = '';
  gradingResult.classList.add('hidden');

  verseData.blanks.forEach((blank) => {
    let userAnswer = '';
    let isCorrect = false;
    const item = findAnswerItem(blank.id);

    if (currentQuizMode === 'choice') {
      const group =
        item?.querySelector('.choice-group') ||
        memorizeResult.querySelector(`.choice-group[data-blank-id="${blank.id}"]`);
      const selected = group?.querySelector('.choice-button.selected');
      userAnswer = selected?.dataset.answer || '';
      isCorrect = userAnswer === blank.answer;
      if (group) {
        markChoiceGroup(group, userAnswer, blank.answer);
      }
    } else {
      const input =
        item?.querySelector('input') ||
        memorizeResult.querySelector(`input[data-blank="${blank.id}"]`);
      userAnswer = input?.value.trim() || '';
      isCorrect = userAnswer === blank.answer;
      if (input) {
        input.classList.toggle('correct', isCorrect);
        input.classList.toggle('incorrect', !isCorrect);
        input.disabled = true;
      }
    }

    markAnswerItem(item, isCorrect);

    if (isCorrect) {
      correctCount += 1;
    }
  });

  updateVerseNavButtons();
}

function showFinalSummary() {
  memorizeResult.innerHTML = '';
  gradingResult.innerHTML = '';
  hideActionButtons();

  const summary = document.createElement('h3');
  summary.textContent = `作答完成：${correctCount} / ${totalBlankCount} 正確`;
  gradingResult.appendChild(summary);

  if (correctCount === totalBlankCount && totalBlankCount > 0) {
    setQuizMessage('太好了，全部答對！', false);
  } else {
    setQuizMessage('已完成本次練習，可重新出題或更換章節。', false);
  }

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
      ? '選完答案後會以綠/紅顯示對錯，再按「下一節」繼續。'
      : '填完並提交後會以綠/紅顯示對錯，再按「下一節」繼續。',
    false
  );
}

async function startMemorize() {
  const book = booksSelect.value;
  const chapter = chapterSelect.value;
  const verse = verseSelect.value;
  const mode = getSelectedQuizMode();
  const density = getSelectedBlankDensity();

  if (!book || !chapter) {
    setMessage('書卷與章為必選，請先完成選擇。', true);
    clearQuizResults();
    return;
  }

  setMessage('正在產生背誦題目...', false);
  const params = new URLSearchParams({ book, chapter, mode, density });
  if (verse) {
    params.set('verse', verse);
  }

  try {
    const response = await fetch(`/api/memorize?${params.toString()}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '無法產生背誦題目。');
    }

    saveBlankDensity(density);
    renderMemorizeResult(data);
    collapseCustomSelectPanel();
  } catch (error) {
    clearQuizResults();
    setMessage(error.message, true);
  }
}

function goToPreviousVerse() {
  if (navigationLocked) {
    return;
  }

  unlockNavigation();
  if (currentVerseIndex > 0) {
    currentVerseIndex -= 1;
    renderCurrentVerse();
    setMessage(
      currentQuizMode === 'choice'
        ? '請答完本節所有選擇題後提交；也可隨時用「上一節」或「下一節」跳過。'
        : '請填完本節所有空格後提交；也可隨時用「上一節」或「下一節」跳過。',
      false
    );
    return;
  }

  const book = booksSelect.value || currentQuizMeta?.book;
  const chapter = chapterSelect.value || String(currentQuizMeta?.chapter || '');

  if (!book || !chapter || !bibleIndex[book]) {
    setMessage('無法載入上一節，請重新選擇章節。', true);
    return;
  }

  const currentVerse = getCurrentVerseNumber();
  if (!Number.isInteger(currentVerse) || currentVerse <= 1) {
    setMessage('已是本章第一節。', false);
    return;
  }

  const previousVerse = currentVerse - 1;

  if (!verseSelect.querySelector(`option[value="${previousVerse}"]`)) {
    updateVerses({ clearQuiz: false });
  }

  verseSelect.value = String(previousVerse);
  startMemorize();
}

function goToNextVerse() {
  if (navigationLocked) {
    return;
  }

  unlockNavigation();
  if (currentVerseIndex + 1 < quizVerses.length) {
    currentVerseIndex += 1;
    renderCurrentVerse();
    setMessage(
      currentQuizMode === 'choice'
        ? '請答完本節所有選擇題後提交；也可隨時用「上一節」或「下一節」跳過。'
        : '請填完本節所有空格後提交；也可隨時用「上一節」或「下一節」跳過。',
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
  const currentVerse = getCurrentVerseNumber();
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
prevVerseBtn.addEventListener('click', goToPreviousVerse);
nextVerseBtn.addEventListener('click', goToNextVerse);

document.querySelectorAll('input[name="quizMode"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    if (quizVerses.length > 0 || memorizeDefaults.autoStart) {
      startMemorize();
    }
  });
});

document.querySelectorAll('input[name="blankDensity"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    saveBlankDensity(getSelectedBlankDensity());
    if (quizVerses.length > 0 || memorizeDefaults.autoStart) {
      startMemorize();
    }
  });
});

loadSavedBlankDensity();
applyDefaults();

if (memorizeDefaults.autoStart) {
  startMemorize();
}
