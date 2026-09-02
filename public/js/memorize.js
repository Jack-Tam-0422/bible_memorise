const booksSelect = document.getElementById('books');
const chapterSelect = document.getElementById('chapter');
const verseSelect = document.getElementById('verse');
const startMemorizeBtn = document.getElementById('startMemorizeBtn');
const retryMaskBtn = document.getElementById('retryMaskBtn');
const submitAnswersBtn = document.getElementById('submitAnswersBtn');
const memorizeResult = document.getElementById('memorizeResult');
const gradingResult = document.getElementById('gradingResult');
const memorizeMessage = document.getElementById('memorizeMessage');
const bibleIndex = window.bibleIndex || {};

let currentBlankAnswers = [];
let currentQuizMode = 'blank';

function getSelectedQuizMode() {
  const selected = document.querySelector('input[name="quizMode"]:checked');
  return selected ? selected.value : 'blank';
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

function clearQuizResults() {
  memorizeResult.innerHTML = '';
  gradingResult.innerHTML = '';
  submitAnswersBtn.classList.add('hidden');
  retryMaskBtn.classList.add('hidden');
  currentBlankAnswers = [];
}

function updateChapters() {
  const selectedBook = booksSelect.value;
  resetSelect(chapterSelect, '請選擇章');
  resetSelect(verseSelect, '請選擇節');
  clearQuizResults();

  if (!selectedBook || !bibleIndex[selectedBook]) {
    return;
  }

  const chapterNumbers = Object.keys(bibleIndex[selectedBook])
    .map((chapter) => Number(chapter))
    .sort((a, b) => a - b);

  populateSelect(chapterSelect, chapterNumbers);
}

function updateVerses() {
  const selectedBook = booksSelect.value;
  const selectedChapter = chapterSelect.value;
  resetSelect(verseSelect, '請選擇節');
  clearQuizResults();

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

function createBlankInput(verseData, blank) {
  const item = document.createElement('div');
  item.className = 'answer-item';

  const label = document.createElement('label');
  const inputId = `answer-v${verseData.number}-b${blank.id}`;
  label.setAttribute('for', inputId);
  label.textContent = `第 ${verseData.number} 節空格 ${blank.id}`;

  const input = document.createElement('input');
  input.type = 'text';
  input.id = inputId;
  input.dataset.answer = blank.answer;
  input.dataset.verse = String(verseData.number);
  input.dataset.blank = String(blank.id);
  input.placeholder = '請輸入答案';

  item.appendChild(label);
  item.appendChild(input);
  return item;
}

function createChoiceGroup(verseData, blank) {
  const item = document.createElement('div');
  item.className = 'answer-item choice-item';

  const label = document.createElement('p');
  label.className = 'choice-label';
  label.textContent = `第 ${verseData.number} 節空格 ${blank.id}`;
  item.appendChild(label);

  const group = document.createElement('div');
  group.className = 'choice-group';
  group.dataset.correctAnswer = blank.answer;
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', `第 ${verseData.number} 節空格 ${blank.id}`);

  blank.choices.forEach((choice, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choice-button';
    button.textContent = choice;
    button.dataset.answer = choice;
    button.dataset.verse = String(verseData.number);
    button.dataset.blank = String(blank.id);
    button.setAttribute('aria-pressed', 'false');

    button.addEventListener('click', () => {
      group.querySelectorAll('.choice-button').forEach((choiceButton) => {
        choiceButton.classList.remove('selected');
        choiceButton.setAttribute('aria-pressed', 'false');
      });
      button.classList.add('selected');
      button.setAttribute('aria-pressed', 'true');
    });

    if (index === 0) {
      button.id = `answer-v${verseData.number}-b${blank.id}`;
    }

    group.appendChild(button);
  });

  item.appendChild(group);
  return item;
}

function createVerseBlock(verseData, mode) {
  const verseBlock = document.createElement('article');
  verseBlock.className = 'memorize-verse-block';

  const line = document.createElement('p');
  line.className = 'verse-line';
  line.innerHTML = `<span class="verse-number">${verseData.number}</span> ${verseData.maskedText}`;
  verseBlock.appendChild(line);

  if (verseData.blanks.length === 0) {
    const noBlank = document.createElement('p');
    noBlank.className = 'hint-text';
    noBlank.textContent = '此節過短或無可遮罩文字，請直接閱讀經文。';
    verseBlock.appendChild(noBlank);
    return verseBlock;
  }

  const maskedParts = verseData.blanks.length;
  const maskedChars = verseData.blanks.reduce((total, blank) => total + blank.answer.length, 0);
  const maskInfo = document.createElement('p');
  maskInfo.className = 'hint-text';
  maskInfo.textContent =
    mode === 'choice'
      ? `本節共 ${maskedParts} 題選擇題，合計 ${maskedChars} 字。`
      : `本節共遮罩 ${maskedParts} 處，合計 ${maskedChars} 字。`;
  verseBlock.appendChild(maskInfo);

  const answerGrid = document.createElement('div');
  answerGrid.className = 'answer-grid';

  verseData.blanks.forEach((blank) => {
    const useChoices = mode === 'choice' && Array.isArray(blank.choices) && blank.choices.length === 3;
    const answerItem = useChoices
      ? createChoiceGroup(verseData, blank)
      : createBlankInput(verseData, blank);
    answerGrid.appendChild(answerItem);
  });

  verseBlock.appendChild(answerGrid);
  return verseBlock;
}

function renderMemorizeResult(data) {
  memorizeResult.innerHTML = '';
  gradingResult.innerHTML = '';
  currentBlankAnswers = [];
  currentQuizMode = data.mode || 'blank';
  retryMaskBtn.classList.remove('hidden');

  const header = document.createElement('h2');
  header.textContent = `${data.book} ${data.chapter} 章`;
  memorizeResult.appendChild(header);

  data.verses.forEach((verseData) => {
    const block = createVerseBlock(verseData, currentQuizMode);
    memorizeResult.appendChild(block);

    verseData.blanks.forEach((blank) => {
      currentBlankAnswers.push({
        verse: verseData.number,
        blank: blank.id,
        answer: blank.answer
      });
    });
  });

  if (currentBlankAnswers.length > 0) {
    submitAnswersBtn.classList.remove('hidden');
  } else {
    submitAnswersBtn.classList.add('hidden');
  }
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
    setMessage(
      mode === 'choice'
        ? '選擇題已產生，請選擇答案後提交。'
        : '題目已產生，請填寫空格後提交答案。',
      false
    );
  } catch (error) {
    clearQuizResults();
    setMessage(error.message, true);
  }
}


function getUserAnswerForBlank(verse, blank) {
  const input = memorizeResult.querySelector(
    `input[data-verse="${verse}"][data-blank="${blank}"]`
  );
  if (input) {
    return input.value.trim();
  }

  const selectedChoice = memorizeResult.querySelector(
    `.choice-button.selected[data-verse="${verse}"][data-blank="${blank}"]`
  );
  return selectedChoice ? selectedChoice.dataset.answer : '';
}

function getExpectedAnswer(verse, blank) {
  const input = memorizeResult.querySelector(
    `input[data-verse="${verse}"][data-blank="${blank}"]`
  );
  if (input) {
    return input.dataset.answer || '';
  }

  const group = memorizeResult.querySelector(
    `.choice-button[data-verse="${verse}"][data-blank="${blank}"]`
  )?.parentElement;

  return group?.dataset.correctAnswer || '';
}

function markAnswerElement(verse, blank, isCorrect) {
  const input = memorizeResult.querySelector(
    `input[data-verse="${verse}"][data-blank="${blank}"]`
  );
  if (input) {
    input.classList.toggle('correct', isCorrect);
    input.classList.toggle('incorrect', !isCorrect);
    return;
  }

  const group = memorizeResult.querySelector(
    `.choice-button[data-verse="${verse}"][data-blank="${blank}"]`
  )?.parentElement;

  if (!group) {
    return;
  }

  const expectedAnswer = group.dataset.correctAnswer || '';
  const selectedChoice = group.querySelector('.choice-button.selected');

  group.querySelectorAll('.choice-button').forEach((button) => {
    const isExpected = button.dataset.answer === expectedAnswer;
    button.classList.toggle('correct', isExpected);
    button.classList.toggle('incorrect', selectedChoice === button && !isCorrect);
  });
}

function submitAnswers() {
  if (currentBlankAnswers.length === 0) {
    gradingResult.innerHTML = '';
    setMessage('目前沒有可提交的題目。', true);
    return;
  }

  let correct = 0;
  let total = 0;

  const details = document.createElement('div');
  details.className = 'grading-details';

  currentBlankAnswers.forEach((blankData) => {
    total += 1;
    const userAnswer = getUserAnswerForBlank(blankData.verse, blankData.blank);
    const expected = getExpectedAnswer(blankData.verse, blankData.blank);
    const isCorrect = userAnswer === expected;

    markAnswerElement(blankData.verse, blankData.blank, isCorrect);
    if (isCorrect) {
      correct += 1;
    }

    const item = document.createElement('p');
    item.className = `grading-item ${isCorrect ? 'ok' : 'bad'}`;
    item.textContent = `第 ${blankData.verse} 節空格 ${blankData.blank}：${
      isCorrect ? '正確' : `錯誤（正確：${expected}）`
    }`;
    details.appendChild(item);
  });

  gradingResult.innerHTML = '';
  const summary = document.createElement('h3');
  summary.textContent = `作答結果：${correct} / ${total} 正確`;
  gradingResult.appendChild(summary);
  gradingResult.appendChild(details);

  setMessage(
    correct === total ? '太好了，全部答對！' : '已完成批改，請參考下方正解。',
    correct !== total
  );
}

booksSelect.addEventListener('change', updateChapters);
chapterSelect.addEventListener('change', updateVerses);
startMemorizeBtn.addEventListener('click', startMemorize);
retryMaskBtn.addEventListener('click', startMemorize);
submitAnswersBtn.addEventListener('click', submitAnswers);
