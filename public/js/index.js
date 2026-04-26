const booksSelect = document.getElementById('books');
const chapterSelect = document.getElementById('chapter');
const verseSelect = document.getElementById('verse');
const showScriptureBtn = document.getElementById('showScriptureBtn');
const scriptureResult = document.getElementById('scriptureResult');
const formMessage = document.getElementById('formMessage');
const bibleIndex = window.bibleIndex || {};

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

function updateChapters() {
  const selectedBook = booksSelect.value;
  resetSelect(chapterSelect, '請選擇章');
  resetSelect(verseSelect, '請選擇節');

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

booksSelect.addEventListener('change', updateChapters);
chapterSelect.addEventListener('change', updateVerses);

function setFormMessage(text, isError) {
  formMessage.textContent = text;
  formMessage.classList.toggle('error', isError);
}

function renderScripture(data) {
  const header = document.createElement('h2');
  header.textContent = `${data.book} ${data.chapter}`;
  scriptureResult.innerHTML = '';
  scriptureResult.appendChild(header);

  data.verses.forEach((verse) => {
    const verseLine = document.createElement('p');
    verseLine.className = 'verse-line';
    verseLine.innerHTML = `<span class="verse-number">${verse.number}</span> ${verse.text}`;
    scriptureResult.appendChild(verseLine);
  });
}

async function showScripture() {
  const book = booksSelect.value;
  const chapter = chapterSelect.value;
  const verse = verseSelect.value;

  if (!book || !chapter) {
    setFormMessage('書卷與章為必選，請先完成選擇。', true);
    scriptureResult.innerHTML = '';
    return;
  }

  setFormMessage('正在載入經文...', false);

  const params = new URLSearchParams({ book, chapter });
  if (verse) {
    params.set('verse', verse);
  }

  try {
    const response = await fetch(`/api/scripture?${params.toString()}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '無法載入經文。');
    }

    renderScripture(data);
    setFormMessage(
      verse ? '目前顯示已選節。' : '未選擇節，已顯示整章經文。',
      false
    );
  } catch (error) {
    scriptureResult.innerHTML = '';
    setFormMessage(error.message, true);
  }
}

showScriptureBtn.addEventListener('click', showScripture);
