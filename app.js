import { INSTALL_URL, installGuide } from "./install.js";
import {
  isLiked,
  likeButtonState,
  likedHymns,
  readLikes,
  toggleLike,
} from "./likes.js";
import { changelogDateLabel, groupChangelog } from "./changelog.js";
import {
  attributionParts,
  recordingCaption,
  browse,
  faithRecordings,
  filterHymns,
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
  inHymnal,
  numberLabel,
  numberedTitle,
  tuneCaution,
  melodyGroups,
  melodyLabel,
  playOrder,
  playSongCaption,
  scoreMelodyNote,
  listSermons,
  formatRecordingDate,
  youtubeBlock,
  bulletinBlock,
  sourceWording,
} from "./hymn-model.js";
import { nextPlay, playbackStop, shuffleTracks, songsFromNumber, songsWithEndings, themeTracks, trackFrom, tracksForHymns } from "./playlist.js";
import { sendListen } from "./listen.js";
import { gaEvent, gaPage, gaUserProps, hymnParams, likedBucket, progressMarks, startAnalytics } from "./ga.js";
import { stageCorner, stageMostlyOff, stagePlacement, stagePointerMove } from "./stage.js";
import { requestConfig, requestsOpen } from "./config/requests.js";
import { pushBlockReason, pushConfig, pushOpen, urlBase64ToBytes } from "./config/push.js";
import {
  RETURNING_KEY,
  everyTextPublicDomain,
  exampleHymns,
  featuredHymns,
  searchTarget,
  seasonLinks,
  seasonOn,
  statItems,
  welcomeCopy,
  welcomeStats,
} from "./welcome.js";

const homeBar = document.getElementById("home-bar");
const hymnBar = document.getElementById("hymn-bar");
const main = document.getElementById("main");
const searchForm = document.getElementById("search-form");
const queryInput = document.getElementById("q");
const clearButton = document.getElementById("clear");
const chips = document.getElementById("chips");
const tabs = document.getElementById("tabs");
const count = document.getElementById("count");
const countRow = document.getElementById("count-row");
const bubble = document.getElementById("jump-bubble");
const themeButtons = [
  document.getElementById("theme-home"),
  document.getElementById("theme-hymn"),
];

const TAB_IDS = [
  ["tab-number", "number"],
  ["tab-title", "title"],
  ["tab-author", "author"],
  ["tab-liked", "liked"],
  ["tab-themes", "themes"],
  ["tab-sins", "sins"],
  ["tab-requests", "requests"],
];

const scrollMemory = { number: 0, title: 0, author: 0, liked: 0, themes: 0, sins: 0, requests: 0, welcome: 0 };

// Set in index.html before the first paint. The bare address keeps opening on
// the same view for as long as this page is loaded, so Back from a hymn
// returns to the page the reader left.
const opensOnWelcome = document.documentElement.dataset.entry === "welcome";
let hymns = [];
let changelog = [];
let bulletinImages = {};
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
    pause: "M8 6v12M16 6v12",
    next: "M9.5 5.5 16 12l-6.5 6.5",
    close: "M7 7l10 10M17 7 7 17",
    arrow: "M5 12h14M13 6l6 6-6 6",
    search: "M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM15.3 15.3 20 20",
    play: "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM10 8.6v6.8l5.4-3.4z",
    note: "M9 17.5V6l10-2v11.5M9 17.5a2.5 2 0 1 1-5 0 2.5 2 0 0 1 5 0zM19 15.5a2.5 2 0 1 1-5 0 2.5 2 0 0 1 5 0z",
    star: "M12 3.5l2.5 5.4 5.9.7-4.4 4 1.2 5.9L12 16.6l-5.2 2.9L8 13.6l-4.4-4 5.9-.7z",
    book: "M12 6.5c-1.8-1.3-4.2-1.8-7.5-1.5v12.5c3.3-.3 5.7.2 7.5 1.5m0-12.5c1.8-1.3 4.2-1.8 7.5-1.5v12.5c-3.3-.3-5.7.2-7.5 1.5m0-12.5V19",
    phone: "M8.5 3.5h7A1.5 1.5 0 0 1 17 5v14a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 19V5a1.5 1.5 0 0 1 1.5-1.5zM12 8v6.5M9.5 12l2.5 2.5 2.5-2.5",
    chat: "M5 5.5h14A1.5 1.5 0 0 1 20.5 7v8a1.5 1.5 0 0 1-1.5 1.5h-7L7.5 20v-3.5H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5z",
    seal: "M12 3.5 5.5 6v5.5c0 4 2.7 7.2 6.5 8.8 3.8-1.6 6.5-4.8 6.5-8.8V6zM9 12l2.2 2.2 3.9-4.2",
    heart: "M12 20s-6.5-4.2-6.5-8.6C5.5 8.2 7.4 6.4 9.6 6.4c1.2 0 2.2.6 2.4 1.6.2-1 1.2-1.6 2.4-1.6 2.2 0 4.1 1.8 4.1 5C18.5 15.8 12 20 12 20z",
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
  gaUserProps({ theme: next });
}

function route() {
  const hash = location.hash;
  if ((hash === "" || hash === "#") && opensOnWelcome) return { view: "welcome" };
  const path = (hash || "#/").replace(/^#/, "").split("?")[0] || "/";
  if (path === "/welcome") return { view: "welcome" };
  if (path === "/" || path === "/number") return { view: "index", index: "number" };
  if (path === "/title") return { view: "index", index: "title" };
  if (path === "/author") return { view: "index", index: "author" };
  if (path === "/liked") return { view: "index", index: "liked" };
  if (path === "/themes") return { view: "themes" };
  if (path === "/sins") return { view: "sins" };
  if (path === "/comments") {
    location.replace("#/requests");
    return { view: "requests" };
  }
  if (path === "/requests") return { view: "requests" };
  if (path === "/install") return { view: "install" };
  if (path === "/whats-new") return { view: "whats-new" };
  const themeMatch = path.match(/^\/theme\/([a-z0-9-]+)\/?$/);
  if (themeMatch) return { view: "theme", id: themeMatch[1] };
  const match = path.match(/^\/hymn\/(\d+)\/?$/);
  if (match) return { view: "hymn", number: Number(match[1]) };
  return { view: "index", index: "number" };
}

function indexHref(index) {
  if (index === "title") return "#/title";
  if (index === "author") return "#/author";
  if (index === "liked") return "#/liked";
  if (index === "themes") return "#/themes";
  if (index === "sins") return "#/sins";
  if (index === "comments" || index === "requests") return "#/requests";
  if (index === "welcome") return "#/welcome";
  if (index === "whats-new") return "#/whats-new";
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
      stored === "liked" ||
      stored === "number" ||
      stored === "themes" ||
      stored === "sins" ||
      stored === "requests" ||
      stored === "welcome" ||
      stored === "whats-new"
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
  return total === 1 ? "1 song" : `${total} songs`;
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

function likeIcon(filled) {
  const svg = icon("heart");
  const path = svg.querySelector("path");
  path.setAttribute("fill", filled ? "currentColor" : "none");
  return svg;
}

function likeMark(number) {
  if (!isLiked(number)) return null;
  const mark = el("span", { class: "like-pip" });
  mark.append(likeIcon(true), el("span", { class: "visually-hidden" }, "Liked"));
  return mark;
}

function paintLikeButton(button, number) {
  const state = likeButtonState(isLiked(number));
  button.setAttribute("aria-pressed", state.pressed ? "true" : "false");
  button.setAttribute("aria-label", state.label);
  button.classList.toggle("is-liked", state.pressed);
  button.replaceChildren(likeIcon(state.pressed), el("span", {}, state.text));
}

function likeControl(number) {
  const button = el("button", { type: "button", class: "like-btn" });
  paintLikeButton(button, number);
  button.addEventListener("click", () => {
    const result = toggleLike(number);
    paintLikeButton(button, number);
    noteLike(number, result);
  });
  return button;
}

function hymnRow(hymn, mark) {
  const link = el("a", { class: "hymn-link", href: `#/hymn/${hymn.number}` });
  link.append(el("span", { class: "num" }, numberLabel(hymn)));
  const text = el("span", { class: "hymn-link-text" });
  const title = el("span", { class: "title" }, hymn.title);
  if (mark) title.append(el("span", { class: "badge" }, mark));
  const heart = likeMark(hymn.number);
  if (heart) title.append(heart);
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
      const heart = likeMark(hymn.number);
      if (heart) text.append(heart);
      if (hymn.tune) text.append(el("span", { class: "toc-tune" }, hymn.tune));
      link.append(text, el("span", { class: "toc-num" }, numberLabel(hymn)));
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

function autoPlayButton() {
  const auto = el(
    "button",
    {
      type: "button",
      class: "play-auto",
      "aria-pressed": autoPlayAll() ? "true" : "false",
    },
    "Auto play all",
  );
  auto.addEventListener("click", () => setAutoPlayAll(!autoPlayAll()));
  return auto;
}

function playRow(tracks, lead) {
  const row = el("p", { class: "play-all" });
  if (lead) row.append(lead);
  if (tracks.length) {
    const all = el("button", { type: "button", class: "play-song" }, "Play all");
    const shuffle = el("button", { type: "button", class: "play-song" }, "Shuffle");
    all.addEventListener("click", () => {
      gaEvent("play_all", { list_size: tracks.length });
      beginSongs(tracks, "all");
    });
    shuffle.addEventListener("click", () => {
      gaEvent("shuffle", { list_size: tracks.length });
      beginSongs(shuffleTracks(tracks), "all");
    });
    row.append(all, shuffle);
  }
  row.append(autoPlayButton());
  return row;
}

function playAllControls(themeId) {
  if (!themeId) return null;
  const tracks = themeTracks({
    hymns,
    themes: themeCatalog,
    recordings: recordingCatalog,
    themeId,
  });
  if (!tracks.length) return null;
  return playRow(tracks);
}

function listPlayControls(hymnList) {
  if (!hymnList || hymnList.length === 0) return null;
  return playRow(tracksForHymns({ hymns: hymnList, recordings: recordingCatalog }));
}

// The recording the button at the top of a hymn page starts: the newest one
// from a Faith Presbyterian service, or else the first choir recording that
// can play inside Hark. On a hymn sung to more than one melody it is the
// newest recording of the hymnal's own melody.
function topRecording(hymn) {
  const playable = (item) => item && item.kind === "youtube" && item.id && item.embeddable !== false;
  const heard = playOrder(hymn, faithRecordings(recordingCatalog, hymn.number));
  if (heard.length) return playable(heard[0]) ? heard[0] : null;
  return listRecordings(hymn).find(playable) || null;
}

// A small colored tag that names a melody. The same tag is on each group of
// recordings and on the player, so the two can be matched at a glance.
function melodyTag(index, text) {
  return el("span", { class: "melody-tag", "data-melody": String(index || 0) }, text);
}

function hymnPlayControls(hymn) {
  const item = topRecording(hymn);
  const lead = item ? playControl(hymn, item, "Play song") : null;
  const row = playRow(songsFromNumber(endingSongs(), hymn.number), lead);
  const heard = faithRecordings(recordingCatalog, hymn.number);
  const caption = item ? playSongCaption(hymn, heard, item) : "";
  if (!caption) return row;
  const group = melodyGroups(hymn, heard).find((entry) => entry.tune === item.tune);
  const wrap = el("div", { class: "play-top" });
  row.classList.add("play-all-captioned");
  wrap.append(
    row,
    el("p", { class: "play-caption" }, [melodyTag(group.index, `Melody ${group.index}`), " ", caption]),
  );
  return wrap;
}

function hymnsOnScreen(index, result) {
  if (index === "title") return result.letters.flatMap((bucket) => bucket.hymns);
  if (index === "author") {
    return result.letters.flatMap((bucket) =>
      bucket.groups.flatMap((group) => group.hymns.map((item) => item.hymn)),
    );
  }
  return result.hymns;
}

function listWithPlay(node, hymnList) {
  const play = listPlayControls(hymnList);
  if (!play) return node;
  const wrap = el("div", { class: "list-play" });
  wrap.append(play, node);
  return wrap;
}

function autoPlayAll() {
  try {
    return localStorage.getItem("hark-auto-play-all") === "1";
  } catch {
    return false;
  }
}

function setAutoPlayAll(on) {
  try {
    localStorage.setItem("hark-auto-play-all", on ? "1" : "0");
  } catch {
    /* storage can be blocked */
  }
  for (const button of document.querySelectorAll(".play-auto")) {
    button.setAttribute("aria-pressed", on ? "true" : "false");
  }
}

function endingSongs() {
  return songsWithEndings({ hymns, recordings: recordingCatalog });
}

function selectedThemeId() {
  const seasons = themeCatalog.seasons || [];
  const chosen = seasons.find((item) => item.id !== "all-year" && (item.title === section || item.id === section));
  if (chosen) return chosen.id;
  const now = seasonOn(new Date());
  return now.id || "all-year";
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
  details.append(summary);
  summary.addEventListener("click", () => {
    if (!details.open) gaEvent("theme_open", { theme: group.title });
  });
  const play = playAllControls(group.id);
  if (play) details.append(play);
  details.append(themeHymnList(group.hymns));
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
  countRow.hidden = !shown;
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
    main.replaceChildren(el("p", { class: "empty" }, "No songs match that search."));
  } else {
    const root = el("div", { class: "themes" });
    const jumps = [...outline.seasons, ...outline.topics];
    if (jumps.length) root.append(themeJump(jumps));
    const listed = playAllControls(selectedThemeId());
    if (listed) root.append(listed);
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
  const straight = playAllControls(id);
  if (straight) page.append(straight);
  if (list.length === 0) page.append(el("p", { class: "empty" }, "No songs match that search."));
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
  if (index === "liked") {
    const saved = likedHymns(hymns);
    const list = filterHymns(saved, queryInput.value, section);
    count.textContent = countLabel(list.length);
    main.classList.remove("has-jump");
    if (saved.length === 0) {
      main.replaceChildren(
        el("p", { class: "empty" }, "No liked songs yet. Open a song and press the heart to keep it here."),
      );
    } else if (list.length === 0) {
      main.replaceChildren(el("p", { class: "empty" }, "No songs match that search."));
    } else {
      main.replaceChildren(listWithPlay(numberList(list), list));
    }
    document.title = "Liked · Hark";
    const y = scrollMemory.liked || 0;
    requestAnimationFrame(() => window.scrollTo(0, y));
    return;
  }
  const result = browse(hymns, { query: queryInput.value, section, mode: index });
  count.textContent = countLabel(result.total);
  main.classList.toggle("has-jump", index !== "number" && result.total > 0);
  if (result.total === 0) {
    main.replaceChildren(el("p", { class: "empty" }, "No songs match that search."));
  } else if (index === "title") {
    const shown = hymnsOnScreen(index, result);
    main.replaceChildren(listWithPlay(titleList(result.letters), shown), jumpBar(result.letters));
  } else if (index === "author") {
    const shown = hymnsOnScreen(index, result);
    main.replaceChildren(listWithPlay(authorList(result.letters), shown), jumpBar(result.letters));
  } else {
    main.replaceChildren(listWithPlay(numberList(result.hymns), result.hymns));
  }
  document.title =
    index === "title" ? "Titles · Hark" : index === "author" ? "Authors · Hark" : "Hark";
  const y = scrollMemory[index] || 0;
  requestAnimationFrame(() => window.scrollTo(0, y));
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

function playControl(hymn, item, label = "Play this song") {
  const button = el("button", { type: "button", class: "play-song" }, label);
  button.addEventListener("click", () => {
    const heard = faithRecordings(recordingCatalog, hymn.number);
    beginSongs([trackFrom(hymn, item, playbackStop(item, hymn), heard)], "one");
  });
  return button;
}

function faithCard(hymn, item, openPlayer) {
  const figure = el("figure", { class: "faith-item" });
  if (item.date) figure.append(el("p", { class: "faith-date" }, item.date));
  figure.append(el("p", { class: "faith-label" }, recordingCaption(item)));
  if (item.kind === "youtube" && item.embeddable === false) {
    const player = mountYoutube(item);
    if (player) figure.append(player);
  } else if (item.kind === "youtube" && item.id) {
    figure.append(playControl(hymn, item));
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
    link.setAttribute("aria-label", `Play on YouTube, ${recordingCaption(item)}`);
    figure.append(link);
  }
  return figure;
}

// One melody of a hymn sung to more than one: a heading that names it, a line
// in plain words, a button that plays its newest recording, then the
// recordings themselves, newest first.
function melodyGroup(hymn, group) {
  const box = el("section", {
    class: "melody-group",
    "data-melody": String(group.index),
    "aria-label": group.heading,
  });
  const colon = group.heading.indexOf(": ");
  const heading = el("h3", { class: "melody-heading" });
  if (colon > 0) {
    heading.append(melodyTag(group.index, group.heading.slice(0, colon)), " ", group.heading.slice(colon + 2));
  } else {
    heading.append(group.heading);
  }
  box.append(heading, el("p", { class: "melody-about" }, group.description));
  const playable = group.items.find((item) => item.kind === "youtube" && item.id && item.embeddable !== false);
  if (playable) {
    const play = playControl(hymn, playable, "Play this melody");
    play.classList.add("melody-play");
    if (group.tune) play.setAttribute("aria-label", `Play this melody, ${group.tune}`);
    box.append(el("p", { class: "melody-play-row" }, play));
  }
  const total = group.items.length;
  const list = el("details", { class: "earlier" });
  list.append(el("summary", {}, total === 1 ? "Show the recording" : `Show all ${total} recordings`));
  for (const item of group.items) list.append(faithCard(hymn, item, false));
  box.append(list);
  return box;
}

// The melodies of a hymn sung to more than one, near the top of the page:
// under the play buttons and above the words. Each group stays closed, so the
// words still start soon. A hymn with one melody has no such block.
function melodyTop(hymn) {
  const groups = melodyGroups(hymn, faithRecordings(recordingCatalog, hymn.number));
  if (!groups.length) return null;
  const sectionEl = el("section", {
    class: "melody-top",
    id: "melody-top",
    tabindex: "-1",
    "aria-label": "Recordings at Faith Presbyterian, by melody",
  });
  for (const group of groups) sectionEl.append(melodyGroup(hymn, group));
  return sectionEl;
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
  // A hymn sung to more than one melody has its recordings at the top of the
  // page, grouped by melody. Here a button leads back up to them.
  if (melodyGroups(hymn, items).length) {
    const up = el("button", { type: "button", class: "melody-up" }, "Go to the melodies");
    up.addEventListener("click", () => {
      const top = document.getElementById("melody-top");
      if (!top) return;
      top.scrollIntoView({ block: "start" });
      top.focus({ preventScroll: true });
    });
    sectionEl.append(el("p", { class: "melody-up-row" }, up));
    return sectionEl;
  }
  sectionEl.append(faithCard(hymn, items[0], true));
  if (items.length > 1) {
    const details = el("details", { class: "earlier" });
    const older = items.length - 1;
    details.append(
      el("summary", {}, older === 1 ? "1 earlier recording" : `${older} earlier recordings`),
    );
    for (const item of items.slice(1)) details.append(faithCard(hymn, item, false));
    sectionEl.append(details);
  }
  return sectionEl;
}

function recordingSection(hymn) {
  const items = listRecordings(hymn);
  if (items.length === 0) return null;
  const sectionEl = el("section", { class: "recordings" });
  sectionEl.append(el("h2", {}, "Choir"));
  for (const item of items) {
    if (item.kind === "youtube" && item.id && item.embeddable !== false) {
      sectionEl.append(faithCard(hymn, item, false));
    } else {
      sectionEl.append(mediaFigure(item));
    }
  }
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
  link.setAttribute("aria-label", `${word} hymn, ${numberedTitle(hymn, " ")}`);
}

function endLink(hymn, direction) {
  if (!hymn) return null;
  const word = direction === "prev" ? "Previous" : "Next";
  const link = el("a", {
    href: `#/hymn/${hymn.number}`,
    class: direction === "next" ? "next" : "prev",
    "aria-label": `${word} hymn, ${numberedTitle(hymn, " ")}`,
  });
  link.append(
    el("span", { class: "end-kicker" }, word),
    el("span", { class: "end-num" }, numberLabel(hymn)),
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
  const wording = sourceWording(hymn);
  if (score) {
    const details = el("details", { class: "music-block" });
    details.append(el("summary", {}, "Music"));
    details.append(
      el(
        "p",
        { class: "music-credit" },
        [`Tune: ${score.tune}.`, `Harmony: ${score.harmony_credit}.`, wording.setting].filter(Boolean).join(" "),
      ),
    );
    const which = scoreMelodyNote(hymn, faithRecordings(recordingCatalog, hymn.number), score.tune);
    if (which) details.append(el("p", { class: "music-credit music-which" }, which));
    // A hymn sung to a second tune says why that tune has no score here.
    for (const other of Array.isArray(score.also) ? score.also : []) {
      if (other && other.reason) details.append(el("p", { class: "music-credit" }, other.reason));
    }
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
      gaEvent("score_play", hymnParams(hymn));
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
    if (wording.music) box.append(el("p", {}, wording.music));
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
  let backLabel = "Songs";
  let listName = "song list";
  if (listIndex === "welcome") [backLabel, listName] = ["Welcome", "welcome page"];
  else if (listIndex === "requests") [backLabel, listName] = ["Comments/Requests", "comments and requests"];
  else if (listIndex === "sins") [backLabel, listName] = ["Sins", "Sins page"];
  else if (fromThemes) [backLabel, listName] = ["Themes", "themes"];
  else if (listIndex === "title") listName = "title index";
  else if (listIndex === "author") listName = "author index";
  else if (listIndex === "liked") [backLabel, listName] = ["Liked", "liked songs"];
  else if (listIndex === "whats-new") [backLabel, listName] = ["What's New", "What's New page"];
  back.replaceChildren(icon("back"), document.createTextNode(backLabel));
  back.setAttribute("aria-label", `Back to the ${listName}`);

  const found = neighbors(hymns, number);
  setPager(document.getElementById("prev-link"), found.prev, "prev");
  setPager(document.getElementById("next-link"), found.next, "next");
  document.getElementById("pager-num").textContent = found.hymn ? numberLabel(found.hymn) : "";

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
    markReturning();
    document.title = `${numberedTitle(hymn, " ")} · Hark`;
    const article = el("article", { class: "hymn" });
    if (inHymnal(hymn)) article.append(el("p", { class: "hymn-number" }, `No. ${hymn.number}`));
    const title = el("h1", { class: "hymn-title", id: "hymn-title", tabindex: "-1" }, hymn.title);
    const head = el("div", { class: "hymn-head" });
    head.append(title, likeControl(hymn.number));
    article.append(head);
    const credit = attributionParts(hymn);
    if (credit.people) article.append(el("p", { class: "attribution" }, credit.people));
    if (credit.music) article.append(el("p", { class: "attribution" }, credit.music));
    const chipsForHymn = themeChips(hymn);
    if (chipsForHymn) article.append(chipsForHymn);
    article.append(hymnPlayControls(hymn));
    if (songOnThisHymn(hymn)) article.append(el("div", { id: "song-dock", class: "song-dock" }));
    const melodies = melodyTop(hymn);
    if (melodies) article.append(melodies);

    const heard = faithSection(hymn);
    const choir = recordingSection(hymn);

    if (wordsPending(hymn)) {
      // Listed from a bulletin so it can be found by number or title. Say that
      // plainly rather than showing an empty page.
      const notice = el("div", { class: "notice" });
      notice.append(el("h2", {}, "Words not added yet"));
      notice.append(
        el("p", {}, "This hymn is here because the congregation sings it. The words are still to come."),
      );
      const wordsLine = sourceWording(hymn).words;
      if (wordsLine) notice.append(el("p", {}, wordsLine));
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

    const bulletin = bulletinNote(hymn);
    if (bulletin) article.append(bulletin);

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
    const colophon = sourceWording(hymn).colophon;
    if (colophon) article.append(el("p", { class: "colophon" }, colophon));
    main.replaceChildren(article);
  }

  window.scrollTo(0, 0);
  const heading = document.getElementById("hymn-title");
  if (heading) heading.focus({ preventScroll: true });
}

function bulletinNote(hymn) {
  const bulletin = bulletinBlock(hymn, bulletinImages);
  if (!bulletin) return null;
  const figure = el("figure", { class: "bulletin-note" });
  const open = { href: bulletin.url, target: "_blank", rel: "noopener noreferrer" };
  const count = () => gaEvent("bulletin_click", hymnParams(hymn));
  const link = el("a", open, bulletin.label);
  link.addEventListener("click", count);
  figure.append(el("p", {}, link));
  if (bulletin.image) {
    // A picture, not the PDF in a frame: a phone browser shows a frame with a
    // PDF in it as an empty box.
    const picture = el("img", {
      src: new URL(bulletin.image.src, import.meta.url).href,
      alt: bulletin.image.alt,
      width: bulletin.image.width,
      height: bulletin.image.height,
      loading: "lazy",
      decoding: "async",
    });
    const preview = el("a", { ...open, class: "bulletin-preview" }, picture);
    preview.addEventListener("click", count);
    // The file did not come: leave the text link alone, with no broken picture.
    picture.addEventListener("error", () => preview.remove());
    figure.append(preview);
  }
  return figure;
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
      // Only the fact of a sent form is counted. The name and message never go to analytics.
      gaEvent("request_submit");
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

// Opening a hymn is what makes a reader a returning one. From the next visit
// on, the bare address goes straight to the hymns.
function markReturning() {
  try {
    localStorage.setItem(RETURNING_KEY, "1");
  } catch {
    /* ignore private mode */
  }
}

function arrowLink(href, label, className) {
  return el("a", { class: className || "more-link", href }, [label, icon("arrow")]);
}

function welcomeSearch() {
  const copy = welcomeCopy.search;
  const form = el("form", { class: "welcome-search", role: "search" });
  const input = el("input", {
    id: "welcome-q",
    type: "search",
    placeholder: copy.placeholder,
    autocomplete: "off",
    autocapitalize: "off",
    autocorrect: "off",
    spellcheck: "false",
    enterkeyhint: "go",
  });
  form.append(
    el("label", { class: "visually-hidden", for: "welcome-q" }, copy.label),
    input,
    el("button", { type: "submit" }, copy.button),
  );
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const target = searchTarget(hymns, input.value);
    noteSearch(input.value, true);
    queryInput.value = target.query;
    clearButton.hidden = target.query.length === 0;
    scrollMemory.number = 0;
    location.hash = target.hash;
  });
  return form;
}

// The part of the welcome page that needs nothing from the data files, so it
// can be on screen before they arrive.
function welcomeShell() {
  const copy = welcomeCopy;
  const page = el("div", { class: "welcome" });
  const hero = el("section", { class: "welcome-hero", "aria-labelledby": "welcome-title" });
  const intro = el("div", { class: "welcome-intro" });
  intro.append(
    el("img", { class: "welcome-mark", src: "favicon.svg", width: "56", height: "56", alt: "" }),
    el("h2", { class: "welcome-title", id: "welcome-title" }, copy.title),
    el("p", { class: "welcome-lead" }, copy.lead),
  );
  const actions = el("div", { class: "welcome-actions" });
  actions.append(
    el("a", { class: "btn btn-primary", href: "#/" }, copy.actions.browse),
    el("a", { class: "btn", href: "#/themes" }, copy.actions.seasons),
  );
  if (!runningAsApp()) {
    const install = el("a", { class: "btn btn-install", href: "#/install" }, copy.actions.install);
    install.addEventListener("click", installClick);
    actions.append(install);
  }
  actions.append(el("a", { class: "btn", href: "#/requests" }, copy.actions.request));
  intro.append(actions, welcomeSearch());
  hero.append(intro, el("div", { class: "welcome-today", "data-slot": "today" }));
  page.append(hero, el("div", { class: "welcome-rest", "data-slot": "rest" }));
  return page;
}

function todayCard(pick) {
  const copy = welcomeCopy.today;
  const hymn = pick.hymn;
  const card = el("article", { class: "today-card" });
  card.append(el("p", { class: "kicker" }, copy.kicker));
  if (inHymnal(hymn)) card.append(el("p", { class: "today-number" }, `No. ${hymn.number}`));
  card.append(el("h3", { class: "today-title" }, el("a", { href: `#/hymn/${hymn.number}` }, hymn.title)));
  if (pick.lines.length) card.append(linesEl(pick.lines, "today-lines"));
  const credit = attributionParts(hymn);
  if (credit.people) card.append(el("p", { class: "today-credit" }, credit.people));
  // The title is the link, stretched over the card. This line is the cue.
  card.append(
    el("span", { class: "more-link today-cue", "aria-hidden": "true" }, [copy.link, icon("arrow")]),
  );
  return card;
}

function welcomeFacts() {
  const copy = welcomeCopy;
  const items = statItems(welcomeStats({ hymns, recordings: recordingCatalog, music: musicCatalog }));
  const claim = everyTextPublicDomain(hymns);
  if (items.length === 0 && !claim) return null;
  const panel = el("section", { class: "welcome-facts", "aria-labelledby": "welcome-facts-title" });
  panel.append(el("h2", { class: "visually-hidden", id: "welcome-facts-title" }, copy.stats.heading));
  if (items.length) {
    const list = el("dl", { class: "welcome-stats" });
    for (const item of items) {
      list.append(
        el("div", { class: "stat" }, [el("dt", {}, item.label), el("dd", {}, String(item.value))]),
      );
    }
    panel.append(list);
  }
  if (claim) {
    const note = el("div", { class: "welcome-pd" });
    note.append(
      icon("seal"),
      el("p", {}, [el("strong", {}, copy.publicDomain.claim), " ", copy.publicDomain.detail]),
    );
    panel.append(note);
  }
  return panel;
}

function welcomeFeatured(feature) {
  const copy = welcomeCopy.featured;
  const rest = feature.hymns.slice(1);
  if (rest.length === 0 && !feature.upcoming) return null;
  const block = el("section", { class: "welcome-section", "aria-labelledby": "welcome-featured-title" });
  const title = feature.theme ? feature.theme.title : "";
  const kicker =
    feature.kind === "season" ? copy.seasonKicker : feature.kind === "year" ? copy.yearKicker : copy.plainKicker;
  const heading =
    feature.kind === "season"
      ? copy.seasonHeading(title)
      : feature.kind === "year"
        ? copy.yearHeading
        : copy.plainHeading;
  const head = el("div", { class: "section-head" });
  const titleBlock = el("div", {}, [
    el("p", { class: "kicker" }, kicker),
    el("h2", { class: "section-title", id: "welcome-featured-title" }, heading),
  ]);
  if (feature.theme) {
    const play = playAllControls(feature.theme.id);
    if (play) titleBlock.append(play);
  }
  head.append(titleBlock);
  if (feature.theme) {
    const label = feature.kind === "season" ? copy.seasonLink(title) : copy.yearLink(title);
    head.append(arrowLink(`#/theme/${feature.theme.id}`, label));
  } else head.append(arrowLink("#/", welcomeCopy.actions.browse));
  block.append(head);
  if (rest.length) {
    block.append(
      el(
        "ul",
        { class: "hymn-list featured-list" },
        rest.map((pick) => hymnRow(pick.hymn)),
      ),
    );
  }
  if (feature.upcoming) {
    const next = feature.upcoming.theme;
    block.append(
      el("p", { class: "upcoming" }, [
        icon("star"),
        el("span", {}, copy.upcoming(next.title, feature.upcoming.when)),
        arrowLink(`#/theme/${next.id}`, copy.upcomingLink(next.title)),
      ]),
    );
  }
  return block;
}

function welcomeFeatures(examples) {
  const copy = welcomeCopy.features;
  const block = el("section", { class: "welcome-section", "aria-labelledby": "welcome-features-title" });
  block.append(el("h2", { class: "section-title", id: "welcome-features-title" }, copy.heading));
  const grid = el("ul", { class: "feature-grid" });
  for (const item of copy.items) {
    let href = item.href;
    let label = item.link;
    if (item.id === "hear" || item.id === "music") {
      // These two only appear when there is a hymn that has what they promise.
      const hymn = item.id === "hear" ? examples.recorded : examples.score;
      if (!hymn) continue;
      href = `#/hymn/${hymn.number}`;
      label = item.link(hymn);
    }
    const tile = el("li", { class: "feature" });
    tile.append(
      el("span", { class: "feature-icon" }, icon(item.icon)),
      el("h3", {}, item.title),
      el("p", {}, item.text),
      arrowLink(href, label),
    );
    grid.append(tile);
  }
  block.append(grid);
  return block;
}

function welcomeSeasons() {
  const copy = welcomeCopy.seasons;
  const seasons = seasonLinks(themeCatalog, hymns);
  if (seasons.length === 0) return null;
  const block = el("section", { class: "welcome-section", "aria-labelledby": "welcome-seasons-title" });
  const head = el("div", { class: "section-head" });
  head.append(
    el("h2", { class: "section-title", id: "welcome-seasons-title" }, copy.heading),
    arrowLink("#/themes", copy.all),
  );
  block.append(head);
  block.append(
    el(
      "ul",
      { class: "season-links" },
      seasons.map((season) => el("li", {}, el("a", { href: `#/theme/${season.id}` }, season.title))),
    ),
  );
  return block;
}

function welcomeClosing() {
  const copy = welcomeCopy;
  const block = el("section", { class: "welcome-closing", "aria-labelledby": "welcome-request-title" });
  block.append(
    el("span", { class: "feature-icon" }, icon("chat")),
    el("h2", { class: "section-title", id: "welcome-request-title" }, copy.request.heading),
    el("p", {}, copy.request.text),
    el("a", { class: "btn btn-primary", href: "#/requests" }, copy.request.button),
  );
  return block;
}

// Everything on the welcome page that is counted or chosen from the data.
function fillWelcome(page) {
  const feature = featuredHymns({
    hymns,
    themes: themeCatalog,
    recordings: recordingCatalog,
    music: musicCatalog,
    date: new Date(),
  });
  const today = page.querySelector('[data-slot="today"]');
  today.replaceChildren(...(feature.hymns.length ? [todayCard(feature.hymns[0])] : []));
  const examples = exampleHymns({
    hymns,
    recordings: recordingCatalog,
    music: musicCatalog,
    prefer: feature.hymns.map((pick) => pick.hymn),
  });
  const parts = [
    welcomeFacts(),
    welcomeFeatured(feature),
    welcomeFeatures(examples),
    welcomeSeasons(),
    welcomeClosing(),
    el("p", { class: "welcome-about" }, welcomeCopy.about),
    el("p", { class: "colophon" }, "Trinity Hymnal, 1990"),
    el("p", { class: "welcome-privacy", id: "privacy" }, welcomeCopy.privacy),
  ];
  page.querySelector('[data-slot="rest"]').replaceChildren(...parts.filter(Boolean));
}

function renderWelcome() {
  homeBar.hidden = false;
  hymnBar.hidden = true;
  setBrowseChrome(false, { hideTabs: true });
  activeIndex = "welcome";
  saveIndex("welcome");
  syncTabs("welcome");
  main.classList.remove("has-jump");
  main.removeAttribute("role");
  main.removeAttribute("aria-labelledby");
  count.textContent = "";
  document.title = welcomeCopy.documentTitle;
  // The first pass runs before the hymnal has loaded and the second after.
  // Keeping the page that is already there means a reader who has started
  // typing in the search box does not lose it.
  let page = main.querySelector(":scope > .welcome");
  const fresh = !page;
  if (fresh) {
    page = welcomeShell();
    main.replaceChildren(page);
  }
  if (ready) fillWelcome(page);
  if (fresh) {
    const y = ready ? scrollMemory.welcome || 0 : 0;
    requestAnimationFrame(() => window.scrollTo(0, y));
  }
}

function render() {
  const current = route();
  document.documentElement.dataset.view = current.view;
  if (!ready) {
    // The welcome page has words to show before the hymnal has loaded.
    if (current.view === "welcome") {
      renderWelcome();
      syncSticky();
    }
    return;
  }
  bubble.hidden = true;
  if (current.view === "welcome") renderWelcome();
  else if (current.view === "hymn") renderHymn(current.number);
  else if (current.view === "themes") renderThemes();
  else if (current.view === "theme") renderTheme(current.id);
  else if (current.view === "sins") renderSins();
  else if (current.view === "requests") renderRequests();
  else if (current.view === "install") renderInstall();
  else if (current.view === "whats-new") renderWhatsNew();
  else renderIndex(current.index);
  syncSticky();
  notePage(current);
  // A route change only replaces #main. The YouTube player stays in #song-bar,
  // which is outside that view, so playback is not paused, stopped, or rebuilt.
  holdPlayer();
}

// render() runs again for every keystroke in the search box and twice while
// the songbook loads, so a page is counted once each time the route changes.
let notedPath = null;
function notePage(current) {
  try {
    const path = location.hash || "#/";
    if (path === notedPath) return;
    if (!ready && !(current && current.view === "welcome")) return;
    notedPath = path;
    sendListen({ type: "page", path });
    gaPage(path, document.title);
    if (current && current.view === "theme") {
      const theme = findTheme(themeCatalog, current.id);
      if (theme) gaEvent("theme_open", { theme: theme.title });
    }
  } catch {
    /* counting must never affect the page */
  }
}

function hymnByNumber(number) {
  return hymns.find((hymn) => hymn.number === Number(number)) || { number: Number(number) };
}

function noteLike(number, result) {
  try {
    gaEvent(result.liked ? "like" : "unlike", hymnParams(hymnByNumber(number)));
    gaUserProps({ liked_count: likedBucket(result.likes.length) });
  } catch {
    /* counting must never affect the page */
  }
}

// A search is counted once the reader stops typing, not on every keystroke.
let searchTimer = 0;
let notedSearch = "";
function noteSearch(value, now) {
  try {
    window.clearTimeout(searchTimer);
    const term = String(value || "").trim().toLowerCase();
    if (!term) {
      notedSearch = "";
      return;
    }
    const send = () => {
      try {
        if (term === notedSearch) return;
        notedSearch = term;
        gaEvent("search", {
          search_term: term,
          results: filterHymns(hymns, term, "all").length,
        });
      } catch {
        /* ignore */
      }
    };
    if (now) send();
    else searchTimer = window.setTimeout(send, 1500);
  } catch {
    /* counting must never affect the page */
  }
}

function noteSelect(link) {
  try {
    if (!link.closest("#main")) return;
    const number = Number((link.getAttribute("href") || "").split("/")[2]);
    if (!Number.isInteger(number)) return;
    gaEvent("select_hymn", hymnParams(hymnByNumber(number), { list: activeIndex || "" }));
  } catch {
    /* counting must never affect the page */
  }
}

function noteSong(name, extra) {
  try {
    const track = currentSong();
    if (track) gaEvent(name, hymnParams(track, extra));
  } catch {
    /* counting must never affect playback */
  }
}

// listen_progress at 25, 50, 75, and 100 percent of the song's own span in
// the service video. Each mark is sent once for each play.
let progressSeen = new Set();
function noteProgress(track, now) {
  try {
    for (const mark of progressMarks(track, now, progressSeen)) {
      gaEvent("listen_progress", hymnParams(track, { percent: mark }));
    }
  } catch {
    /* counting must never affect playback */
  }
}

function analyticsUserProps() {
  const props = {};
  try {
    props.display_mode = runningAsApp() ? "standalone" : "browser";
    props.theme = appliedTheme();
    props.liked_count = likedBucket(readLikes().length);
  } catch {
    /* ignore */
  }
  return props;
}

function notePlay(track) {
  try {
    sendListen({ type: "play", hymn: track.number, path: location.hash || "#/" });
    gaEvent("play_start", hymnParams(track));
  } catch {
    /* counting must never affect playback */
  }
}

function noteBeat() {
  try {
    if (!ytPlayer || typeof ytPlayer.getPlayerState !== "function" || ytPlayer.getPlayerState() !== 1) return;
    const track = currentSong();
    if (!track) return;
    sendListen({ type: "beat", hymn: track.number, path: location.hash || "#/" });
    gaEvent("listening_heartbeat", { hymn_number: track.number, transport_type: "beacon" });
  } catch {
    /* counting must never affect playback */
  }
}

let listenTimer = 0;
function armHeartbeat() {
  try {
    window.clearInterval(listenTimer);
    listenTimer = 0;
    if (!ytPlayer || typeof ytPlayer.getPlayerState !== "function" || ytPlayer.getPlayerState() !== 1) return;
    listenTimer = window.setInterval(noteBeat, 60000);
  } catch {
    /* ignore */
  }
}

function holdPlayer() {
  if (!songBar || document.documentElement.dataset.player !== "on") return;
  songBar.hidden = false;
  // The player node stays where it was built. Only its position changes.
  placeStage();
  // A phone keeps the title and the play buttons in view when the player
  // already shows below them.
  if (songIsOpen() && (wideScreen() || !dockInView())) revealDock();
}

function songIsOpen() {
  const track = currentSong();
  if (!track || document.documentElement.dataset.player !== "on") return false;
  const current = route();
  return current.view === "hymn" && current.number === track.number;
}

function songOnThisHymn(hymn) {
  const track = currentSong();
  return Boolean(track && hymn && track.number === hymn.number && document.documentElement.dataset.player === "on");
}

function clearStagePosition() {
  if (!songStage) return;
  songStage.style.left = "";
  songStage.style.top = "";
  songStage.style.right = "";
  songStage.style.bottom = "";
  songStage.style.width = "";
  songStage.style.height = "";
}

function stickyOffset() {
  if (typeof getComputedStyle !== "function") return 0;
  try {
    const value = getComputedStyle(document.documentElement).getPropertyValue("--sticky-h");
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

function syncInlineStage() {
  const dock = document.getElementById("song-dock");
  if (!dock || !songStage || typeof dock.getBoundingClientRect !== "function") return;
  const rect = dock.getBoundingClientRect();
  songStage.style.left = `${rect.left}px`;
  songStage.style.top = `${rect.top}px`;
  songStage.style.width = `${rect.width}px`;
  songStage.style.height = `${rect.height}px`;
  songStage.style.right = "auto";
  songStage.style.bottom = "auto";
}

// True when the whole placeholder shows between the top bar and the player bar.
function dockInView() {
  const dock = document.getElementById("song-dock");
  if (!dock || typeof dock.getBoundingClientRect !== "function") return false;
  const rect = dock.getBoundingClientRect();
  const bar = songBar ? songBar.offsetHeight || 0 : 0;
  return rect.top >= stickyOffset() && rect.bottom <= (window.innerHeight || 0) - bar;
}

function revealDock() {
  const dock = document.getElementById("song-dock");
  if (!dock || typeof dock.getBoundingClientRect !== "function") return;
  const top = window.scrollY + dock.getBoundingClientRect().top - stickyOffset() - 8;
  window.scrollTo(0, Math.max(0, top));
  syncInlineStage();
}

// A computer browser, by the same width the wide page layouts use. A phone
// always pins the player above the words; only a computer can float it there.
const WIDE_SCREEN = "(min-width: 60rem)";
const PLACE_KEY = "hark-player-place";

function wideScreen() {
  try {
    return typeof window.matchMedia === "function" && window.matchMedia(WIDE_SCREEN).matches;
  } catch {
    return false;
  }
}

function placeChoice() {
  try {
    return localStorage.getItem(PLACE_KEY) === "float" ? "float" : "words";
  } catch {
    return "words";
  }
}

function setPlaceChoice(choice) {
  try {
    localStorage.setItem(PLACE_KEY, choice);
  } catch {
    /* storage can be blocked */
  }
}

// Puts the placeholder right above the words. Only the empty placeholder moves.
// The player itself is never moved in the page, so the video keeps playing.
function dockAboveWords() {
  const article = main && typeof main.querySelector === "function" ? main.querySelector("article.hymn") : null;
  if (!article) return;
  const dock = document.getElementById("song-dock") || el("div", { id: "song-dock", class: "song-dock" });
  const words = article.querySelector(".text");
  if (words) {
    if (dock.nextElementSibling !== words) words.before(dock);
    return;
  }
  if (dock.parentNode) return;
  const controls = article.querySelector(".play-all");
  if (controls) controls.after(dock);
  else article.append(dock);
}

function removeDock() {
  const dock = document.getElementById("song-dock");
  if (dock) dock.remove();
}

function syncPlaceButton(onSongPage) {
  if (!songPlace) return;
  songPlace.hidden = !onSongPage;
  const floating = placeChoice() === "float";
  songPlace.textContent = floating ? "Pin above words" : "Float player";
}

function placeStage() {
  if (!songStage || !songBar || document.documentElement.dataset.player !== "on") return;
  songBar.hidden = false;
  const onSongPage = songIsOpen();
  songOnPage = onSongPage;
  syncPlaceButton(onSongPage);
  document.documentElement.style.setProperty("--song-bar-h", `${songBar.offsetHeight || 0}px`);
  const place = stagePlacement({ wide: wideScreen(), onSongPage, choice: placeChoice() });
  if (place === "words") dockAboveWords();
  if (place !== "float") {
    document.documentElement.dataset.stage = "inline";
    clearStagePosition();
    syncInlineStage();
    return;
  }
  if (onSongPage) removeDock();
  document.documentElement.dataset.stage = "float";
  if (!document.documentElement.dataset.corner) document.documentElement.dataset.corner = "se";
  if (document.documentElement.dataset.dragging !== "1") clearStagePosition();
}

function syncStageToSong() {
  const track = currentSong();
  if (!track || document.documentElement.dataset.player !== "on") return;
  if (songIsOpen()) {
    placeStage();
    return;
  }
  // The reader was on the page of the song that just ended, so follow the music.
  if (songOnPage) {
    location.hash = `#/hymn/${track.number}`;
    return;
  }
  placeStage();
}

function stageScreen() {
  return {
    left: 0,
    top: 0,
    right: window.innerWidth || 0,
    bottom: window.innerHeight || 0,
  };
}

function stageSnapBounds() {
  const screen = stageScreen();
  const bar = songBar ? songBar.offsetHeight || 0 : 0;
  return {
    left: screen.left,
    top: screen.top,
    right: screen.right,
    bottom: Math.max(screen.top, screen.bottom - bar - 8),
  };
}

function showError() {
  homeBar.hidden = false;
  hymnBar.hidden = true;
  document.title = "Hark";
  main.replaceChildren(
    el("div", { class: "notice" }, [
      el("h2", {}, "The songbook did not open"),
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
    const [hymnResponse, recordingResponse, themeResponse, sinsResponse, sermonResponse, musicResponse, changelogResponse, bulletinResponse] = await Promise.all([
      fetch(new URL("data/hymns.json", import.meta.url)),
      fetch(new URL("data/recordings.json", import.meta.url)),
      fetch(new URL("data/themes.json", import.meta.url)),
      fetch(new URL("data/sins.json", import.meta.url)),
      fetch(new URL("data/sermons.json", import.meta.url)),
      fetch(new URL("data/music.json", import.meta.url)),
      fetch(new URL("data/changelog.json", import.meta.url)),
      // The pictures are an extra. The book opens without them.
      fetch(new URL("data/bulletins.json", import.meta.url)).catch(() => null),
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
    changelog = [];
    if (changelogResponse.ok) {
      const catalog = await changelogResponse.json();
      if (Array.isArray(catalog)) changelog = catalog;
    }
    bulletinImages = {};
    if (bulletinResponse && bulletinResponse.ok) {
      const catalog = await bulletinResponse.json().catch(() => null);
      if (catalog && typeof catalog === "object" && !Array.isArray(catalog)) bulletinImages = catalog;
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
  noteSearch(queryInput.value);
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
  if (link) {
    rememberScroll();
    noteSelect(link);
  }
  // About Hark opens the welcome page from the top, not where it was left.
  if (event.target.closest("#about-link")) scrollMemory.welcome = 0;
  if (event.target.closest("#whats-new-link")) scrollMemory["whats-new"] = 0;
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
    gaEvent("install_prompt");
    saved.prompt();
    await saved.userChoice;
  } catch {
    /* the browser already spent or dropped this prompt */
  }
  syncInstallButton();
  return true;
}

function renderWhatsNew() {
  homeBar.hidden = false;
  hymnBar.hidden = true;
  setBrowseChrome(false, { hideTabs: true });
  activeIndex = "whats-new";
  saveIndex("whats-new");
  syncTabs("whats-new");
  main.classList.remove("has-jump");
  main.removeAttribute("role");
  main.removeAttribute("aria-labelledby");
  count.textContent = "";
  document.title = "What's New · Hark";
  const page = el("article", { class: "whats-new" });
  page.append(el("p", { class: "theme-back" }, el("a", { href: "#/" }, "Songs")));
  page.append(el("h2", {}, "What's New"));
  page.append(el("p", { class: "whats-new-lead" }, "Hymns added to Hark, newest first."));
  const actions = el("p", { class: "whats-new-actions" });
  actions.append(el("a", { href: "feed.xml" }, "Subscribe (RSS)"));
  const notify = el("button", { type: "button", class: "notify-btn", id: "notify-page" }, "Notify me");
  notify.addEventListener("click", () => toggleNotify());
  actions.append(notify);
  page.append(actions);
  page.append(el("p", { class: "notify-status", id: "notify-status", hidden: true }));
  const byNumber = new Map(hymns.map((hymn) => [hymn.number, hymn]));
  const groups = groupChangelog(changelog);
  if (!groups.length) page.append(el("p", {}, "No hymns have been added yet."));
  for (const group of groups) {
    const section = el("section");
    section.append(el("h3", {}, changelogDateLabel(group.date)));
    for (const batch of group.batches) {
      if (batch.note) section.append(el("p", { class: "whats-new-note" }, batch.note));
      const list = el("ul");
      for (const number of batch.hymns) {
        const hymn = byNumber.get(number);
        if (!hymn) continue;
        list.append(
          el("li", {}, el("a", { href: `#/hymn/${hymn.number}` }, numberedTitle(hymn))),
        );
      }
      section.append(list);
    }
    page.append(section);
  }
  main.replaceChildren(page);
  paintNotify();
  const y = scrollMemory["whats-new"] || 0;
  requestAnimationFrame(() => window.scrollTo(0, y));
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
  page.append(el("p", { class: "theme-back" }, el("a", { href: "#/" }, "Songs")));
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
  gaEvent("app_installed");
  gaUserProps({ display_mode: "standalone" });
});

// Shared by the header link and the welcome page button.
function installClick(event) {
  if (runningAsApp()) return;
  if (installEvent) {
    event.preventDefault();
    promptInstall();
    return;
  }
  // No native prompt on this browser, so show the steps. If the dialog is not
  // supported the link falls through to the install page.
  if (openInstallHelp()) event.preventDefault();
}

let notifyOn = false;
let notifyMessage = "";

function notifyLabel() {
  return notifyOn ? "Stop notifications" : "Notify me";
}

function paintNotify() {
  for (const id of ["notify-link", "notify-page"]) {
    const node = document.getElementById(id);
    if (!node) continue;
    node.textContent = notifyLabel();
    node.setAttribute("aria-pressed", notifyOn ? "true" : "false");
  }
  const status = document.getElementById("notify-status");
  if (status) {
    status.hidden = !notifyMessage;
    status.textContent = notifyMessage;
  }
}

function pushSnapshot() {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints || 0,
    standalone: runningAsApp(),
    notification: "Notification" in window,
    pushManager: "PushManager" in window,
    serviceWorker: "serviceWorker" in navigator,
  };
}

async function refreshNotify() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    notifyOn = false;
    paintNotify();
    return;
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    notifyOn = Boolean(await registration.pushManager.getSubscription());
  } catch {
    notifyOn = false;
  }
  paintNotify();
}

async function toggleNotify() {
  const blocked = pushBlockReason(pushSnapshot());
  if (blocked) {
    notifyMessage = blocked;
    paintNotify();
    return;
  }
  if (!pushOpen()) {
    notifyMessage = "Notifications are not open yet.";
    paintNotify();
    return;
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      const endpoint = existing.endpoint;
      await existing.unsubscribe();
      notifyOn = false;
      notifyMessage = "";
      paintNotify();
      gaEvent("notify_unsubscribe");
      await fetch(new URL("/unsubscribe", pushConfig.endpoint), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint }),
      }).catch(() => {});
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      notifyMessage = "Notifications stay off until you allow them.";
      paintNotify();
      return;
    }
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToBytes(pushConfig.vapidPublicKey),
    });
    const body = subscription.toJSON();
    const response = await fetch(new URL("/subscribe", pushConfig.endpoint), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint: body.endpoint, keys: body.keys }),
    });
    if (!response.ok) {
      await subscription.unsubscribe();
      notifyOn = false;
      notifyMessage = "Notifications could not be saved. Try again.";
      paintNotify();
      return;
    }
    notifyOn = true;
    notifyMessage = "";
    paintNotify();
    gaEvent("notify_subscribe");
  } catch {
    notifyMessage = "Notifications could not be saved. Try again.";
    paintNotify();
  }
}

const songBar = document.getElementById("song-bar");
const songStage = document.getElementById("song-stage");
const songPlace = document.getElementById("song-place");
let songOnPage = false;
const songFloatHit = document.getElementById("song-float-hit");
const songFloatClose = document.getElementById("song-float-close");
const songTitle = document.getElementById("song-bar-title");
const songToggle = document.getElementById("song-toggle");
const songMelody = document.getElementById("song-bar-melody");
const songKeep = document.getElementById("song-keep");
let ytPlayer = null;
let songQueue = [];
let songIndex = 0;
let songMode = "one";
let songPoll = 0;
let songHolding = false;
let songPaused = false;

function loadYouTubeApi() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (loadYouTubeApi.promise) return loadYouTubeApi.promise;
  loadYouTubeApi.promise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previous === "function") previous();
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.append(script);
  });
  return loadYouTubeApi.promise;
}

function ensureSongPlayer() {
  if (ytPlayer && typeof ytPlayer.loadVideoById === "function") return Promise.resolve(ytPlayer);
  return loadYouTubeApi().then(
    () =>
      new Promise((resolve) => {
        if (ytPlayer && typeof ytPlayer.loadVideoById === "function") {
          resolve(ytPlayer);
          return;
        }
        ytPlayer = new window.YT.Player("song-player-host", {
          host: "https://www.youtube-nocookie.com",
          playerVars: {
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
            origin: location.origin,
          },
          events: {
            onReady: () => resolve(ytPlayer),
            onStateChange: onSongState,
          },
        });
      }),
  );
}

function currentSong() {
  return songQueue[songIndex] || null;
}

const NOW_PLAYING_ARTIST = "Faith Presbyterian Church Tacoma";

function publishNowPlaying(track) {
  const session = navigator.mediaSession;
  if (!session || !track || typeof MediaMetadata !== "function") return;
  try {
    session.metadata = new MediaMetadata({
      title: numberedTitle(track),
      artist: track.melody ? `${NOW_PLAYING_ARTIST} · ${melodyLabel(track.melody)}` : NOW_PLAYING_ARTIST,
      album: "Hark",
    });
  } catch {
    /* this browser rejected the metadata */
  }
  const handlers = {
    play: () => {
      if (!ytPlayer || typeof ytPlayer.playVideo !== "function") return;
      ytPlayer.playVideo();
      setToggleLabel(true);
    },
    pause: () => {
      if (!ytPlayer || typeof ytPlayer.pauseVideo !== "function") return;
      ytPlayer.pauseVideo();
      setToggleLabel(false);
    },
    nexttrack: () => stepSong(1),
  };
  for (const [name, handler] of Object.entries(handlers)) {
    try {
      session.setActionHandler(name, handler);
    } catch {
      /* this action is not supported here */
    }
  }
}

function clearNowPlaying() {
  const session = navigator.mediaSession;
  if (!session) return;
  try {
    session.metadata = null;
  } catch {
    /* ignore */
  }
  try {
    session.playbackState = "none";
  } catch {
    /* ignore */
  }
  for (const name of ["play", "pause", "nexttrack"]) {
    try {
      session.setActionHandler(name, null);
    } catch {
      /* ignore */
    }
  }
}

// The player says which melody is playing, in the color of its group on the
// hymn page. The floating video carries the same color on its edge.
function paintMelody(track) {
  const text = track ? melodyLabel(track.melody) : "";
  const index = text && track.melodyIndex ? String(track.melodyIndex) : "";
  if (songMelody) {
    songMelody.hidden = !text;
    songMelody.textContent = text;
    songMelody.dataset.melody = index || "0";
  }
  if (index) document.documentElement.dataset.melody = index;
  else delete document.documentElement.dataset.melody;
}

function paintSong() {
  const track = currentSong();
  if (!songBar || !track) return;
  songBar.hidden = false;
  document.documentElement.dataset.player = "on";
  songTitle.textContent = numberedTitle(track);
  paintMelody(track);
  setToggleLabel(true);
  publishNowPlaying(track);
}

function watchSong(track) {
  window.clearInterval(songPoll);
  songHolding = true;
  songPoll = window.setInterval(() => {
    if (!ytPlayer || currentSong() !== track) return;
    let now = 0;
    try {
      now = ytPlayer.getCurrentTime();
    } catch {
      return;
    }
    if (now >= track.start && now + 1 < track.end) songHolding = false;
    if (!songHolding) noteProgress(track, now);
    if (!songHolding && now + 0.25 >= track.end) finishSong();
  }, 400);
}

function loadSong() {
  const track = currentSong();
  if (!track || !ytPlayer) return;
  songHolding = true;
  songPaused = false;
  progressSeen = new Set();
  if (songKeep) songKeep.hidden = true;
  paintSong();
  ytPlayer.loadVideoById({
    videoId: track.videoId,
    startSeconds: track.start,
    endSeconds: track.end,
  });
  watchSong(track);
  syncStageToSong();
  notePlay(track);
  armHeartbeat();
}

function finishSong() {
  if (songHolding) return;
  const track = currentSong();
  if (!track) return;
  let now = track.end;
  try {
    now = ytPlayer.getCurrentTime();
  } catch {
    return;
  }
  if (now + 0.25 < track.end) return;
  songHolding = true;
  // The song reached its end and Hark is stopping it here.
  noteProgress(track, track.end);
  noteSong("complete");
  try {
    ytPlayer.pauseVideo();
  } catch {
    /* already stopped */
  }
  const following = nextPlay({
    catalog: endingSongs(),
    queue: songQueue,
    index: songIndex,
    auto: autoPlayAll(),
  });
  if (following) {
    if (autoPlayAll()) {
      songMode = "catalog";
      songQueue = [following];
      songIndex = 0;
    } else {
      songIndex += 1;
    }
    loadSong();
    return;
  }
  setToggleLabel(false);
  if (songKeep) songKeep.hidden = false;
}

function onSongState(event) {
  if (!event || event.data !== 0) {
    if (event && event.data === 1) setToggleLabel(true);
    if (event && event.data === 2 && songKeep && songKeep.hidden) setToggleLabel(false);
    // songHolding is set while a song loads and when Hark itself stops one at
    // its end, so only a pause the listener chose is counted.
    if (event && event.data === 2 && !songHolding && !songPaused) {
      songPaused = true;
      noteSong("pause");
    } else if (event && event.data === 1 && songPaused) {
      songPaused = false;
      noteSong("resume");
    }
    armHeartbeat();
    return;
  }
  finishSong();
}

function beginSongs(tracks, playMode) {
  if (!tracks.length || !songBar) return;
  songMode = playMode;
  songQueue = tracks;
  songIndex = 0;
  songBar.hidden = false;
  document.documentElement.dataset.player = "on";
  placeStage();
  // Started from a button further down the page: bring the player into view.
  if (songIsOpen() && !dockInView()) revealDock();
  const start = () => loadSong();
  if (ytPlayer && typeof ytPlayer.loadVideoById === "function") {
    start();
    return;
  }
  ensureSongPlayer().then(start);
}

function stopSongs() {
  window.clearInterval(songPoll);
  window.clearInterval(listenTimer);
  listenTimer = 0;
  songHolding = true;
  songQueue = [];
  songIndex = 0;
  if (songKeep) songKeep.hidden = true;
  if (songBar) songBar.hidden = true;
  document.documentElement.dataset.player = "off";
  document.documentElement.dataset.stage = "";
  document.documentElement.dataset.corner = "";
  paintMelody(null);
  delete document.documentElement.dataset.dragging;
  songOnPage = false;
  clearStagePosition();
  removeDock();
  clearNowPlaying();
  try {
    if (ytPlayer) ytPlayer.stopVideo();
  } catch {
    /* player was not ready */
  }
}

function keepWatchingService() {
  const track = currentSong();
  if (!track || !ytPlayer) return;
  window.clearInterval(songPoll);
  songHolding = true;
  songMode = "one";
  if (songKeep) songKeep.hidden = true;
  setToggleLabel(true);
  noteSong("keep_watching");
  ytPlayer.loadVideoById({ videoId: track.videoId, startSeconds: track.end });
}

function playQueued(track, mode) {
  if (!track) {
    stopSongs();
    return;
  }
  songMode = mode;
  songQueue = [track];
  songIndex = 0;
  if (ytPlayer && typeof ytPlayer.loadVideoById === "function") loadSong();
  else ensureSongPlayer().then(loadSong);
}

function stepSong(delta) {
  if (!songQueue.length) return;
  if (delta > 0) {
    const auto = autoPlayAll();
    const atEnd = songIndex + 1 >= songQueue.length;
    if (auto || (songMode === "one" && atEnd)) {
      const following = nextPlay({
        catalog: endingSongs(),
        queue: songQueue,
        index: songIndex,
        auto,
        singleAdvance: songMode === "one",
      });
      if (!following) {
        stopSongs();
        return;
      }
      playQueued(following, auto ? "catalog" : "one");
      return;
    }
  }
  const next = songIndex + delta;
  if (next < 0) {
    songIndex = 0;
    if (ytPlayer && typeof ytPlayer.loadVideoById === "function") loadSong();
    else ensureSongPlayer().then(loadSong);
    return;
  }
  if (next < songQueue.length) {
    songIndex = next;
    if (ytPlayer && typeof ytPlayer.loadVideoById === "function") loadSong();
    else ensureSongPlayer().then(loadSong);
    return;
  }
  // Last song of this list: the player stops and the bar closes.
  stopSongs();
}

function setToggleLabel(playing) {
  if (songToggle) {
    songToggle.setAttribute("aria-label", playing ? "Pause" : "Play");
    songToggle.replaceChildren(icon(playing ? "pause" : "play"));
  }
  const session = navigator.mediaSession;
  if (!session) return;
  try {
    session.playbackState = playing ? "playing" : "paused";
  } catch {
    /* ignore */
  }
}

function toggleSong() {
  if (!ytPlayer || typeof ytPlayer.getPlayerState !== "function") return;
  if (ytPlayer.getPlayerState() === 1) {
    ytPlayer.pauseVideo();
    setToggleLabel(false);
    return;
  }
  ytPlayer.playVideo();
  setToggleLabel(true);
}

if (songTitle) {
  songTitle.addEventListener("click", () => {
    const track = currentSong();
    if (track) location.hash = `#/hymn/${track.number}`;
  });
}
const songPrev = document.getElementById("song-prev");
const songNext = document.getElementById("song-next");
const songStop = document.getElementById("song-stop");
if (songPrev) {
  songPrev.replaceChildren(icon("prev"));
  songPrev.addEventListener("click", () => stepSong(-1));
}
if (songNext) {
  songNext.addEventListener("click", () => {
    noteSong("next_song");
    stepSong(1);
  });
}
if (songStop) {
  songStop.replaceChildren(icon("close"));
}
setToggleLabel(true);
if (songToggle) songToggle.addEventListener("click", toggleSong);
if (songStop) songStop.addEventListener("click", stopSongs);
if (songKeep) songKeep.addEventListener("click", keepWatchingService);
if (songPlace) {
  songPlace.addEventListener("click", () => {
    const next = placeChoice() === "float" ? "words" : "float";
    setPlaceChoice(next);
    gaEvent(next === "float" ? "player_float" : "player_pin");
    placeStage();
    if (next === "words" && songIsOpen()) revealDock();
  });
}
if (songFloatClose) {
  songFloatClose.replaceChildren(icon("close"));
  songFloatClose.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    stopSongs();
  });
}
let stageDrag = null;
function releaseStageCapture(pointerId) {
  if (!songFloatHit || pointerId == null || typeof songFloatHit.releasePointerCapture !== "function") return;
  try {
    if (typeof songFloatHit.hasPointerCapture === "function" && !songFloatHit.hasPointerCapture(pointerId)) return;
    songFloatHit.releasePointerCapture(pointerId);
  } catch {
    /* the pointer was already released */
  }
}
function finishStageDrag(event, { tap = true } = {}) {
  if (!stageDrag || !songStage) return;
  if (event && event.pointerId != null && stageDrag.id !== event.pointerId) return;
  const info = stageDrag;
  const pointerId = info.id;
  stageDrag = null;
  delete document.documentElement.dataset.dragging;
  releaseStageCapture(pointerId);
  if (tap && !info.moved) {
    const track = currentSong();
    if (track) location.hash = `#/hymn/${track.number}`;
    return;
  }
  if (!info.moved) return;
  const rect = songStage.getBoundingClientRect();
  if (stageMostlyOff(rect, stageScreen())) {
    stopSongs();
    return;
  }
  document.documentElement.dataset.corner = stageCorner(rect, stageSnapBounds());
  clearStagePosition();
}
if (songFloatHit && songStage) {
  songFloatHit.addEventListener("pointerdown", (event) => {
    if (document.documentElement.dataset.stage !== "float") return;
    if (event.button != null && event.button !== 0) return;
    if (event.pointerType === "mouse" && (Number(event.buttons) & 1) === 0) return;
    const rect = typeof songStage.getBoundingClientRect === "function" ? songStage.getBoundingClientRect() : { left: 0, top: 0 };
    stageDrag = {
      id: event.pointerId,
      pointerType: event.pointerType || "",
      x: event.clientX,
      y: event.clientY,
      left: rect.left,
      top: rect.top,
      moved: false,
    };
    if (typeof songFloatHit.setPointerCapture === "function") {
      try {
        songFloatHit.setPointerCapture(event.pointerId);
      } catch {
        /* the pointer is already gone */
      }
    }
  });
  songFloatHit.addEventListener("pointermove", (event) => {
    const pointerType = event.pointerType || (stageDrag && stageDrag.pointerType) || "";
    if (!stageDrag || stageDrag.id !== event.pointerId) return;
    if (pointerType === "mouse" && (Number(event.buttons) & 1) === 0) {
      finishStageDrag(event, { tap: false });
      return;
    }
    const dx = event.clientX - stageDrag.x;
    const dy = event.clientY - stageDrag.y;
    const action = stagePointerMove({
      pointerType,
      buttons: event.buttons,
      distance: Math.hypot(dx, dy),
    });
    if (action === "up") {
      finishStageDrag(event, { tap: false });
      return;
    }
    if (action !== "drag") return;
    stageDrag.moved = true;
    document.documentElement.dataset.dragging = "1";
    songStage.style.left = `${stageDrag.left + dx}px`;
    songStage.style.top = `${stageDrag.top + dy}px`;
    songStage.style.right = "auto";
    songStage.style.bottom = "auto";
  });
  songFloatHit.addEventListener("pointerup", finishStageDrag);
  songFloatHit.addEventListener("pointercancel", finishStageDrag);
  songFloatHit.addEventListener("lostpointercapture", finishStageDrag);
}
window.addEventListener("pointerup", finishStageDrag);
window.addEventListener("pointercancel", finishStageDrag);
window.addEventListener("blur", () => {
  if (!stageDrag) return;
  finishStageDrag({ pointerId: stageDrag.id });
});
window.addEventListener("scroll", () => {
  if (document.documentElement.dataset.stage === "inline") syncInlineStage();
});
window.addEventListener("resize", () => {
  if (document.documentElement.dataset.player === "on") placeStage();
});
loadYouTubeApi();

if (installLink) installLink.addEventListener("click", installClick);

syncInstallButton();
const notifyLink = document.getElementById("notify-link");
if (notifyLink) notifyLink.addEventListener("click", () => toggleNotify());
refreshNotify();

// load() is still waiting on the hymnal here. This first pass is what puts the
// welcome page on screen without waiting for it.
startAnalytics(analyticsUserProps());
render();

if ("serviceWorker" in navigator) {
  let reloading = false;
  // True only when a worker was already running this page, which means this is
  // an update. On a first visit the new worker claims the page and fires
  // controllerchange too, and reloading there throws away whatever the reader
  // has already typed or opened. The stored flag stops a second reload if
  // claiming the page fires the event again.
  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloading) return;
    try {
      if (sessionStorage.getItem("hark-sw-reload") === "1") {
        sessionStorage.removeItem("hark-sw-reload");
        return;
      }
      sessionStorage.setItem("hark-sw-reload", "1");
    } catch {
      /* storage can be blocked; the reloading flag still stops this page */
    }
    reloading = true;
    window.location.reload();
  });
  const checkForUpdate = (registration) => {
    if (registration && registration.update) registration.update().catch(() => {});
  };
  window.addEventListener("load", () => {
    const script = new URL("sw.js", import.meta.url);
    const scope = new URL("./", script);
    navigator.serviceWorker
      .register(script, { scope: scope.href, updateViaCache: "none" })
      .then((registration) => {
        checkForUpdate(registration);
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") checkForUpdate(registration);
        });
      })
      .catch(() => {});
  });
}
