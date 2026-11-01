const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const dataSource = fs.readFileSync(path.join(__dirname, "..", "tang-poems-data.js"), "utf8");
const pageSource = fs.readFileSync(path.join(__dirname, "..", "tang_poems.html"), "utf8");
const context = vm.createContext({ window: {} });
vm.runInContext(dataSource, context);
const poems = context.window.TANG_POEMS;

test("the Tang poem collection contains 100 uniquely identified entries", () => {
  assert.equal(poems.length, 100);
  assert.equal(new Set(poems.map((poem) => poem.id)).size, 100);
  assert.deepEqual(Array.from(poems, (poem) => poem.number), Array.from({ length: 100 }, (_, index) => index + 1));
});

test("every poem has an author, explanation, verses, and aligned Bopomofo", () => {
  for (const poem of poems) {
    assert.ok(poem.author);
    assert.ok(poem.title);
    assert.ok(poem.meaning);
    assert.ok(poem.lines.length);
    assert.ok(poem.lines.every((line) => !["序號", "作者", "詩題", "詩歌"].includes(line.text)), `${poem.title}: PDF header leaked into verses`);
    for (const line of poem.lines) {
      const characters = Array.from(line.text);
      assert.equal(line.zhuyin.length, characters.length, `${poem.title}: annotation length`);
      characters.forEach((character, index) => {
        assert.ok(line.zhuyin[index], `${poem.title}: missing reading for ${character}`);
      });
    }
  }
});

test("the unit exposes author and keyword search, local favorites, and reading history", () => {
  assert.match(pageSource, /id="poemSearch"/);
  assert.match(pageSource, /searchableText\(poem\)/);
  assert.match(pageSource, /tang-poems-saved-v1/);
  assert.match(pageSource, /tang-poems-history-v1/);
  assert.match(pageSource, /href="index\.html"/);
});