import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const indexText = await fs.readFile(path.join(root, 'idioms-index.js'), 'utf8');
const entries = JSON.parse(indexText.match(/window\.IDIOM_INDEX\s*=\s*(\[.*\]);/s)[1]);
const sourceIds = [...new Set(entries.map(entry => String(entry.sourceId)).filter(Boolean))];
const partialPath = path.join(root, 'idioms-examples.partial.json');
let examples = {};
try { examples = JSON.parse(await fs.readFile(partialPath, 'utf8')); } catch {}

function decodeHtml(value) {
  return value.replace(/<[^>]+>/g, ' ').replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim();
}

function extractExample(html) {
  const sections = [...html.matchAll(/<h4[^>]*>\s*例句\s*<\/h4>([\s\S]*?)(?=<h4|<\/section|<h3|$)/gi)];
  for (const section of sections) {
    const item = section[1].match(/<li[^>]*>([\s\S]*?)<\/li>/i);
    if (item) return decodeHtml(item[1]).replace(/^\d+\.\s*/, '');
  }
  return null;
}

async function fetchExample(sourceId) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`https://dict.idioms.moe.edu.tw/bookView.jsp?ID=${sourceId}`, { signal: controller.signal });
      if (!response.ok) continue;
      const example = extractExample(await response.text());
      if (example) return example;
    } catch {} finally { clearTimeout(timer); }
  }
  return null;
}

let cursor = 0;
async function worker() {
  while (cursor < sourceIds.length) {
    const sourceId = sourceIds[cursor++];
    if (examples[sourceId]) continue;
    const example = await fetchExample(sourceId);
    if (example) examples[sourceId] = example;
    if (cursor % 25 === 0) {
      await fs.writeFile(partialPath, JSON.stringify(examples), 'utf8');
      console.log(`進度 ${cursor}/${sourceIds.length}，取得例句 ${Object.keys(examples).length}`);
    }
  }
}

await Promise.all(Array.from({ length: 8 }, worker));
await fs.writeFile(partialPath, JSON.stringify(examples), 'utf8');
const examplesById = Object.fromEntries(entries.flatMap(entry => {
  const example = examples[String(entry.sourceId)];
  return example ? [[String(entry.id), example]] : [];
}));
const output = `window.IDIOM_EXAMPLES = ${JSON.stringify(examplesById)};\n`;
await fs.writeFile(path.join(root, 'idioms-examples.js'), output, 'utf8');
await fs.copyFile(path.join(root, 'idioms-examples.js'), path.join(root, '日日成語_家人版', 'idioms-examples.js'));
console.log(`完成：${sourceIds.length} 個 sourceId，取得官方例句 ${Object.keys(examples).length}，展開至 ${Object.keys(examplesById).length} 個索引項目`);