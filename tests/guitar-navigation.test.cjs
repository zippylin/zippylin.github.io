const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const html = fs.readFileSync(path.join(__dirname, "..", "Guitar.html"), "utf8");
const navigationCode = html.match(/<script id="practice-navigation">([\s\S]*?)<\/script>/)[1];
const names = ["chords", "progression", "rhythm", "right-hand", "music"];

function element(dataset = {}) {
  return {
    dataset, hidden: false, attributes: {}, listeners: {}, children: [], textContent: "",
    setAttribute(name, value) { this.attributes[name] = value; },
    removeAttribute(name) { delete this.attributes[name]; },
    addEventListener(name, callback) { this.listeners[name] = callback; },
    append(child) { this.children.push(child); },
    focus() { this.focused = true; }
  };
}

function setup(hash = "") {
  const views = names.map((practiceView) => element({ practiceView }));
  const buttons = names.map((view) => element({ view }));
  const elements = {
    "view-title": element(), "view-description": element(),
    "quick-chords": element(), "rhythm-view": views[2]
  };
  const legend = element();
  const calls = [];
  const events = {};
  const sandbox = vm.createContext({
    Object,
    chords: ["C", "G", "D", "A", "E", "Am", "Em", "Dm"].map((name) => ({ name })),
    document: {
      getElementById: (id) => elements[id],
      querySelector: () => legend,
      querySelectorAll: (selector) => selector === "[data-view]" ? buttons : views,
      createElement: () => element()
    },
    window: {
      location: { hash },
      addEventListener: (name, callback) => { events[name] = callback; }
    },
    stopRhythm: () => calls.push("stop-rhythm"),
    stopMetronome: () => calls.push("stop-metronome"),
    populateChordOptions: (name) => calls.push(["populate", name]),
    showChord: (index) => calls.push(["chord", index])
  });
  vm.runInContext(navigationCode, sandbox);
  return { sandbox, views, buttons, elements, legend, calls, events };
}

test("starts with Em and exactly one visible beginner view", () => {
  const env = setup();
  assert.equal(env.views.filter((view) => !view.hidden).length, 1);
  assert.equal(env.views[0].hidden, false);
  assert.equal(env.buttons[0].attributes["aria-current"], "page");
  assert.ok(env.calls.some((call) => Array.isArray(call) && call[0] === "populate" && call[1] === "Em"));
  assert.equal(env.elements["quick-chords"].children.length, 8);
});

test("every tool supports a direct hash and a matching section", () => {
  for (const name of names) {
    assert.ok(html.includes(`id="${name}-view" data-practice-view="${name}"`));
    const env = setup(`#${name}`);
    assert.equal(env.views.filter((view) => !view.hidden).length, 1);
    assert.equal(env.views[names.indexOf(name)].hidden, false);
    assert.equal(env.legend.hidden, name !== "chords");
  }
});

test("navigation updates the URL, heading and accessible current state", () => {
  const env = setup();
  env.buttons[4].listeners.click();
  assert.equal(env.sandbox.window.location.hash, "music");
  assert.equal(env.elements["view-title"].textContent, "留住想練的那首歌");
  assert.equal(env.elements["view-title"].focused, true);
  assert.equal(env.buttons[4].attributes["aria-current"], "page");
  assert.equal(env.buttons[0].attributes["aria-current"], undefined);
  assert.equal(env.views[4].hidden, false);
});

test("leaving rhythm stops hidden playback and hash changes restore views", () => {
  const env = setup("#rhythm");
  env.calls.length = 0;
  env.buttons[0].listeners.click();
  assert.deepEqual(env.calls, ["stop-rhythm", "stop-metronome"]);
  env.sandbox.window.location.hash = "#right-hand";
  env.events.hashchange();
  assert.equal(env.views[3].hidden, false);
  assert.equal(env.views[0].hidden, true);
});

test("quick chords resolve against the active chord collection", () => {
  const env = setup();
  const em = env.elements["quick-chords"].children[0];
  em.listeners.click();
  assert.deepEqual(env.calls.at(-1), ["chord", 6]);
  env.sandbox.chords.unshift({ name: "F" });
  em.listeners.click();
  assert.deepEqual(env.calls.at(-1), ["chord", 7]);
});

test("unrecognised hashes safely open the beginner view", () => {
  for (const hash of ["#missing", "#toString", "#__proto__"]) {
    const env = setup(hash);
    assert.equal(env.views[0].hidden, false);
    assert.equal(env.views.filter((view) => !view.hidden).length, 1);
  }
});

for (const kind of ["metronome", "rhythm"]) {
  for (const rejectAudio of [false, true]) {
    test(`${kind} cannot restart after leaving while audio is ${rejectAudio ? "failing" : "starting"}`, async () => {
      let finishAudio;
      const pendingAudio = new Promise((resolve, reject) => {
        finishAudio = () => rejectAudio ? reject(new Error("Audio unavailable")) : resolve({});
      });
      const nodes = new Map();
      const getElementById = (id) => {
        if (!nodes.has(id)) nodes.set(id, { disabled: id.startsWith("stop-"), value: "1", checked: false });
        return nodes.get(id);
      };
      const code = kind === "metronome"
        ? html.slice(html.indexOf("    async function startMetronome()"), html.indexOf("    function scheduleRhythmBar("))
        : html.slice(html.indexOf("    async function playRhythm()"), html.indexOf('    document.getElementById("mode-select").addEventListener'));
      const sandbox = vm.createContext({
        document: { getElementById },
        window: { clearInterval() {}, clearTimeout() {}, setInterval() { assert.fail("Cancelled audio scheduled playback"); } },
        prepareAudio: () => pendingAudio,
        clearMetronomeVisualTimers() {},
        rhythmRows: [[]], rhythmSources: [],
        metronomeStartRequest: 0, rhythmStartRequest: 0,
        metronomeTimer: undefined, rhythmEndTimer: undefined,
        rhythmCountInTimer: undefined, rhythmPlaybackTimer: undefined
      });
      vm.runInContext(code, sandbox);
      const playback = kind === "metronome" ? sandbox.startMetronome() : sandbox.playRhythm();
      if (kind === "metronome") sandbox.stopMetronome();
      else sandbox.stopRhythm();
      finishAudio();
      await playback;
      const startId = kind === "metronome" ? "start-metronome" : "play-rhythm";
      const statusId = kind === "metronome" ? "metronome-status" : "rhythm-status";
      assert.equal(getElementById(startId).disabled, false);
      assert.equal(getElementById(`stop-${kind}`).disabled, true);
      assert.equal(getElementById(statusId).textContent, kind === "metronome" ? "節拍器已停止。" : "已停止。");
    });
  }
}
