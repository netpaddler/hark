import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

class Node {
  constructor() {
    this.parentNode = null;
    this.childNodes = [];
    this.nodeType = 1;
  }

  append(...nodes) {
    for (let node of nodes) {
      if (node == null || node === false) continue;
      if (typeof node === "string" || typeof node === "number") node = new Text(String(node));
      if (node.parentNode) node.parentNode.removeChild(node);
      node.parentNode = this;
      this.childNodes.push(node);
    }
  }

  removeChild(node) {
    this.childNodes = this.childNodes.filter((child) => child !== node);
    node.parentNode = null;
  }

  remove() {
    if (this.parentNode) this.parentNode.removeChild(this);
  }

  get textContent() {
    return this.childNodes.map((child) => child.textContent || "").join("");
  }

  set textContent(value) {
    this.childNodes = [];
    if (value != null && value !== "") this.append(new Text(String(value)));
  }
}

class Text extends Node {
  constructor(value) {
    super();
    this.nodeType = 3;
    this.data = String(value);
  }

  get textContent() {
    return this.data;
  }
}

class ClassList {
  constructor(element) {
    this.element = element;
  }

  add(...names) {
    for (const name of names) if (name) this.element.classes.add(name);
  }

  remove(...names) {
    for (const name of names) this.element.classes.delete(name);
  }

  contains(name) {
    return this.element.classes.has(name);
  }

  toggle(name, force) {
    const next = force == null ? !this.contains(name) : Boolean(force);
    if (next) this.add(name);
    else this.remove(name);
    return next;
  }
}

class Element extends Node {
  constructor(tag) {
    super();
    this.tagName = String(tag).toUpperCase();
    this.attrs = {};
    this.classes = new Set();
    this.classList = new ClassList(this);
    this.dataset = {};
    this.style = { setProperty() {} };
    this.listeners = {};
    this.hidden = false;
    this.value = "";
    this.tabIndex = 0;
    this.id = "";
    this.offsetHeight = 40;
  }

  set className(value) {
    this.classes = new Set(String(value).split(/\s+/).filter(Boolean));
  }

  get className() {
    return [...this.classes].join(" ");
  }

  set href(value) {
    this.setAttribute("href", value);
  }

  get href() {
    return this.attrs.href || "";
  }

  setAttribute(name, value) {
    this.attrs[name] = String(value);
    if (name === "id") this.id = String(value);
    if (name === "class") this.className = String(value);
    if (name.startsWith("data-")) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      this.dataset[key] = String(value);
    }
  }

  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null;
  }

  removeAttribute(name) {
    delete this.attrs[name];
  }

  addEventListener(type, fn) {
    (this.listeners[type] || (this.listeners[type] = [])).push(fn);
  }

  dispatchEvent(event) {
    for (const fn of this.listeners[event.type] || []) fn(event);
  }

  click() {
    this.dispatchEvent({
      type: "click",
      target: this,
      currentTarget: this,
      preventDefault() {},
      stopPropagation() {},
    });
  }

  getBoundingClientRect() {
    return { top: 120, left: 16, width: 340, height: 191, right: 356, bottom: 311 };
  }

  closest(selector) {
    let node = this;
    while (node && node.nodeType === 1) {
      if (selector.startsWith("#") && node.id === selector.slice(1)) return node;
      if (selector.startsWith(".") && node.classes && node.classes.has(selector.slice(1))) return node;
      node = node.parentNode;
    }
    return null;
  }

  setPointerCapture(id) {
    this.captured = id;
    this.captureLog = this.captureLog || [];
    this.captureLog.push(["set", id]);
  }

  hasPointerCapture(id) {
    return this.captured === id;
  }

  releasePointerCapture(id) {
    this.captureLog = this.captureLog || [];
    if (this.captured !== id) return;
    this.captured = null;
    this.captureLog.push(["release", id]);
    for (const fn of this.listeners.lostpointercapture || []) {
      fn({ type: "lostpointercapture", pointerId: id, target: this });
    }
  }

  focus() {}

  scrollIntoView() {}

  insertBefore(node, before) {
    if (node.parentNode) node.parentNode.removeChild(node);
    node.parentNode = this;
    const index = this.childNodes.indexOf(before);
    if (index < 0) this.childNodes.push(node);
    else this.childNodes.splice(index, 0, node);
  }

  before(...nodes) {
    if (!this.parentNode) return;
    const parent = this.parentNode;
    for (const node of nodes) {
      if (node.parentNode) node.parentNode.removeChild(node);
      node.parentNode = parent;
      // Looked up after the removal, as a node already in this parent shifts the rest.
      parent.childNodes.splice(parent.childNodes.indexOf(this), 0, node);
    }
  }

  get nextElementSibling() {
    if (!this.parentNode) return null;
    const siblings = this.parentNode.childNodes.filter((node) => node.nodeType === 1);
    const index = siblings.indexOf(this);
    return index >= 0 && index + 1 < siblings.length ? siblings[index + 1] : null;
  }

  get previousElementSibling() {
    if (!this.parentNode) return null;
    const siblings = this.parentNode.childNodes.filter((node) => node.nodeType === 1);
    const index = siblings.indexOf(this);
    return index > 0 ? siblings[index - 1] : null;
  }

  contains(node) {
    let current = node;
    while (current) {
      if (current === this) return true;
      current = current.parentNode;
    }
    return false;
  }

  querySelector(selector) {
    return queryAll(this, selector, true)[0] || null;
  }

  querySelectorAll(selector) {
    return queryAll(this, selector, false);
  }

  replaceChildren(...nodes) {
    for (const child of [...this.childNodes]) child.parentNode = null;
    this.childNodes = [];
    this.append(...nodes);
  }
}

function matches(element, selector) {
  if (!element || element.nodeType !== 1) return false;
  if (selector.startsWith(".")) return element.classes.has(selector.slice(1));
  if (selector.startsWith("#")) return element.id === selector.slice(1);
  const slot = /^\[data-slot="([^"]+)"\]$/.exec(selector);
  if (slot) return element.dataset.slot === slot[1];
  const tagged = /^([a-z0-9]+)\.([A-Za-z0-9_-]+)$/.exec(selector);
  if (tagged) return element.tagName === tagged[1].toUpperCase() && element.classes.has(tagged[2]);
  if (/^[a-z0-9]+$/i.test(selector)) return element.tagName === selector.toUpperCase();
  return false;
}

function queryAll(root, selector, one) {
  if (selector.startsWith(":scope > .")) {
    const name = selector.slice(":scope > .".length);
    const found = root.childNodes.filter((node) => node.nodeType === 1 && node.classes.has(name));
    return one ? found.slice(0, 1) : found;
  }
  const found = [];
  const walk = (node) => {
    for (const child of node.childNodes || []) {
      if (matches(child, selector)) {
        found.push(child);
        if (one) return;
      }
      walk(child);
      if (one && found.length) return;
    }
  };
  walk(root);
  return found;
}

class DocumentRoot extends Element {
  constructor() {
    super("document");
    this.documentElement = new Element("html");
    this.head = new Element("head");
    this.body = new Element("body");
    this.title = "";
    this.append(this.documentElement);
    this.documentElement.append(this.head, this.body);
    this.documentElement.dataset.entry = "hymns";
    this.documentElement.dataset.theme = "light";
    this.documentElement.dataset.themeChoice = "set";
  }

  createElement(tag) {
    return new Element(tag);
  }

  createElementNS(_namespace, tag) {
    return new Element(tag);
  }

  createTextNode(text) {
    return new Text(text);
  }

  getElementById(id) {
    return this.querySelector(`#${id}`);
  }
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

test("navigation leaves the same player playing", async () => {
  const document = new DocumentRoot();
  const ids = [
    "home-bar",
    "hymn-bar",
    "main",
    "search-form",
    "q",
    "clear",
    "chips",
    "tabs",
    "count",
    "count-row",
    "jump-bubble",
    "theme-home",
    "theme-hymn",
    "tab-number",
    "tab-title",
    "tab-author",
    "tab-liked",
    "tab-themes",
    "tab-sins",
    "tab-requests",
    "back-link",
    "prev-link",
    "next-link",
    "pager-num",
    "theme-color",
    "install-link",
    "install-help",
    "notify-link",
  ];
  for (const id of ids) {
    const node = document.createElement("div");
    node.setAttribute("id", id);
    (id === "theme-color" ? document.head : document.body).append(node);
  }
  const bar = document.createElement("div");
  bar.setAttribute("id", "song-bar");
  bar.hidden = true;
  const video = document.createElement("div");
  video.className = "song-bar-video";
  video.setAttribute("id", "song-stage");
  const host = document.createElement("div");
  host.setAttribute("id", "song-player-host");
  video.append(host);
  for (const id of ["song-bar-title", "song-toggle", "song-keep", "song-prev", "song-next", "song-stop"]) {
    const control = document.createElement("button");
    control.setAttribute("id", id);
    bar.append(control);
  }
  bar.append(video);
  document.body.append(bar);

  const location = { hash: "#/", origin: "http://localhost", href: "http://localhost/" };
  const windowListeners = {};
  const windowStub = {
    document,
    location,
    history: { scrollRestoration: "auto" },
    navigator: { userAgent: "node", platform: "test" },
    scrollY: 0,
    innerWidth: 390,
    innerHeight: 844,
    scrollTo() {},
    addEventListener(type, fn) {
      (windowListeners[type] || (windowListeners[type] = [])).push(fn);
    },
    matchMedia() {
      return { matches: false, addEventListener() {} };
    },
    requestAnimationFrame(fn) {
      fn();
      return 0;
    },
    setInterval() {
      return 1;
    },
    clearInterval() {},
    setTimeout() {
      return 1;
    },
    clearTimeout() {},
  };
  const session = {
    metadata: null,
    playbackState: "none",
    handlers: {},
    setActionHandler(name, fn) {
      this.handlers[name] = fn;
    },
  };
  class FakePlayer {
    constructor(_hostId, config) {
      FakePlayer.instances.push(this);
      this.calls = [];
      this.host = host;
      config.events.onReady();
    }

    loadVideoById() {
      this.calls.push("load");
    }

    pauseVideo() {
      this.calls.push("pause");
    }

    playVideo() {
      this.calls.push("play");
    }

    stopVideo() {
      this.calls.push("stop");
    }

    getCurrentTime() {
      return 0;
    }

    getPlayerState() {
      return 1;
    }
  }
  FakePlayer.instances = [];

  globalThis.document = document;
  globalThis.window = windowStub;
  globalThis.location = location;
  globalThis.history = windowStub.history;
  globalThis.localStorage = memoryStorage();
  globalThis.sessionStorage = memoryStorage();
  globalThis.Node = Node;
  globalThis.MediaMetadata = class MediaMetadata {
    constructor(data) {
      Object.assign(this, data);
    }
  };
  globalThis.matchMedia = windowStub.matchMedia;
  globalThis.requestAnimationFrame = windowStub.requestAnimationFrame;
  windowStub.navigator.mediaSession = session;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    writable: true,
    value: windowStub.navigator,
  });
  globalThis.window.YT = { Player: FakePlayer };
  globalThis.fetch = async (input) => {
    const href = String(typeof input === "string" ? input : input.url || input.href || input);
    if (!href.startsWith("file:")) return { ok: false, status: 404, json: async () => null, text: async () => "" };
    const text = readFileSync(fileURLToPath(href), "utf8");
    return { ok: true, status: 200, json: async () => JSON.parse(text), text: async () => text };
  };

  await import("../app.js");
  const started = Date.now();
  while (!document.querySelector(".play-song")) {
    if (Date.now() - started > 3000) {
      assert.fail(`song list did not render: ${document.getElementById("main").textContent}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  document.querySelector(".play-song").click();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(FakePlayer.instances.length, 1);
  assert.equal(document.getElementById("song-player-host"), host);
  assert.equal(document.getElementById("song-bar").hidden, false);
  assert.equal(session.metadata.artist, "Faith Presbyterian Church Tacoma");
  assert.match(session.metadata.title, /^\d+\. /);
  assert.equal(typeof session.handlers.play, "function");
  assert.equal(typeof session.handlers.pause, "function");
  assert.equal(typeof session.handlers.nexttrack, "function");

  const go = async (hash) => {
    location.hash = hash;
    for (const fn of windowListeners.hashchange || []) fn();
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  for (const hash of ["#/themes", "#/theme/advent", "#/title", "#/hymn/86", "#/welcome", "#/sins", "#/requests", "#/whats-new", "#/"]) {
    await go(hash);
    assert.equal(FakePlayer.instances.length, 1, hash);
    assert.equal(document.getElementById("song-player-host"), host, hash);
    assert.equal(host.parentNode.className, "song-bar-video", hash);
    assert.equal(document.getElementById("song-bar").hidden, false, hash);
    assert.equal(document.documentElement.dataset.player, "on", hash);
  }

  const search = document.getElementById("q");
  search.value = "grace";
  search.dispatchEvent({ type: "input", target: search });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(FakePlayer.instances.length, 1);
  assert.equal(document.getElementById("song-player-host"), host);
  assert.equal(document.querySelectorAll(".play-all").length, 1);

  const player = FakePlayer.instances[0];
  assert.deepEqual(player.calls.filter((call) => call === "pause" || call === "stop"), []);
  session.handlers.nexttrack();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(FakePlayer.instances.length, 1);
  assert.deepEqual(player.calls.filter((call) => call === "pause" || call === "stop"), []);
  assert.ok(player.calls.includes("load"));

  const playingNumber = Number(String(session.metadata.title).split(".")[0]);
  // Opening the playing song's page leaves the same player node in place.
  location.hash = `#/hymn/${playingNumber}`;
  for (const fn of windowListeners.hashchange || []) fn();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(document.querySelector(".text"));
  assert.ok(document.querySelector(".stanza-num"));
  assert.equal(document.getElementById("song-dock"), null);
  assert.equal(host.parentNode, video);
  const beforeFollow = location.hash;
  session.handlers.nexttrack();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.notEqual(location.hash, beforeFollow);
  assert.match(location.hash, /^#\/hymn\/\d+$/);
  for (const fn of windowListeners.hashchange || []) fn();
  await new Promise((resolve) => setTimeout(resolve, 0));
  // The next song can be one with no stored stanzas (copyrighted, or words
  // still to come), which shows a notice in place of numbered stanzas.
  assert.ok(document.querySelector(".stanza-num") || document.querySelector(".notice"), location.hash);
  assert.equal(document.getElementById("song-player-host"), host);
  assert.equal(host.parentNode, video);
  assert.equal(FakePlayer.instances.length, 1);
  assert.deepEqual(player.calls.filter((call) => call === "pause" || call === "stop"), []);

  document.getElementById("song-stop").click();
  assert.equal(document.getElementById("song-bar").hidden, true);
  assert.equal(document.documentElement.dataset.player, "off");
  assert.ok(player.calls.includes("stop"));
  assert.equal(host.parentNode, video);

  const source = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.equal(/new Audio\(/.test(source), false);
  assert.equal(/HTMLAudioElement/.test(source), false);
  assert.match(source, /Faith Presbyterian Church Tacoma/);
  assert.match(source, /holdPlayer\(\)/);
});
