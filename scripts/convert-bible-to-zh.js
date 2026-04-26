const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '../data/bible.json');
const outputPath = path.join(__dirname, '../data/bible_zh.json');

const bookNameMap = {
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

const bibleData = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
const output = {};

Object.entries(bibleData).forEach(([englishName, value]) => {
  const chineseName = bookNameMap[englishName];
  if (!chineseName) {
    throw new Error(`Missing Chinese mapping for key: ${englishName}`);
  }
  output[chineseName] = value;
});

fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
console.log(`Converted file written to ${outputPath}`);
