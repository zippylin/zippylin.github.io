import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const indexText = await fs.readFile(path.join(root, 'idioms-index.js'), 'utf8');
const entries = JSON.parse(indexText.match(/window\.IDIOM_INDEX\s*=\s*(\[.*\]);/s)[1]);
const sourceIds = [...new Set(entries.map(entry => String(entry.sourceId)).filter(Boolean))];
const partialPath = path.join(root, 'idioms-meanings.partial.json');
let meanings = {};
try { meanings = JSON.parse(await fs.readFile(partialPath, 'utf8')); } catch {}

function decodeHtml(value) {
  return value.replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim();
}

async function fetchMeaning(sourceId) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`https://dict.idioms.moe.edu.tw/bookView.jsp?ID=${sourceId}`, { signal: controller.signal });
      const html = await response.text();
      const match = html.match(/<h4[^>]*>\s*語義說明\s*<\/h4>\s*([^<]+)/);
      if (response.ok && match?.[1]) return decodeHtml(match[1]);
    } catch {}
    finally { clearTimeout(timer); }
  }
  return null;
}

let cursor = 0;
async function worker() {
  while (cursor < sourceIds.length) {
    const sourceId = sourceIds[cursor++];
    if (meanings[sourceId]) continue;
    const meaning = await fetchMeaning(sourceId);
    if (meaning) meanings[sourceId] = meaning;
    if (cursor % 25 === 0) {
      await fs.writeFile(partialPath, JSON.stringify(meanings), 'utf8');
      console.log(`進度 ${cursor}/${sourceIds.length}，成功 ${Object.keys(meanings).length}`);
    }
  }
}

await Promise.all(Array.from({ length: 12 }, worker));
await fs.writeFile(partialPath, JSON.stringify(meanings), 'utf8');
const output = `window.IDIOM_MEANINGS = ${JSON.stringify(meanings)};\n`;
await fs.writeFile(path.join(root, 'idioms-meanings.js'), output, 'utf8');
await fs.copyFile(path.join(root, 'idioms-meanings.js'), path.join(root, '日日成語_家人版', 'idioms-meanings.js'));
for (const htmlPath of [path.join(root, 'index.html'), path.join(root, '日日成語_家人版', 'index.html')]) {
  let html = await fs.readFile(htmlPath, 'utf8');
  if (!html.includes('window.__IDIOM_MEANINGS_EMBEDDED__')) {
    const embedded = `<script>window.__IDIOM_MEANINGS_EMBEDDED__ = true;\n${output}</script>`;
    html = html.replace('<script src="idioms-meanings.js"></script>', `<script src="idioms-meanings.js"></script>\n  ${embedded}`);
    await fs.writeFile(htmlPath, html, 'utf8');
  }
}
console.log(`完成：${sourceIds.length} 個 sourceId，成功 ${Object.keys(meanings).length}，失敗 ${sourceIds.length - Object.keys(meanings).length}`);