import { INSTALL_URL, installGuide } from "./install.js";
import {
  attributionParts,
  browse,
  faithRecordings,
  filterHymns,
  isWithheld,
  wordsPending,
  listRecordings,
  listSections,
  neighbors,
  partialNote,
  stanzaPlan,
  themeOutline,
  themesForHymn,
  findTheme,
  hymnsInTheme,
  tuneCaution,
  listSermons,
  formatRecordingDate,
  youtubeBlock,
} from "./hymn-model.js";
import { requestConfig, requestsOpen } from "./config/requests.js";

const homeBar = document.getElementById("home-bar");
const hymnBar = document.getElementById("hymn-bar");
const main = document.getElementById("main");
const searchForm = document.getElementById("search-form");
const queryInput = document.getElementById("q");
const clearButton = document.getElementById("clear");
const chips = document.getElementById("chips");
const tabs = document.getElementById("tabs");
const count = document.getElementById("count");
const bubble = document.getElementById("jump-bubble");
const themeButtons = [
  document.getElementById("theme-home"),
  document.getElementById("theme-hymn"),
];

const TAB_IDS = [
  ["tab-number", "number"],
  ["tab-title", "title"],
  ["tab-author", "author"],
  ["tab-themes", "themes"],
  ["tab-sins", "sins"],
  ["tab-requests", "requests"],
];

const scrollMemory = { number: 0, title: 0, author: 0, themes: 0, sins: 0, requests: 0 };
let hymns = [];
let recordingCatalog = {};
let themeCatalog = { seasons: [], topics: [], hymns: {} };
let sinsCatalog = null;
let sermonCatalog = { page: [], groups: {} };
let musicCatalog = { scores: {}, omitted: {} };
let section = "all";
let activeIndex = null;
let ready = false;
let bubbleTimer = 0;
let lastJump = "";

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) node.setAttribute(key, "");
    else node.setAttribute(key, String(value));
  }
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function icon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.classList.add("icon");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.8");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  const paths = {
    moon: "M20 14.5A8 8 0 0 1 9.5 4 7 7 0 1 0 20 14.5z",
    sun: "M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4",
    back: "M15 5 8 12l7 7",
    prev: "M14.5 5.5 8 12l6.5 6.5",
    next: "M9.5 5.5 16 12l-6.5 6.5",
    close: "M7 7l10 10M17 7 7 17",
  };
  path.setAttribute("d", paths[name]);
  svg.append(path);
  if (name === "sun") {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", "12");
    circle.setAttribute("cy", "12");
    circle.setAttribute("r", "3.2");
    circle.setAttribute("fill", "none");
    circle.setAttribute("stroke", "currentColor");
    circle.setAttribute("stroke-width", "1.8");
    svg.append(circle);
  }
  return svg;
}

function appliedTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function syncTheme() {
  const dark = appliedTheme() === "dark";
  for (const button of themeButtons) {
    button.replaceChildren(icon(dark ? "sun" : "moon"));
    button.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
    button.setAttribute("aria-pressed", dark ? "true" : "false");
  }
  const color = dark ? "#141210" : "#f3eee4";
  const meta = document.getElementById("theme-color");
  if (meta) meta.setAttribute("content", color);
}

function toggleTheme() {
  const next = appliedTheme() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  document.documentElement.dataset.themeChoice = "set";
  try {
    localStorage.setItem("hark-theme", next);
  } catch {
    /* ignore private mode */
  }
  syncTheme();
}

function route() {
  const path = (location.hash || "#/").replace(/^#/, "").split("?")[0] || "/";
  if (path === "/" || path === "/number") return { view: "index", index: "number" };
  if (path === "/title") return { view: "index", index: "title" };
  if (path === "/author") return { view: "index", index: "author" };
  if (path === "/themes") return { view: "themes" };
  if (path === "/sins") return { view: "sins" };
  if (path === "/comments") {
    location.replace("#/requests");
    return { view: "requests" };
  }
  if (path === "/requests") return { view: "requests" };
  if (path === "/install") return { view: "install" };
  const themeMatch = path.match(/^\/theme\/([a-z0-9-]+)\/?$/);
  if (themeMatch) return { view: "theme", id: themeMatch[1] };
  const match = path.match(/^\/hymn\/(\d+)\/?$/);
  if (match) return { view: "hymn", number: Number(match[1]) };
  return { view: "index", index: "number" };
}

function indexHref(index) {
  if (index === "title") return "#/title";
  if (index === "author") return "#/author";
  if (index === "themes") return "#/themes";
  if (index === "sins") return "#/sins";
  if (index === "comments" || index === "requests") return "#/requests";
  if (typeof index === "string" && index.startsWith("theme:")) return `#/theme/${index.slice(6)}`;
  return "#/";
}

function rememberScroll() {
  if (activeIndex) scrollMemory[activeIndex] = window.scrollY;
}

function storedIndex() {
  try {
    const stored = sessionStorage.getItem("hark-index");
    if (stored === "comments") return "requests";
    if (
      stored === "title" ||
      stored === "author" ||
      stored === "number" ||
      stored === "themes" ||
      stored === "sins" ||
      stored === "requests"
    ) {
      return stored;
    }
    if (/^theme:[a-z0-9-]+$/.test(stored || "")) return stored;
  } catch {
    /* ignore */
  }
  return "number";
}

function saveIndex(index) {
  try {
    sessionStorage.setItem("hark-index", index);
  } catch {
    /* ignore */
  }
}

function syncSticky() {
  const bar = hymnBar.hidden ? homeBar : hymnBar;
  document.documentElement.style.setProperty("--sticky-h", `${bar.offsetHeight}px`);
}

function countLabel(total) {
  return total === 1 ? "1 hymn" : `${total} hymns`;
}

function syncTabs(index) {
  const selectedName = typeof index === "string" && index.startsWith("theme") ? "themes" : index;
  for (const [id, name] of TAB_IDS) {
    const button = document.getElementById(id);
    const selected = name === selectedName;
    button.setAttribute("aria-selected", selected ? "true" : "false");
    button.tabIndex = selected ? 0 : -1;
    if (selected) button.scrollIntoView({ inline: "nearest", block: "nearest" });
  }
}

function syncChips() {
  for (const button of chips.querySelectorAll(".chip")) {
    button.setAttribute("aria-pressed", button.dataset.section === section ? "true" : "false");
  }
}

function buildChips() {
  chips.replaceChildren();
  const names = ["all", ...listSections(hymns)];
  for (const name of names) {
    const button = el(
      "button",
      {
        type: "button",
        class: "chip",
        "aria-pressed": name === section ? "true" : "false",
      },
      name === "all" ? "All" : name,
    );
    button.dataset.section = name;
    button.addEventListener("click", () => {
      section = name;
      syncChips();
      if (activeIndex) scrollMemory[activeIndex] = 0;
      render();
    });
    chips.append(button);
  }
}

function hymnRow(hymn, mark) {
  const link = el("a", { class: "hymn-link", href: `#/hymn/${hymn.number}` });
  link.append(el("span", { class: "num" }, String(hymn.number)));
  const text = el("span", { class: "hymn-link-text" });
  const title = el("span", { class: "title" }, hymn.title);
  if (mark) title.append(el("span", { class: "badge" }, mark));
  text.append(title);
  const meta = [hymn.tune, hymn.section].filter(Boolean).join(" · ");
  if (meta) text.append(el("span", { class: "meta" }, meta));
  link.append(text);
  return el("li", {}, link);
}

function numberList(list) {
  return el(
    "ul",
    { class: "hymn-list" },
    list.map((hymn) => hymnRow(hymn)),
  );
}

function titleList(letters) {
  const root = el("div", { class: "index" });
  for (const bucket of letters) {
    root.append(el("h2", { class: "letter", id: `letter-${bucket.letter}` }, bucket.letter));
    const items = bucket.hymns.map((hymn) => {
      const link = el("a", { class: "toc-link", href: `#/hymn/${hymn.number}` });
      const text = el("span", { class: "toc-text" });
      text.append(el("span", { class: "toc-title" }, hymn.title));
      if (hymn.tune) text.append(el("span", { class: "toc-tune" }, hymn.tune));
      link.append(text, el("span", { class: "toc-num" }, String(hymn.number)));
      return el("li", {}, link);
    });
    root.append(el("ul", { class: "toc-list" }, items));
  }
  return root;
}

function authorList(letters) {
  const root = el("div", { class: "index" });
  for (const bucket of letters) {
    root.append(el("h2", { class: "letter", id: `letter-${bucket.letter}` }, bucket.letter));
    for (const group of bucket.groups) {
      const block = el("section", { class: "author-group" });
      block.append(el("h3", { class: "author-name" }, group.label));
      block.append(
        el(
          "ul",
          { class: "hymn-list" },
          group.hymns.map((item) => hymnRow(item.hymn, item.mark)),
        ),
      );
      root.append(block);
    }
  }
  return root;
}

function nearestLetter(letter) {
  const code = letter.charCodeAt(0);
  for (let step = 1; step < 26; step += 1) {
    for (const next of [code + step, code - step]) {
      if (next < 65 || next > 90) continue;
      const target = document.getElementById(`letter-${String.fromCharCode(next)}`);
      if (target) return target;
    }
  }
  return null;
}

function showBubble(letter) {
  bubble.textContent = letter;
  bubble.hidden = false;
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => {
    bubble.hidden = true;
  }, 420);
}

function jumpTo(letter) {
  const target = document.getElementById(`letter-${letter}`) || nearestLetter(letter);
  if (!target) return;
  const shown = target.id.replace("letter-", "");
  if (shown === lastJump) return;
  lastJump = shown;
  target.scrollIntoView({ block: "start" });
  showBubble(shown);
}

function jumpBar(letters) {
  const present = new Set(letters.map((bucket) => bucket.letter));
  const nav = el("nav", { class: "jump", "aria-label": "Jump to a letter" });
  for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    const button = el("button", { type: "button" }, letter);
    button.dataset.letter = letter;
    if (!present.has(letter)) {
      button.setAttribute("aria-disabled", "true");
      button.tabIndex = -1;
      button.setAttribute("aria-label", `No entries for ${letter}`);
    } else {
      button.setAttribute("aria-label", `Jump to ${letter}`);
    }
    nav.append(button);
  }

  const buttons = [...nav.querySelectorAll("button")];
  const pick = (clientY) => {
    const rect = nav.getBoundingClientRect();
    if (rect.height <= 0) return null;
    const ratio = (clientY - rect.top) / rect.height;
    const index = Math.min(buttons.length - 1, Math.max(0, Math.floor(ratio * buttons.length)));
    return buttons[index];
  };
  let dragging = false;
  nav.addEventListener("pointerdown", (event) => {
    if (event.button != null && event.button !== 0) return;
    dragging = true;
    lastJump = "";
    nav.setPointerCapture(event.pointerId);
    event.preventDefault();
    const button = pick(event.clientY);
    if (button) jumpTo(button.dataset.letter);
  });
  nav.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const button = pick(event.clientY);
    if (button) jumpTo(button.dataset.letter);
  });
  const end = () => {
    dragging = false;
    lastJump = "";
  };
  nav.addEventListener("pointerup", end);
  nav.addEventListener("pointercancel", end);
  nav.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button || button.disabled) return;
    lastJump = "";
    jumpTo(button.dataset.letter);
  });
  return nav;
}

function themeHymnList(list) {
  return el(
    "ul",
    { class: "hymn-list" },
    list.map((hymn) => hymnRow(hymn)),
  );
}

function themeGroup(group, open) {
  const details = el("details", {
    class: "theme-group",
    id: `theme-${group.id}`,
    open: open ? true : null,
  });
  const summary = el("summary", {});
  summary.append(
    el("span", { class: "theme-name" }, group.title),
    el("span", { class: "theme-count" }, countLabel(group.hymns.length)),
  );
  details.append(summary, themeHymnList(group.hymns));
  return details;
}

function themeJump(groups) {
  const row = el("div", { class: "theme-jumps" });
  for (const group of groups) {
    const button = el("button", { type: "button" }, group.title);
    button.addEventListener("click", () => {
      const node = document.getElementById(`theme-${group.id}`);
      if (!node) return;
      if (node.tagName === "DETAILS") node.open = true;
      node.scrollIntoView({ block: "start" });
    });
    row.append(button);
  }
  return row;
}

function setBrowseChrome(shown, options = {}) {
  searchForm.hidden = !shown;
  chips.hidden = !shown;
  count.hidden = !shown;
  tabs.hidden = Boolean(options.hideTabs);
}

function scriptureBlock(reference, lines) {
  const block = el("blockquote", { class: "scripture" });
  if (reference) block.append(el("p", { class: "scripture-ref" }, reference));
  for (const line of lines || []) {
    if (line) block.append(el("p", {}, line));
  }
  return block;
}

function catechismBlock(item) {
  const block = el("blockquote", { class: "catechism" });
  block.append(el("p", { class: "scripture-ref" }, `Westminster Shorter Catechism, Q. ${item.number}`));
  block.append(el("p", { class: "catechism-q" }, item.question));
  block.append(el("p", {}, item.answer));
  return block;
}

function hymnLinks(numbers) {
  if (!Array.isArray(numbers) || numbers.length === 0) return null;
  const byNumber = new Map(hymns.map((hymn) => [hymn.number, hymn]));
  const items = [];
  for (const number of numbers) {
    const hymn = byNumber.get(number);
    if (hymn) items.push(hymnRow(hymn));
  }
  if (items.length === 0) return null;
  const wrap = el("div", { class: "sin-hymns" });
  wrap.append(el("h3", {}, "Hymns"));
  wrap.append(el("ul", { class: "hymn-list" }, items));
  return wrap;
}

const SERMON_KEYS = {
  commandments: "ten-commandments",
  flesh: "works-of-the-flesh",
  hates: "proverbs-6",
  "heart-tongue": "heart-and-tongue",
};

const STOP_IT_URL = "https://www.youtube.com/watch?v=aAhA7KfbJgg";

function groupSermons(id) {
  return listSermons(sermonCatalog, SERMON_KEYS[id] || id);
}

function sermonBlock(items) {
  if (!items || items.length === 0) return null;
  const box = el("section", { class: "sermons" });
  box.append(el("h3", {}, "Hear a sermon on this from Faith Presbyterian"));
  for (const item of items) {
    const card = el("div", { class: "sermon" });
    const meta = [item.date, item.preacher].filter(Boolean).join(" · ");
    if (meta) card.append(el("p", { class: "sermon-meta" }, meta));
    card.append(el("p", { class: "sermon-title" }, item.title));
    if (item.text) card.append(el("p", { class: "sermon-text" }, item.text));
    const player = item.youtube ? mountYoutube(item) : null;
    if (player) card.append(player);
    if (item.embeddable !== false) {
      card.append(
        el(
          "a",
          { class: "faith-link", href: item.url, target: "_blank", rel: "noopener noreferrer" },
          item.youtube ? "Play on YouTube" : "Open the sermon",
        ),
      );
    }
    box.append(card);
  }
  return box;
}

function stopItCard() {
  const card = el("aside", { class: "stop-it", id: "stop-it" });
  const line = el("p", {});
  line.append("Bob Newhart's famous counseling advice: ");
  line.append(
    el(
      "a",
      { href: STOP_IT_URL, target: "_blank", rel: "noopener noreferrer" },
      "Stop It!",
    ),
  );
  card.append(line);
  return card;
}

function commandmentItem(item) {
  const details = el("details", { class: "sin-item", id: `sin-${item.id}` });
  details.append(el("summary", {}, item.title));
  details.append(scriptureBlock(item.reference, item.scripture));
  if (item.catechism) details.append(catechismBlock(item.catechism));
  const hymns = hymnLinks(item.hymns);
  if (hymns) details.append(hymns);
  return details;
}

function sinPart(part) {
  const block = el("section", { class: "sin-part", id: `sin-${part.id}` });
  block.append(el("h3", {}, part.title));
  block.append(scriptureBlock(part.reference, part.scripture));
  const hymns = hymnLinks(part.hymns);
  if (hymns) block.append(hymns);
  return block;
}

function sinGroup(group, open) {
  const details = el("details", {
    class: "sin-group theme-group",
    id: `sin-${group.id}`,
    open: open ? true : null,
  });
  const summary = el("summary", {});
  summary.append(
    el("span", { class: "theme-name" }, group.title),
    group.reference ? el("span", { class: "theme-count" }, group.reference) : "",
  );
  details.append(summary);
  const sermons = sermonBlock(groupSermons(group.id));
  if (sermons) details.append(sermons);
  if (group.note) details.append(el("p", { class: "sin-note" }, group.note));
  if (group.id === "commandments") {
    for (const item of group.items || []) details.append(commandmentItem(item));
  } else {
    if (group.scripture) details.append(scriptureBlock(group.reference ? "" : "", group.scripture));
    if (Array.isArray(group.items) && group.items.every((item) => typeof item === "string")) {
      details.append(el("ul", { class: "sin-list" }, group.items.map((item) => el("li", {}, item))));
    }
    if (group.closing) details.append(el("p", { class: "sin-note" }, group.closing));
    for (const part of group.parts || []) details.append(sinPart(part));
    const hymns = hymnLinks(group.hymns);
    if (hymns) details.append(hymns);
  }
  return details;
}

function renderSins() {
  homeBar.hidden = false;
  hymnBar.hidden = true;
  setBrowseChrome(false);
  activeIndex = "sins";
  saveIndex("sins");
  syncTabs("sins");
  main.setAttribute("role", "tabpanel");
  main.setAttribute("aria-labelledby", "tab-sins");
  main.classList.remove("has-jump");
  document.title = "Sins · Hark";
  const catalog = sinsCatalog;
  if (!catalog) {
    main.replaceChildren(el("p", { class: "empty" }, "The Sins page did not open."));
    return;
  }
  const root = el("div", { class: "sins" });
  const intro = catalog.intro || {};
  if (intro.catechism) {
    root.append(catechismBlock(intro.catechism));
  }
  if (intro.note) root.append(el("p", { class: "sin-note" }, intro.note));

  const jumps = [...(catalog.groups || []), catalog.gospel].filter(Boolean);
  if (jumps.length) {
    const row = el("div", { class: "theme-jumps" });
    for (const group of jumps) {
      const button = el("button", { type: "button" }, group.title);
      button.addEventListener("click", () => {
        const node = document.getElementById(`sin-${group.id}`);
        if (!node) return;
        if (node.tagName === "DETAILS") node.open = true;
        node.scrollIntoView({ block: "start" });
      });
      row.append(button);
    }
    root.append(row);
  }

  (catalog.groups || []).forEach((group, index) => root.append(sinGroup(group, index === 0)));

  root.append(stopItCard());

  const gospel = catalog.gospel;
  if (gospel) {
    const sectionEl = el("section", { class: "gospel", id: `sin-${gospel.id}` });
    sectionEl.append(el("h2", {}, gospel.title));
    sectionEl.append(
      el(
        "p",
        { class: "sin-note" },
        "Of course, we can't just stop it on our own. Repentance unto life is a saving grace (WSC Q. 87), and Christ came to save sinners (1 Timothy 1:15).",
      ),
    );
    const sermons = sermonBlock(listSermons(sermonCatalog, "page"));
    if (sermons) sectionEl.append(sermons);
    if (gospel.catechism) sectionEl.append(catechismBlock(gospel.catechism));
    for (const verse of gospel.verses || []) {
      sectionEl.append(scriptureBlock(verse.reference, [verse.text]));
    }
    const hymns = hymnLinks(gospel.hymns);
    if (hymns) sectionEl.append(hymns);
    if (gospel.theme && gospel.theme.id) {
      sectionEl.append(
        el(
          "p",
          { class: "sin-note" },
          el("a", { href: `#/theme/${gospel.theme.id}` }, gospel.theme.title),
        ),
      );
    }
    root.append(sectionEl);
  }
  main.replaceChildren(root);
  const y = scrollMemory.sins || 0;
  requestAnimationFrame(() => window.scrollTo(0, y));
}

function renderThemes() {
  homeBar.hidden = false;
  hymnBar.hidden = true;
  setBrowseChrome(true);
  activeIndex = "themes";
  saveIndex("themes");
  syncTabs("themes");
  main.setAttribute("role", "tabpanel");
  main.setAttribute("aria-labelledby", "tab-themes");
  main.classList.remove("has-jump");
  const outline = themeOutline(themeCatalog, hymns, { query: queryInput.value, section });
  const shown = new Set();
  for (const group of [...outline.seasons, ...outline.topics]) {
    for (const hymn of group.hymns) shown.add(hymn.number);
  }
  count.textContent = countLabel(shown.size);
  document.title = "Themes · Hark";
  if (shown.size === 0) {
    main.replaceChildren(el("p", { class: "empty" }, "No hymns match that search."));
  } else {
    const root = el("div", { class: "themes" });
    const jumps = [...outline.seasons, ...outline.topics];
    if (jumps.length) root.append(themeJump(jumps));
    if (outline.seasons.length) {
      root.append(el("h2", { class: "theme-kind" }, "Seasons"));
      outline.seasons.forEach((group, index) => root.append(themeGroup(group, index === 0)));
    }
    if (outline.topics.length) {
      root.append(el("h2", { class: "theme-kind" }, "Topics"));
      for (const group of outline.topics) root.append(themeGroup(group, false));
    }
    main.replaceChildren(root);
  }
  const y = scrollMemory.themes || 0;
  requestAnimationFrame(() => window.scrollTo(0, y));
}

function renderTheme(id) {
  homeBar.hidden = false;
  hymnBar.hidden = true;
  setBrowseChrome(true);
  const key = `theme:${id}`;
  activeIndex = key;
  saveIndex(key);
  syncTabs("themes");
  main.setAttribute("role", "tabpanel");
  main.setAttribute("aria-labelledby", "tab-themes");
  main.classList.remove("has-jump");
  const theme = findTheme(themeCatalog, id);
  if (!theme) {
    count.textContent = "";
    document.title = "Theme not found · Hark";
    main.replaceChildren(
      el("div", { class: "theme-page" }, [
        el("p", {}, el("a", { href: "#/themes" }, "All themes")),
        el("h2", { class: "theme-page-title" }, "Theme not found"),
        el("p", {}, "There is no theme by that name."),
      ]),
    );
    window.scrollTo(0, 0);
    return;
  }
  const numbers = new Set(hymnsInTheme(themeCatalog, id));
  const list = filterHymns(hymns, queryInput.value, section).filter((hymn) => numbers.has(hymn.number));
  count.textContent = countLabel(list.length);
  document.title = `${theme.title} · Hark`;
  const page = el("div", { class: "theme-page" });
  page.append(el("p", { class: "theme-back" }, el("a", { href: "#/themes" }, "All themes")));
  page.append(el("h2", { class: "theme-page-title" }, theme.title));
  if (list.length === 0) page.append(el("p", { class: "empty" }, "No hymns match that search."));
  else page.append(themeHymnList(list));
  main.replaceChildren(page);
  const y = scrollMemory[key] || 0;
  requestAnimationFrame(() => window.scrollTo(0, y));
}

function themeChips(hymn) {
  const themes = themesForHymn(themeCatalog, hymn.number);
  if (themes.length === 0) return null;
  const nav = el("nav", { class: "theme-chips", "aria-label": "Themes for this hymn" });
  const seasonIds = new Set((themeCatalog.seasons || []).map((item) => item.id));
  for (const theme of themes) {
    nav.append(
      el(
        "a",
        {
          href: `#/theme/${theme.id}`,
          class: seasonIds.has(theme.id) ? "season" : "topic",
        },
        theme.title,
      ),
    );
  }
  return nav;
}

function renderIndex(index) {
  homeBar.hidden = false;
  hymnBar.hidden = true;
  setBrowseChrome(true);
  activeIndex = index;
  saveIndex(index);
  syncTabs(index);
  main.setAttribute("role", "tabpanel");
  main.setAttribute("aria-labelledby", `tab-${index}`);
  const result = browse(hymns, { query: queryInput.value, section, mode: index });
  count.textContent = countLabel(result.total);
  main.classList.toggle("has-jump", index !== "number" && result.total > 0);
  if (result.total === 0) {
    main.replaceChildren(el("p", { class: "empty" }, "No hymns match that search."));
  } else if (index === "title") {
    main.replaceChildren(titleList(result.letters), jumpBar(result.letters));
  } else if (index === "author") {
    main.replaceChildren(authorList(result.letters), jumpBar(result.letters));
  } else {
    main.replaceChildren(numberList(result.hymns));
  }
  document.title =
    index === "title" ? "Titles · Hark" : index === "author" ? "Authors · Hark" : "Hark";
  const y = scrollMemory[index] || 0;
  requestAnimationFrame(() => window.scrollTo(0, y));
}

function copyrightNotice(hymn) {
  const notice = el("div", { class: "notice copyright-note" });
  notice.append(el("h2", {}, hymn.title));
  const people = [hymn.author, hymn.translator ? `Translator: ${hymn.translator}` : ""]
    .filter(Boolean)
    .join(". ");
  if (people) notice.append(el("p", {}, people));
  const credit = [hymn.copyright_holder, hymn.copyright_year].filter(Boolean).join(", ");
  if (credit) notice.append(el("p", { class: "copyright-holder" }, credit));
  notice.append(el("p", {}, "Words are under copyright and are not reproduced here."));
  const href = hymn.copyright_url || hymn.source_url;
  if (href) {
    notice.append(
      el(
        "p",
        {},
        el(
          "a",
          { href, target: "_blank", rel: "noopener noreferrer" },
          "Read the words",
        ),
      ),
    );
  }
  return notice;
}

function linesEl(lines, className) {
  const paragraph = el("p", { class: className });
  for (const line of lines) paragraph.append(el("span", { class: "line" }, line));
  return paragraph;
}

function playerFrame(item) {
  const frame = el("div", { class: "video-frame" });
  frame.append(
    el("iframe", {
      src: item.embed,
      title: item.label,
      loading: "lazy",
      allow:
        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
      allowfullscreen: true,
      referrerpolicy: "strict-origin-when-cross-origin",
    }),
  );
  return frame;
}

function watchCard(block) {
  const card = el("div", { class: "watch-card" });
  const thumb = el("a", {
    class: "watch-thumb",
    href: block.href,
    target: "_blank",
    rel: "noopener noreferrer",
    "aria-label": "Watch on YouTube",
  });
  if (block.thumb) thumb.append(el("img", { src: block.thumb, alt: "", loading: "lazy" }));
  thumb.append(el("span", { class: "watch-play", "aria-hidden": "true" }));
  card.append(thumb);
  card.append(
    el(
      "a",
      { class: "faith-link", href: block.href, target: "_blank", rel: "noopener noreferrer" },
      block.label,
    ),
  );
  return card;
}

function mountYoutube(item) {
  const block = youtubeBlock(item);
  if (!block) return null;
  if (block.type === "card") return watchCard(block);
  return playerFrame({ embed: block.src, label: item.label || item.title || "YouTube" });
}

function mediaFigure(item) {
  const figure = el("figure");
  figure.append(el("figcaption", {}, item.label));
  if (item.kind === "youtube") {
    const player = mountYoutube(item);
    if (player) figure.append(player);
  }
  else if (item.kind === "video") {
    const video = el("video", { controls: true, playsinline: true, preload: "metadata" });
    video.src = item.url;
    figure.append(video);
  } else {
    const audio = el("audio", { controls: true, preload: "metadata" });
    audio.src = item.url;
    figure.append(audio);
  }
  return figure;
}

function youtubeLink(item) {
  return el(
    "a",
    {
      class: "faith-link",
      href: item.url,
      target: "_blank",
      rel: "noopener noreferrer",
    },
    "Play on YouTube",
  );
}

function faithCard(item, openPlayer) {
  const figure = el("figure", { class: "faith-item" });
  if (item.date) figure.append(el("p", { class: "faith-date" }, item.date));
  figure.append(el("p", { class: "faith-label" }, item.label));
  if (item.kind === "youtube" && item.embeddable === false) {
    const player = mountYoutube(item);
    if (player) figure.append(player);
  } else if (item.kind === "youtube" && openPlayer) {
    const player = mountYoutube(item);
    if (player) figure.append(player);
  } else if (item.kind === "youtube") {
    const details = el("details", { class: "faith-play" });
    details.append(el("summary", {}, "Play in the page"));
    details.addEventListener("toggle", () => {
      if (details.open && !details.querySelector("iframe") && !details.querySelector(".watch-card")) {
        const player = mountYoutube(item);
        if (player) details.append(player);
      }
    });
    figure.append(details);
  } else if (item.kind === "video") {
    const video = el("video", { controls: true, playsinline: true, preload: "metadata" });
    video.src = item.url;
    figure.append(video);
  } else if (item.url) {
    const audio = el("audio", { controls: true, preload: "metadata" });
    audio.src = item.url;
    figure.append(audio);
  }
  if (item.kind === "youtube" && item.url && item.embeddable !== false) {
    const link = youtubeLink(item);
    link.setAttribute("aria-label", `Play on YouTube, ${item.label}`);
    figure.append(link);
  }
  return figure;
}

function faithSection(hymn) {
  const items = faithRecordings(recordingCatalog, hymn.number);
  if (items.length === 0) return null;
  const sectionEl = el("section", {
    class: "recordings faith",
    "aria-label": "Hear it at Faith Presbyterian",
  });
  sectionEl.append(el("h2", { class: "faith-heading" }, "Hear it at Faith Presbyterian"));
  const caution = tuneCaution(hymn.number);
  if (caution) sectionEl.append(el("p", { class: "faith-note" }, caution));
  sectionEl.append(faithCard(items[0], true));
  if (items.length > 1) {
    const details = el("details", { class: "earlier" });
    const older = items.length - 1;
    details.append(
      el("summary", {}, older === 1 ? "1 earlier recording" : `${older} earlier recordings`),
    );
    for (const item of items.slice(1)) details.append(faithCard(item, false));
    sectionEl.append(details);
  }
  return sectionEl;
}

function recordingSection(hymn) {
  const items = listRecordings(hymn);
  if (items.length === 0) return null;
  const sectionEl = el("section", { class: "recordings" });
  sectionEl.append(el("h2", {}, "Choir"));
  for (const item of items) sectionEl.append(mediaFigure(item));
  return sectionEl;
}

function setPager(link, hymn, direction) {
  link.replaceChildren(icon(direction));
  if (!hymn) {
    link.removeAttribute("href");
    link.setAttribute("aria-disabled", "true");
    link.setAttribute("aria-label", direction === "prev" ? "No previous hymn" : "No next hymn");
    return;
  }
  link.href = `#/hymn/${hymn.number}`;
  link.removeAttribute("aria-disabled");
  const word = direction === "prev" ? "Previous" : "Next";
  link.setAttribute("aria-label", `${word} hymn, ${hymn.number} ${hymn.title}`);
}

function endLink(hymn, direction) {
  if (!hymn) return null;
  const word = direction === "prev" ? "Previous" : "Next";
  const link = el("a", {
    href: `#/hymn/${hymn.number}`,
    class: direction === "next" ? "next" : "prev",
    "aria-label": `${word} hymn, ${hymn.number} ${hymn.title}`,
  });
  link.append(
    el("span", { class: "end-kicker" }, word),
    el("span", { class: "end-num" }, String(hymn.number)),
    el("span", { class: "end-title" }, hymn.title),
  );
  return link;
}

let activeSynth = null;
let abcjsLoad = null;

// abcjs is close to half a megabyte, more than everything else in Hark put
// together. It used to be a blocking script tag, so every reader paid for it
// on every page whether or not they ever opened the music. Nothing needs it
// until someone does, so it is fetched here instead.
function loadAbcjs() {
  if (window.ABCJS) return Promise.resolve(window.ABCJS);
  if (abcjsLoad) return abcjsLoad;
  abcjsLoad = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = new URL("vendor/abcjs-basic-min.js", import.meta.url).href;
    script.addEventListener("load", () => resolve(window.ABCJS || null));
    script.addEventListener("error", () => {
      // Let the next try start over rather than holding a rejected promise.
      abcjsLoad = null;
      reject(new Error("The music could not be loaded."));
    });
    document.head.append(script);
  });
  return abcjsLoad;
}

function renderScore(container, abc) {
  if (!window.ABCJS) return null;
  container.replaceChildren();
  const width = Math.max(280, container.clientWidth || 320);
  const rendered = ABCJS.renderAbc(container, abc, {
    responsive: "resize",
    staffwidth: width,
    add_classes: true,
    paddingleft: 0,
    paddingright: 8,
  });
  return rendered && rendered[0];
}

async function stopScore() {
  if (!activeSynth) return;
  try {
    activeSynth.stop();
  } catch {
    /* already stopped */
  }
  activeSynth = null;
}

async function playScore(visualObj, qpm) {
  await stopScore();
  if (!visualObj || !window.ABCJS || !ABCJS.synth || !ABCJS.synth.supportsAudio()) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const audioContext = new AudioCtx();
  const synth = new ABCJS.synth.CreateSynth();
  await synth.init({ audioContext, visualObj, options: { qpm } });
  await synth.prime();
  await synth.start();
  activeSynth = synth;
}

function musicBlock(hymn) {
  const key = String(hymn.number);
  const score = musicCatalog.scores && musicCatalog.scores[key];
  const omitted = musicCatalog.omitted && musicCatalog.omitted[key];
  if (score) {
    const details = el("details", { class: "music-block" });
    details.append(el("summary", {}, "Music"));
    details.append(
      el(
        "p",
        { class: "music-credit" },
        `Tune: ${score.tune}. Harmony: ${score.harmony_credit}. May differ from the Trinity Hymnal setting.`,
      ),
    );
    const scoreEl = el("div", { class: "music-score", "aria-label": `Music for ${score.tune}` });
    const play = el("button", { type: "button" }, "Play");
    const stop = el("button", { type: "button" }, "Stop");
    const tempo = el("input", { type: "range", min: "60", max: "160", value: "100" });
    tempo.setAttribute("aria-label", "Tempo");
    const controls = el("div", { class: "music-controls" });
    controls.append(play, stop, el("label", { class: "tempo" }, ["Tempo ", tempo]));
    details.append(scoreEl, controls);
    details.append(
      el(
        "p",
        { class: "music-note" },
        "The first time you press Play, the piano sound may need a connection.",
      ),
    );
    let visual = null;
    let pending = null;
    const buildScore = async () => {
      scoreEl.textContent = "Loading the music...";
      try {
        await loadAbcjs();
        const response = await fetch(new URL(`data/music/${score.file}`, import.meta.url));
        const display = (await response.text())
          .split("\n")
          .filter((line) => !/^[TCSW]:/.test(line))
          .join("\n");
        visual = renderScore(scoreEl, display);
      } catch {
        pending = null;
        scoreEl.textContent = "The music did not load. Check your connection, then try again.";
      }
      return visual;
    };
    // Opening the block and pressing Play both ask for the score, and Play
    // opens the block, so without this the music was fetched and drawn twice.
    const ensureScore = () => {
      if (visual) return Promise.resolve(visual);
      if (!pending) pending = buildScore();
      return pending;
    };
    details.addEventListener("toggle", () => {
      if (details.open) ensureScore();
    });
    play.addEventListener("click", async () => {
      details.open = true;
      await playScore(await ensureScore(), Number(tempo.value) || 100);
    });
    stop.addEventListener("click", () => {
      stopScore();
    });
    return details;
  }
  if (omitted) {
    const box = el("div", { class: "notice" });
    box.append(el("h2", {}, "Music not shown"));
    box.append(el("p", {}, omitted.reason));
    box.append(el("p", {}, "See the printed Trinity Hymnal for the music."));
    return box;
  }
  return null;
}

function renderHymn(number) {
  const listIndex = activeIndex || storedIndex();
  activeIndex = null;
  homeBar.hidden = true;
  hymnBar.hidden = false;
  main.classList.remove("has-jump");
  main.removeAttribute("role");
  main.removeAttribute("aria-labelledby");
  count.textContent = "";

  const back = document.getElementById("back-link");
  back.href = indexHref(listIndex);
  const fromThemes = listIndex === "themes" || (typeof listIndex === "string" && listIndex.startsWith("theme:"));
  const fromSins = listIndex === "sins";
  const fromRequests = listIndex === "requests";
  const backLabel = fromRequests ? "Comments/Requests" : fromSins ? "Sins" : fromThemes ? "Themes" : "Hymns";
  back.replaceChildren(icon("back"), document.createTextNode(backLabel));
  const listName = fromRequests
    ? "comments and requests"
    : fromSins
      ? "Sins page"
      : fromThemes
        ? "themes"
        : listIndex === "title"
          ? "title index"
          : listIndex === "author"
            ? "author index"
            : "hymn list";
  back.setAttribute("aria-label", `Back to the ${listName}`);

  const found = neighbors(hymns, number);
  setPager(document.getElementById("prev-link"), found.prev, "prev");
  setPager(document.getElementById("next-link"), found.next, "next");
  document.getElementById("pager-num").textContent = found.hymn ? String(found.hymn.number) : "";

  if (!found.hymn) {
    document.title = "Hymn not found · Hark";
    main.replaceChildren(
      el("article", { class: "hymn" }, [
        el("h1", { class: "hymn-title", id: "hymn-title", tabindex: "-1" }, "Hymn not found"),
        el("p", {}, `No hymn numbered ${number} is in this book.`),
        el("p", {}, el("a", { href: indexHref(listIndex) }, "Back to the list")),
      ]),
    );
  } else {
    const hymn = found.hymn;
    document.title = `${hymn.number} ${hymn.title} · Hark`;
    const article = el("article", { class: "hymn" });
    article.append(el("p", { class: "hymn-number" }, `No. ${hymn.number}`));
    const title = el("h1", { class: "hymn-title", id: "hymn-title", tabindex: "-1" }, hymn.title);
    article.append(title);
    const credit = attributionParts(hymn);
    if (credit.people) article.append(el("p", { class: "attribution" }, credit.people));
    if (credit.music) article.append(el("p", { class: "attribution" }, credit.music));
    const chipsForHymn = themeChips(hymn);
    if (chipsForHymn) article.append(chipsForHymn);

    const heard = faithSection(hymn);
    const choir = recordingSection(hymn);

    if (isWithheld(hymn)) {
      article.append(copyrightNotice(hymn));
    } else if (wordsPending(hymn)) {
      // Listed from a bulletin so it can be found by number or title. Say that
      // plainly rather than showing an empty page.
      const notice = el("div", { class: "notice" });
      notice.append(el("h2", {}, "Words not added yet"));
      notice.append(
        el("p", {}, "This hymn is here because the congregation sings it. The words are still to come."),
      );
      notice.append(el("p", {}, "See the printed Trinity Hymnal for the words."));
      article.append(notice);
    } else {
      const note = partialNote(hymn);
      if (note) {
        const notice = el("div", { class: "notice" });
        notice.append(el("h2", {}, "Some stanzas are omitted"));
        notice.append(el("p", {}, note));
        article.append(notice);
      }
      const text = el("div", { class: "text" });
      for (const block of stanzaPlan(hymn)) {
        if (block.type === "gap" || block.type === "copyright") {
          text.append(el("p", { class: block.type === "copyright" ? "omitted copyright-stanza" : "omitted" }, block.note));
        } else if (block.type === "refrain") {
          const refrain = el("div", { class: "refrain" });
          refrain.append(el("p", { class: "refrain-label" }, "Refrain"));
          refrain.append(linesEl(block.lines, "refrain-lines"));
          text.append(refrain);
        } else {
          const row = el("div", { class: "stanza" });
          row.append(
            el("p", { class: "stanza-num" }, [
              el("span", { class: "visually-hidden" }, "Stanza "),
              String(block.number),
            ]),
          );
          row.append(linesEl(block.lines, "stanza-lines"));
          text.append(row);
        }
      }
      if ((hymn.stanzas || []).length === 0) {
        text.append(el("p", { class: "omitted" }, "No words are included for this hymn yet."));
      }
      article.append(text);
    }

    const music = musicBlock(hymn);
    if (music) article.append(music);

    if (heard) article.append(heard);
    if (choir) article.append(choir);
    if (!heard && !choir) {
      article.append(el("p", { class: "coming" }, "Choir recording coming soon."));
    }

    const nav = el("nav", { class: "end-nav", "aria-label": "More hymns" });
    const previous = endLink(found.prev, "prev");
    const next = endLink(found.next, "next");
    if (previous) nav.append(previous);
    if (next) nav.append(next);
    if (previous || next) article.append(nav);
    article.append(el("p", { class: "colophon" }, "Trinity Hymnal, 1990"));
    main.replaceChildren(article);
  }

  window.scrollTo(0, 0);
  const heading = document.getElementById("hymn-title");
  if (heading) heading.focus({ preventScroll: true });
}

function requestField(id, label, control) {
  const wrap = el("label", { class: "request-field", for: id });
  wrap.append(el("span", {}, label), control);
  return wrap;
}

function requestForm() {
  const form = el("form", { class: "request-form" });
  const name = el("input", { id: "request-name", name: "name", maxlength: "80", autocomplete: "name" });
  const hymn = el("input", { id: "request-hymn", name: "hymn", maxlength: "120" });
  const message = el("textarea", { id: "request-message", name: "message", required: true, maxlength: "2000", rows: "5" });
  const honey = el("input", {
    id: "request-company",
    name: "company",
    tabindex: "-1",
    autocomplete: "off",
  });
  honey.setAttribute("aria-hidden", "true");
  const honeyLabel = el("label", { class: "request-honey" }, ["Company", honey]);
  const status = el("p", { class: "request-status", role: "status" });
  const submit = el("button", { type: "submit" }, "Send");
  form.append(
    requestField("request-name", "Name (optional)", name),
    requestField("request-hymn", "Hymn number or title (optional)", hymn),
    requestField("request-message", "Comment or hymn request", message),
    honeyLabel,
    submit,
    status,
  );
  if (requestConfig.turnstileSiteKey) {
    const box = el("div", { class: "request-turnstile" });
    form.insertBefore(box, submit);
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => {
      if (window.turnstile) {
        form.dataset.turnstileId = window.turnstile.render(box, { sitekey: requestConfig.turnstileSiteKey });
      }
    };
    document.head.append(script);
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    status.textContent = "";
    if (!requestsOpen()) {
      status.textContent = "Comments/Requests open soon";
      return;
    }
    const text = message.value.trim();
    if (!text) {
      status.textContent = "Write a comment or a hymn request.";
      return;
    }
    submit.disabled = true;
    try {
      const response = await fetch(requestConfig.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.value.trim(),
          hymn: hymn.value.trim(),
          message: text,
          company: honey.value,
          turnstile: form.dataset.turnstileId && window.turnstile
            ? window.turnstile.getResponse(form.dataset.turnstileId)
            : "",
        }),
      });
      if (!response.ok) throw new Error(String(response.status));
      form.reset();
      status.textContent = "Sent. It will show in the list below.";
      loadSubmissions(form.parentElement.querySelector(".request-list"));
    } catch {
      status.textContent = "The message did not send. Try again.";
    } finally {
      submit.disabled = false;
    }
  });
  return form;
}

function submissionCard(issue) {
  const card = el("article", { class: "request-card" });
  card.append(el("h3", {}, issue.title || ""));
  const when = formatRecordingDate(String(issue.created_at || "").slice(0, 10));
  if (when) card.append(el("p", { class: "request-meta" }, when));
  card.append(el("p", { class: "request-body" }, issue.body || ""));
  const comments = Array.isArray(issue.comments) ? issue.comments : [];
  if (comments.length) {
    const replies = el("div", { class: "request-replies" });
    replies.append(el("h4", {}, "Replies"));
    for (const comment of comments) {
      const line = comment.author ? `${comment.author}: ${comment.body || ""}` : comment.body || "";
      replies.append(el("p", {}, line));
    }
    card.append(replies);
  }
  return card;
}

function pastHeading(host) {
  const heading = host.previousElementSibling;
  if (heading && heading.tagName === "H2" && heading.textContent === "Past submissions") return heading;
  return null;
}

function showEmptyRequests(host) {
  const heading = pastHeading(host);
  if (heading) heading.remove();
  host.replaceChildren(el("p", { class: "request-empty" }, "No requests yet."));
}

function showSubmissions(host, issues, shown) {
  if (!pastHeading(host)) host.before(el("h2", {}, "Past submissions"));
  const visible = issues.slice(0, shown);
  const nodes = visible.map((issue) => submissionCard(issue));
  if (shown < issues.length) {
    const more = el("button", { type: "button", class: "see-more" }, "See more");
    more.addEventListener("click", () => showSubmissions(host, issues, shown + 5));
    nodes.push(more);
  }
  host.replaceChildren(...nodes);
}

async function loadSubmissions(host) {
  if (!host) return;
  if (!requestConfig.endpoint) {
    showEmptyRequests(host);
    return;
  }
  host.replaceChildren(el("p", { class: "request-empty" }, "Loading past submissions..."));
  try {
    const response = await fetch(requestConfig.endpoint, { method: "GET", headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(String(response.status));
    const issues = await response.json();
    if (!Array.isArray(issues) || !issues.length) {
      showEmptyRequests(host);
      return;
    }
    issues.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
    showSubmissions(host, issues, 3);
  } catch {
    host.replaceChildren(el("p", { class: "sin-note" }, "The list did not load."));
  }
}

function renderRequests() {
  homeBar.hidden = false;
  hymnBar.hidden = true;
  setBrowseChrome(false);
  activeIndex = "requests";
  saveIndex("requests");
  syncTabs("requests");
  main.setAttribute("role", "tabpanel");
  main.setAttribute("aria-labelledby", "tab-requests");
  main.classList.remove("has-jump");
  document.title = "Comments/Requests · Hark";
  const page = el("article", { class: "comments-page" });
  page.append(el("h2", {}, "Comments/Requests"));
  page.append(el("p", { class: "sin-note" }, "Leave a comment or request any hymn. We read every one."));
  if (requestsOpen()) page.append(requestForm());
  else page.append(el("p", { class: "coming" }, "Comments/Requests open soon"));
  page.append(el("h2", {}, "Past submissions"));
  const list = el("div", { class: "request-list" });
  page.append(list);
  main.replaceChildren(page);
  loadSubmissions(list);
  const y = scrollMemory.requests || 0;
  requestAnimationFrame(() => window.scrollTo(0, y));
}

function render() {
  if (!ready) return;
  bubble.hidden = true;
  const current = route();
  if (current.view === "hymn") renderHymn(current.number);
  else if (current.view === "themes") renderThemes();
  else if (current.view === "theme") renderTheme(current.id);
  else if (current.view === "sins") renderSins();
  else if (current.view === "requests") renderRequests();
  else if (current.view === "install") renderInstall();
  else renderIndex(current.index);
  syncSticky();
}

function showError() {
  homeBar.hidden = false;
  hymnBar.hidden = true;
  document.title = "Hark";
  main.replaceChildren(
    el("div", { class: "notice" }, [
      el("h2", {}, "The hymnal did not open"),
      el("p", {}, "Check your connection, then try again."),
      el(
        "button",
        { type: "button", class: "retry", onclick: () => location.reload() },
        "Try again",
      ),
    ]),
  );
}

async function load() {
  try {
    const [hymnResponse, recordingResponse, themeResponse, sinsResponse, sermonResponse, musicResponse] = await Promise.all([
      fetch(new URL("data/hymns.json", import.meta.url)),
      fetch(new URL("data/recordings.json", import.meta.url)),
      fetch(new URL("data/themes.json", import.meta.url)),
      fetch(new URL("data/sins.json", import.meta.url)),
      fetch(new URL("data/sermons.json", import.meta.url)),
      fetch(new URL("data/music.json", import.meta.url)),
    ]);
    if (!hymnResponse.ok) throw new Error(String(hymnResponse.status));
    const data = await hymnResponse.json();
    if (!Array.isArray(data)) throw new Error("bad data");
    hymns = data;
    recordingCatalog = {};
    if (recordingResponse.ok) {
      const catalog = await recordingResponse.json();
      if (catalog && typeof catalog === "object" && !Array.isArray(catalog)) recordingCatalog = catalog;
    }
    themeCatalog = { seasons: [], topics: [], hymns: {} };
    if (themeResponse.ok) {
      const catalog = await themeResponse.json();
      if (catalog && typeof catalog === "object" && !Array.isArray(catalog)) themeCatalog = catalog;
    }
    sinsCatalog = null;
    if (sinsResponse.ok) {
      const catalog = await sinsResponse.json();
      if (catalog && typeof catalog === "object" && !Array.isArray(catalog)) sinsCatalog = catalog;
    }
    sermonCatalog = { page: [], groups: {} };
    if (sermonResponse.ok) {
      const catalog = await sermonResponse.json();
      if (catalog && typeof catalog === "object" && !Array.isArray(catalog)) sermonCatalog = catalog;
    }
    musicCatalog = { scores: {}, omitted: {} };
    if (musicResponse.ok) {
      const catalog = await musicResponse.json();
      if (catalog && typeof catalog === "object" && !Array.isArray(catalog)) musicCatalog = catalog;
    }
    ready = true;
    buildChips();
    render();
  } catch {
    showError();
  }
}

if ("scrollRestoration" in history) history.scrollRestoration = "manual";

searchForm.addEventListener("submit", (event) => event.preventDefault());
queryInput.addEventListener("input", () => {
  clearButton.hidden = queryInput.value.length === 0;
  if (activeIndex) scrollMemory[activeIndex] = 0;
  render();
});
clearButton.addEventListener("click", () => {
  queryInput.value = "";
  clearButton.hidden = true;
  queryInput.focus();
  if (activeIndex) scrollMemory[activeIndex] = 0;
  render();
});

for (const [id, index] of TAB_IDS) {
  document.getElementById(id).addEventListener("click", () => {
    const next = indexHref(index);
    rememberScroll();
    if ((location.hash || "#/") === next) render();
    else location.hash = next;
  });
}

tabs.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
  const buttons = TAB_IDS.map(([id]) => document.getElementById(id));
  const current = buttons.indexOf(document.activeElement);
  if (current < 0) return;
  event.preventDefault();
  const direction = event.key === "ArrowRight" ? 1 : -1;
  const next = buttons[(current + direction + buttons.length) % buttons.length];
  next.focus();
  next.click();
});

document.addEventListener("click", (event) => {
  const link = event.target.closest("a[href^='#/hymn/']");
  if (link) rememberScroll();
});

window.addEventListener("hashchange", render);
window.addEventListener("resize", syncSticky);
for (const button of themeButtons) button.addEventListener("click", toggleTheme);

const themeQuery = matchMedia("(prefers-color-scheme: dark)");
themeQuery.addEventListener("change", (event) => {
  if (document.documentElement.dataset.themeChoice === "system") {
    document.documentElement.dataset.theme = event.matches ? "dark" : "light";
    syncTheme();
  }
});

syncTheme();
clearButton.replaceChildren(icon("close"));
load();

const installLink = document.getElementById("install-link");
const installHelp = document.getElementById("install-help");
let installEvent = null;

function runningAsApp() {
  return document.documentElement.dataset.installed === "true"
    || window.matchMedia("(display-mode: standalone)").matches
    || window.matchMedia("(display-mode: fullscreen)").matches
    || window.navigator.standalone === true;
}

function syncInstallButton() {
  if (!installLink) return;
  installLink.hidden = runningAsApp();
}

function installSteps(includeComputer) {
  const wrap = el("div", { class: "install-steps" });
  if (runningAsApp()) wrap.append(el("p", {}, installGuide.installed));
  wrap.append(el("p", {}, installGuide.intro));
  wrap.append(el("h3", {}, installGuide.androidTitle));
  wrap.append(el("ol", {}, installGuide.android.map((step) => el("li", {}, step))));
  wrap.append(el("h3", {}, installGuide.iphoneTitle));
  wrap.append(el("ol", {}, installGuide.iphone.map((step) => el("li", {}, step))));
  if (includeComputer) wrap.append(el("p", {}, installGuide.computer));
  return wrap;
}

function fillInstallHelp() {
  installHelp.replaceChildren();
  installHelp.append(el("h2", { id: "install-help-title" }, "Install Hark"));
  installHelp.append(installSteps(false));
  installHelp.append(
    el("p", {}, el("a", { href: "#/install", id: "install-more" }, installGuide.pageLink)),
  );
  installHelp.append(el("button", { type: "button", class: "install-close", id: "install-close" }, "Close"));
  installHelp.querySelector("#install-more").addEventListener("click", () => installHelp.close());
  installHelp.querySelector("#install-close").addEventListener("click", () => installHelp.close());
}

function openInstallHelp() {
  if (!installHelp || typeof installHelp.showModal !== "function") return false;
  fillInstallHelp();
  installHelp.showModal();
  return true;
}

// Chrome and Edge hand the page a beforeinstallprompt event instead of showing
// their own install bar. Nothing can reopen it, so the Install Hark link spends
// it here rather than sending a phone that can install in one tap off to read
// the manual steps.
async function promptInstall() {
  const saved = installEvent;
  if (!saved) return false;
  installEvent = null;
  try {
    saved.prompt();
    await saved.userChoice;
  } catch {
    /* the browser already spent or dropped this prompt */
  }
  syncInstallButton();
  return true;
}

function renderInstall() {
  homeBar.hidden = false;
  hymnBar.hidden = true;
  setBrowseChrome(false, { hideTabs: true });
  activeIndex = "install";
  saveIndex("install");
  syncTabs("install");
  main.classList.remove("has-jump");
  main.removeAttribute("role");
  main.removeAttribute("aria-labelledby");
  count.textContent = "";
  document.title = "Install Hark";
  const page = el("article", { class: "install-page" });
  page.append(el("p", { class: "theme-back" }, el("a", { href: "#/" }, "Hymns")));
  page.append(el("h2", {}, "Install Hark"));
  if (installEvent && !runningAsApp()) {
    const now = el("button", { type: "button", class: "install-now" }, "Install now");
    now.addEventListener("click", async () => {
      await promptInstall();
      render();
    });
    page.append(now);
  }
  page.append(installSteps(true));
  const card = el("figure", { class: "qr-card" });
  card.append(
    el("img", {
      src: "icons/hark-qr.svg",
      width: "168",
      height: "168",
      alt: `QR code that opens ${INSTALL_URL}`,
    }),
  );
  card.append(el("figcaption", {}, installGuide.qrCaption));
  page.append(card);
  page.append(el("p", {}, el("a", { href: INSTALL_URL }, INSTALL_URL)));
  main.replaceChildren(page);
  window.scrollTo(0, 0);
}


window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installEvent = event;
  syncInstallButton();
});

window.addEventListener("appinstalled", () => {
  installEvent = null;
  document.documentElement.dataset.installed = "true";
  syncInstallButton();
});

if (installLink) {
  installLink.addEventListener("click", (event) => {
    if (runningAsApp()) return;
    if (installEvent) {
      event.preventDefault();
      promptInstall();
      return;
    }
    // No native prompt on this browser, so show the steps. If the dialog is not
    // supported the link falls through to the install page.
    if (openInstallHelp()) event.preventDefault();
  });
}

syncInstallButton();

if ("serviceWorker" in navigator) {
  let reloading = false;
  // True only when a worker was already running this page, which means this is
  // an update. On a first visit the new worker claims the page and fires
  // controllerchange too, and reloading there throws away whatever the reader
  // has already typed or opened.
  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });
  window.addEventListener("load", () => {
    const script = new URL("sw.js", import.meta.url);
    const scope = new URL("./", script);
    navigator.serviceWorker.register(script, { scope: scope.href }).catch(() => {});
  });
}
