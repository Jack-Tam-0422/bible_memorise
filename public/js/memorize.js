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
const quizMessage = document.getElementById('quizMessage');
const memorizeMessage = document.getElementById('memorizeMessage');
const customSelectPanel = document.getElementById('customSelectPanel');
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
}

function getCurrentVerseNumber() {
  return Number(
    verseSelect.value || currentQuizMeta?.verse || quizVerses[currentVerseIndex]?.verse || 0
  );
}

function clearQuizResults() {
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

function updateVerseNavButtons() {
  prevVerseBtn.classList.toggle('hidden', !canGoPreviousVerse());
  nextVerseBtn.classList.toggle('hidden', !canGoNextVerse());
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
      ? `本節共 ${verseData.blanks.length} 題選擇題，請全部作答後提交；也可先按「上一節」或「下一節」跳過。`
      : `本節共 ${verseData.blanks.length} 個空格，請全部填寫後提交；也可先按「上一節」或「下一節」跳過。`;
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

function appendBlankFeedback(container, isCorrect, expectedAnswer) {
  if (!container) {
    return;
  }

  container.querySelectorAll('.question-feedback').forEach((node) => node.remove());

  const feedback = document.createElement('p');
  feedback.className = `question-feedback ${isCorrect ? 'ok' : 'bad'}`;
  feedback.textContent = isCorrect
    ? '✓ 答對了！'
    : `✗ 答錯了，正確答案：${expectedAnswer}`;
  container.classList.toggle('answered-ok', isCorrect);
  container.classList.toggle('answered-bad', !isCorrect);
  container.appendChild(feedback);
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

  isGraded = true;
  submitAnswersBtn.classList.add('hidden');
  gradingResult.innerHTML = '';
  gradingResult.classList.remove('hidden');

  let verseCorrect = 0;
  const details = document.createElement('div');
  details.className = 'grading-details';

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

    appendBlankFeedback(item, isCorrect, blank.answer);

    if (isCorrect) {
      verseCorrect += 1;
      correctCount += 1;
    }

    const line = document.createElement('p');
    line.className = `grading-item ${isCorrect ? 'ok' : 'bad'}`;
    line.textContent = isCorrect
      ? `✓ 空格 ${blank.id}：正確`
      : `✗ 空格 ${blank.id}：錯誤（你的答案：${userAnswer || '未作答'}；正確：${blank.answer}）`;
    details.appendChild(line);
  });

  const allCorrect = verseCorrect === verseData.blanks.length;
  const banner = document.createElement('div');
  banner.className = `grading-banner ${allCorrect ? 'ok' : 'bad'}`;
  banner.textContent = allCorrect
    ? `答對了！本節 ${verseCorrect} / ${verseData.blanks.length} 全對`
    : `有答錯的題目：本節 ${verseCorrect} / ${verseData.blanks.length} 正確`;

  const summary = document.createElement('h3');
  summary.textContent = `本節結果：${verseCorrect} / ${verseData.blanks.length} 正確`;

  gradingResult.appendChild(banner);
  gradingResult.appendChild(summary);
  gradingResult.appendChild(details);

  setQuizMessage(
    allCorrect
      ? '本節全部答對！可按「上一節」或「下一節」繼續。'
      : '已完成本節批改，請查看下方對錯後按「上一節」或「下一節」。',
    !allCorrect
  );

  updateVerseNavButtons();
  gradingResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
      ? '請答完本節所有選擇題後提交；也可隨時用「上一節」或「下一節」跳過。'
      : '請填完本節所有空格後提交；也可隨時用「上一節」或「下一節」跳過。',
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
    collapseCustomSelectPanel();
  } catch (error) {
    clearQuizResults();
    setMessage(error.message, true);
  }
}

function goToPreviousVerse() {
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

applyDefaults();

if (memorizeDefaults.autoStart) {
  startMemorize();
}
