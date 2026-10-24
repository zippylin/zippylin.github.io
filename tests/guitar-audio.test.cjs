const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const html = fs.readFileSync(path.join(__dirname, "..", "Guitar.html"), "utf8");
const audioCode = html.slice(
  html.indexOf("    function createPluckedString("),
  html.indexOf('    document.getElementById("mode-select").addEventListener')
);

function setup({ state = "suspended", resumeState = "running", resumeError, pending = false,
  supported = true, prefixed = false, audioSession = true } = {}) {
  const calls = [];
  const contexts = [];
  const timers = new Map();
  const button = { disabled: false };
  const status = { textContent: "" };
  const chord = { positions: ["x", 3, 2, 0, 1, 0] };
  let timerId = 0;
  class AudioContext {
    constructor() {
      this.state = state;
      this.sampleRate = 8000;
      this.currentTime = 1;
      this.destination = {};
      contexts.push(this);
    }
    resume() {
      calls.push("resume");
      if (resumeError) return Promise.reject(new Error(resumeError));
      if (pending) return new Promise(() => {});
      this.state = resumeState;
      return Promise.resolve();
    }
    createBuffer(channels, length) {
      return { length, getChannelData: () => new Float32Array(length) };
    }
    createBufferSource() {
      return {
        connect() { return this; },
        disconnect() {},
        start(time) { calls.push({ length: this.buffer.length, time }); },
        stop() {}
      };
    }
    createBiquadFilter() {
      return { frequency: {}, connect(node) { return node; } };
    }
    createGain() {
      return {
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect(node) { return node; }
      };
    }
  }
  const window = {
    [prefixed ? "webkitAudioContext" : "AudioContext"]: supported ? AudioContext : undefined,
    setTimeout(fn, delay) {
      timers.set(++timerId, { fn, delay });
      return timerId;
    },
    clearTimeout(id) { timers.delete(id); }
  };
  const navigator = audioSession ? { audioSession: { type: "auto" } } : {};
  const sandbox = vm.createContext({
    window, navigator, chords: [chord], numberSelect: { value: "0" },
    document: { getElementById: (id) => id === "play-chord" ? button : status }
  });
  vm.runInContext(`let audioContext;\n${audioCode}`, sandbox);
  return {
    calls, contexts, timers, button, status, navigator, chord,
    play: (...args) => sandbox.playChord(...args),
    tick(delay) {
      for (const [id, timer] of timers) {
        if (timer.delay === delay) {
          timers.delete(id);
          timer.fn();
        }
      }
    }
  };
}

test("iOS tap resumes and unlocks audio before awaiting, then strums audible strings", async () => {
  const env = setup();
  const playing = env.play();
  assert.equal(env.button.disabled, true);
  assert.equal(env.navigator.audioSession.type, "playback");
  assert.equal(env.calls[0], "resume");
  assert.equal(env.calls[1].length, 1);
  await playing;
  const notes = env.calls.filter((call) => typeof call === "object" && call.length > 1);
  assert.equal(notes.length, 5);
  notes.forEach((note, index) => assert.equal(note.time, 1.04 + index * 0.035));
  assert.equal(env.status.textContent, "正在播放和弦…");
  assert.equal([...env.timers.values()].some((timer) => timer.delay === 4000), false);
  env.tick(2300);
  assert.equal(env.status.textContent, "");
  assert.equal(env.button.disabled, false);
});

test("resumes interrupted audio after an app switch", async () => {
  const env = setup({ state: "interrupted" });
  await env.play();
  assert.equal(env.calls[0], "resume");
  assert.equal(env.status.textContent, "正在播放和弦…");
});

test("running contexts are reused without extra resume or unlock", async () => {
  const env = setup({ state: "running", audioSession: false });
  await env.play();
  env.tick(2300);
  await env.play();
  assert.equal(env.contexts.length, 1);
  assert.equal(env.calls.includes("resume"), false);
  assert.equal(env.calls.filter((call) => typeof call === "object" && call.length > 1).length, 10);
});

test("closed contexts are recreated and legacy webkitAudioContext remains supported", async () => {
  const env = setup({ prefixed: true, audioSession: false });
  await env.play();
  env.tick(2300);
  env.contexts[0].state = "closed";
  await env.play();
  assert.equal(env.contexts.length, 2);
  assert.equal(env.status.textContent, "正在播放和弦…");
});

test("progression buttons use the same audio path and their own status", async () => {
  const env = setup();
  const button = { disabled: false };
  const status = { textContent: "" };
  await env.play({ positions: [3, 2, 0, 0, 0, 3] }, button, status);
  assert.equal(env.calls.filter((call) => typeof call === "object" && call.length > 1).length, 6);
  assert.equal(status.textContent, "正在播放和弦…");
  assert.equal(env.status.textContent, "");
  env.tick(2300);
  assert.equal(button.disabled, false);
});

test("unsupported, rejected, and still-interrupted audio show errors and restore buttons", async () => {
  for (const options of [
    { supported: false },
    { resumeError: "Audio blocked" },
    { resumeState: "interrupted" }
  ]) {
    const env = setup(options);
    await env.play();
    assert.match(env.status.textContent, /^無法播放：/);
    assert.equal(env.button.disabled, false);
    assert.equal(env.calls.filter((call) => typeof call === "object" && call.length > 1).length, 0);
    assert.equal(env.timers.size, 0);
  }
});

test("a pending iOS resume times out instead of leaving playback disabled", async () => {
  const env = setup({ pending: true });
  const playing = env.play();
  env.tick(4000);
  await playing;
  assert.match(env.status.textContent, /音訊啟動逾時/);
  assert.equal(env.button.disabled, false);
  assert.equal(env.calls.filter((call) => typeof call === "object" && call.length > 1).length, 0);
  assert.equal(env.timers.size, 0);
});
