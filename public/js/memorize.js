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

function updateChapters() {
  const selectedBook = booksSelect.value;
  resetSelect(chapterSelect, '請選擇章');
  resetSelect(verseSelect, '請選擇節');
  memorizeResult.innerHTML = '';
  gradingResult.innerHTML = '';
  submitAnswersBtn.classList.add('hidden');
  retryMaskBtn.classList.add('hidden');
  currentBlankAnswers = [];

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
  memorizeResult.innerHTML = '';
  gradingResult.innerHTML = '';
  submitAnswersBtn.classList.add('hidden');
  retryMaskBtn.classList.add('hidden');
  currentBlankAnswers = [];

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

function createVerseBlock(verseData) {
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
  maskInfo.textContent = `本節共遮罩 ${maskedParts} 處，合計 ${maskedChars} 字。`;
  verseBlock.appendChild(maskInfo);

  const inputGrid = document.createElement('div');
  inputGrid.className = 'answer-grid';

  verseData.blanks.forEach((blank) => {
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
    inputGrid.appendChild(item);
  });

  verseBlock.appendChild(inputGrid);
  return verseBlock;
}

function renderMemorizeResult(data) {
  memorizeResult.innerHTML = '';
  gradingResult.innerHTML = '';
  currentBlankAnswers = [];
  retryMaskBtn.classList.remove('hidden');

  const header = document.createElement('h2');
  header.textContent = `${data.book} ${data.chapter} 章`;
  memorizeResult.appendChild(header);

  data.verses.forEach((verseData) => {
    const block = createVerseBlock(verseData);
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

  if (!book || !chapter) {
    setMessage('書卷與章為必選，請先完成選擇。', true);
    memorizeResult.innerHTML = '';
    gradingResult.innerHTML = '';
    submitAnswersBtn.classList.add('hidden');
    retryMaskBtn.classList.add('hidden');
    return;
  }

  setMessage('正在產生背誦題目...', false);
  const params = new URLSearchParams({ book, chapter });
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
    setMessage('題目已產生，請填寫空格後提交答案。', false);
  } catch (error) {
    memorizeResult.innerHTML = '';
    gradingResult.innerHTML = '';
    submitAnswersBtn.classList.add('hidden');
    retryMaskBtn.classList.add('hidden');
    setMessage(error.message, true);
  }
}

function submitAnswers() {
  const inputs = memorizeResult.querySelectorAll('input[data-answer]');
  if (inputs.length === 0) {
    gradingResult.innerHTML = '';
    setMessage('目前沒有可提交的空格題目。', true);
    return;
  }

  let correct = 0;
  let total = 0;

  const details = document.createElement('div');
  details.className = 'grading-details';

  inputs.forEach((input) => {
    total += 1;
    const userAnswer = input.value.trim();
    const expected = input.dataset.answer || '';
    const isCorrect = userAnswer === expected;

    input.classList.toggle('correct', isCorrect);
    input.classList.toggle('incorrect', !isCorrect);
    if (isCorrect) {
      correct += 1;
    }

    const item = document.createElement('p');
    item.className = `grading-item ${isCorrect ? 'ok' : 'bad'}`;
    item.textContent = `第 ${input.dataset.verse} 節空格 ${input.dataset.blank}：${
      isCorrect ? '正確' : `錯誤（正解：${expected}）`
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
