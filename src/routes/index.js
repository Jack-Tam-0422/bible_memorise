const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const biblePath = path.join(__dirname, '../../data/bible.json');
const bibleData = JSON.parse(fs.readFileSync(biblePath, 'utf-8'));
const englishToChineseBookMap = {
  Genesis: '創世記',
  Exodus: '出埃及記',
  Leviticus: '利未記',
  Numbers: '民數記',
  Deuteronomy: '申命記',
  Joshua: '約書亞記',
  Judges: '士師記',
  Ruth: '路得記',
  Samuel1: '撒母耳記上',
  Samuel2: '撒母耳記下',
  Kings1: '列王紀上',
  Kings2: '列王紀下',
  Chronicles1: '歷代志上',
  Chronicles2: '歷代志下',
  Ezra: '以斯拉記',
  Nehemiah: '尼希米記',
  Esther: '以斯帖記',
  Job: '約伯記',
  Psalms: '詩篇',
  Proverbs: '箴言',
  Ecclesiastes: '傳道書',
  Songs: '雅歌',
  Isaiah: '以賽亞書',
  Jeremiah: '耶利米書',
  Lamentations: '耶利米哀歌',
  Ezekiel: '以西結書',
  Daniel: '但以理書',
  Hosea: '何西阿書',
  Joel: '約珥書',
  Amos: '阿摩司書',
  Obadiah: '俄巴底亞書',
  Jonah: '約拿書',
  Micah: '彌迦書',
  Nahum: '那鴻書',
  Habakkuk: '哈巴谷書',
  Zephaniah: '西番雅書',
  Haggai: '哈該書',
  Zechariah: '撒迦利亞書',
  Malachi: '瑪拉基書',
  Matthew: '馬太福音',
  Mark: '馬可福音',
  Luke: '路加福音',
  John: '約翰福音',
  Acts: '使徒行傳',
  Romans: '羅馬書',
  Corinthians1: '哥林多前書',
  Corinthians2: '哥林多後書',
  Galatians: '加拉太書',
  Ephesians: '以弗所書',
  Philippians: '腓立比書',
  Colossians: '歌羅西書',
  Thessalonians1: '帖撒羅尼迦前書',
  Thessalonians2: '帖撒羅尼迦後書',
  Timothy1: '提摩太前書',
  Timothy2: '提摩太後書',
  Titus: '提多書',
  Philemon: '腓利門書',
  Hebrews: '希伯來書',
  James: '雅各書',
  Peter1: '彼得前書',
  Peter2: '彼得後書',
  John1: '約翰壹書',
  John2: '約翰貳書',
  John3: '約翰參書',
  Jude: '猶大書',
  Revelation: '啟示錄'
};
const chineseToEnglishBookMap = Object.fromEntries(
  Object.entries(englishToChineseBookMap).map(([english, chinese]) => [chinese, english])
);
const books = Object.keys(bibleData).map((englishBook) => englishToChineseBookMap[englishBook]);
const bibleIndex = {};

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(array) {
  const cloned = [...array];
  for (let i = cloned.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
  }
  return cloned;
}

function isMaskableChar(char) {
  return /[\p{L}\p{N}]/u.test(char);
}

function extractSubstrings(text, minLen, maxLen) {
  const chars = Array.from(text);
  const results = [];

  for (let len = minLen; len <= maxLen; len += 1) {
    for (let i = 0; i <= chars.length - len; i += 1) {
      const segment = chars.slice(i, i + len).join('');
      if (Array.from(segment).every(isMaskableChar)) {
        results.push(segment);
      }
    }
  }

  return results;
}

function buildChoicesForBlank(correctAnswer, chapterVerses, excludeSet) {
  const targetLen = Array.from(correctAnswer).length;
  const lengthRanges = [
    [Math.max(2, targetLen - 1), Math.min(4, targetLen + 1)],
    [2, 4]
  ];

  for (const [minLen, maxLen] of lengthRanges) {
    const candidates = new Set();

    chapterVerses.forEach((verseText) => {
      extractSubstrings(verseText, minLen, maxLen).forEach((segment) => {
        if (segment !== correctAnswer && !excludeSet.has(segment)) {
          candidates.add(segment);
        }
      });
    });

    const pool = shuffle([...candidates]);
    if (pool.length >= 2) {
      return shuffle([correctAnswer, pool[0], pool[1]]);
    }
  }

  return null;
}

function attachChoicesToVerses(verses, chapterVerses) {
  const excludeSet = new Set();
  verses.forEach((verse) => {
    verse.blanks.forEach((blank) => {
      excludeSet.add(blank.answer);
    });
  });

  return verses.map((verse) => ({
    ...verse,
    blanks: verse.blanks.map((blank) => {
      const choices = buildChoicesForBlank(blank.answer, chapterVerses, excludeSet);
      if (!choices) {
        return blank;
      }

      return { ...blank, choices };
    })
  }));
}

function buildMaskedVerse(verseText) {
  const chars = Array.from(verseText);
  const maskableIndices = chars
    .map((char, index) => (isMaskableChar(char) ? index : -1))
    .filter((index) => index !== -1);

  if (maskableIndices.length < 2) {
    return { maskedText: verseText, blanks: [] };
  }

  let targetMaskCount = Math.round(maskableIndices.length * 0.3);
  targetMaskCount = Math.max(maskableIndices.length >= 12 ? 3 : 2, targetMaskCount);
  targetMaskCount = Math.min(6, targetMaskCount, maskableIndices.length);

  const runs = [];
  let runStart = null;
  let prevIndex = null;

  maskableIndices.forEach((index) => {
    if (runStart === null) {
      runStart = index;
      prevIndex = index;
      return;
    }

    if (index === prevIndex + 1) {
      prevIndex = index;
      return;
    }

    runs.push({ start: runStart, end: prevIndex, length: prevIndex - runStart + 1 });
    runStart = index;
    prevIndex = index;
  });

  if (runStart !== null && prevIndex !== null) {
    runs.push({ start: runStart, end: prevIndex, length: prevIndex - runStart + 1 });
  }

  const segments = [];
  let remaining = targetMaskCount;

  shuffle(runs).forEach((run) => {
    if (remaining < 2 || segments.length >= 3) {
      return;
    }

    const maxLen = Math.min(run.length, remaining);
    if (maxLen < 2) {
      return;
    }

    const upperLen = Math.min(4, maxLen);
    const segmentLen = getRandomInt(2, upperLen);
    const maxStart = run.end - segmentLen + 1;
    const segmentStart = getRandomInt(run.start, maxStart);
    const segmentEnd = segmentStart + segmentLen - 1;

    const overlaps = segments.some(
      (segment) => !(segmentEnd < segment.start || segmentStart > segment.end)
    );

    if (!overlaps) {
      segments.push({ start: segmentStart, end: segmentEnd });
      remaining -= segmentLen;
    }
  });

  if (segments.length === 0) {
    return { maskedText: verseText, blanks: [] };
  }

  const orderedSegments = segments.sort((a, b) => a.start - b.start);
  const blanks = orderedSegments.map((segment, index) => ({
    id: index + 1,
    answer: chars.slice(segment.start, segment.end + 1).join('')
  }));

  let cursor = 0;
  let maskedText = '';
  orderedSegments.forEach((segment, index) => {
    maskedText += chars.slice(cursor, segment.start).join('');
    maskedText += `【(${index + 1})_____】`;
    cursor = segment.end + 1;
  });
  maskedText += chars.slice(cursor).join('');

  return { maskedText, blanks };
}

books.forEach((chineseBook) => {
  const englishBook = chineseToEnglishBookMap[chineseBook];
  const content = bibleData[englishBook]?.content || {};
  const chapterNumbers = Object.keys(content)
    .map((chapter) => Number(chapter))
    .filter((chapter) => Number.isInteger(chapter))
    .sort((a, b) => a - b);

  const chapters = {};
  chapterNumbers.forEach((chapter) => {
    const verses = Array.isArray(content[String(chapter)]) ? content[String(chapter)] : [];
    chapters[String(chapter)] = verses.length;
  });

  bibleIndex[chineseBook] = chapters;
});

function getChapterVerses(chineseBook, chapterNumber) {
  const englishBook = chineseToEnglishBookMap[chineseBook];
  if (!englishBook) {
    return null;
  }
  return bibleData[englishBook]?.content?.[String(chapterNumber)] || null;
}

router.get('/', (req, res) => {
  res.render('index', {
    title: '溫習聖經',
    message: '請選擇書卷、章與節以顯示經文。',
    books,
    bibleIndex
  });
});

router.get('/memorize', (req, res) => {
  res.render('memorize', {
    title: '聖經背誦',
    message: '請選擇書卷、章與節（可選），開始背誦練習。',
    books,
    bibleIndex
  });
});

router.get('/api/scripture', (req, res) => {
  const { book, chapter, verse } = req.query;

  if (!book || !chapter) {
    return res.status(400).json({ error: '請先選擇書卷與章。' });
  }

  const chapterNumber = Number(chapter);
  if (!Number.isInteger(chapterNumber) || chapterNumber <= 0) {
    return res.status(400).json({ error: '章數格式不正確。' });
  }

  const chapterVerses = getChapterVerses(book, chapterNumber);
  if (!Array.isArray(chapterVerses)) {
    return res.status(404).json({ error: '找不到對應的書卷或章。' });
  }

  if (verse) {
    const verseNumber = Number(verse);
    if (!Number.isInteger(verseNumber) || verseNumber <= 0 || verseNumber > chapterVerses.length) {
      return res.status(400).json({ error: '節數超出範圍。' });
    }

    return res.json({
      book,
      chapter: chapterNumber,
      verses: [{ number: verseNumber, text: chapterVerses[verseNumber - 1] }]
    });
  }

  return res.json({
    book,
    chapter: chapterNumber,
    verses: chapterVerses.map((text, index) => ({ number: index + 1, text }))
  });
});

router.get('/api/memorize', (req, res) => {
  const { book, chapter, verse, mode = 'blank' } = req.query;

  if (!book || !chapter) {
    return res.status(400).json({ error: '請先選擇書卷與章。' });
  }

  if (mode !== 'blank' && mode !== 'choice') {
    return res.status(400).json({ error: '練習模式不正確。' });
  }

  const chapterNumber = Number(chapter);
  if (!Number.isInteger(chapterNumber) || chapterNumber <= 0) {
    return res.status(400).json({ error: '章數格式不正確。' });
  }

  const chapterVerses = getChapterVerses(book, chapterNumber);
  if (!Array.isArray(chapterVerses)) {
    return res.status(404).json({ error: '找不到對應的書卷或章。' });
  }

  if (verse) {
    const verseNumber = Number(verse);
    if (!Number.isInteger(verseNumber) || verseNumber <= 0 || verseNumber > chapterVerses.length) {
      return res.status(400).json({ error: '節數超出範圍。' });
    }

    const masked = buildMaskedVerse(chapterVerses[verseNumber - 1]);
    let verses = [{ number: verseNumber, ...masked }];
    if (mode === 'choice') {
      verses = attachChoicesToVerses(verses, chapterVerses);
    }

    return res.json({
      mode,
      book,
      chapter: chapterNumber,
      verses
    });
  }

  let verses = chapterVerses.map((text, index) => ({
    number: index + 1,
    ...buildMaskedVerse(text)
  }));

  if (mode === 'choice') {
    verses = attachChoicesToVerses(verses, chapterVerses);
  }

  return res.json({
    mode,
    book,
    chapter: chapterNumber,
    verses
  });
});

module.exports = router;
