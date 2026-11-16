import {
  attributionParts,
  browse,
  isWithheld,
  listRecordings,
  listSections,
  neighbors,
  partialNote,
  stanzaPlan,
} from "./hymn-model.js";

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
];

const scrollMemory = { number: 0, title: 0, author: 0 };
let hymns = [];
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
  const match = path.match(/^\/hymn\/(\d+)\/?$/);
  if (match) return { view: "hymn", number: Number(match[1]) };
  return { view: "index", index: "number" };
}

function indexHref(index) {
  if (index === "title") return "#/title";
  if (index === "author") return "#/author";
  return "#/";
}

function rememberScroll() {
  if (activeIndex) scrollMemory[activeIndex] = window.scrollY;
}

function storedIndex() {
  try {
    const stored = sessionStorage.getItem("hark-index");
    if (stored === "title" || stored === "author" || stored === "number") return stored;
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
  for (const [id, name] of TAB_IDS) {
    const button = document.getElementById(id);
    const selected = name === index;
    button.setAttribute("aria-selected", selected ? "true" : "false");
    button.tabIndex = selected ? 0 : -1;
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

function renderIndex(index) {
  homeBar.hidden = false;
  hymnBar.hidden = true;
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

function linesEl(lines, className) {
  const paragraph = el("p", { class: className });
  for (const line of lines) paragraph.append(el("span", { class: "line" }, line));
  return paragraph;
}

function recordingSection(hymn) {
  const items = listRecordings(hymn);
  if (items.length === 0) return null;
  const sectionEl = el("section", { class: "recordings" });
  sectionEl.append(el("h2", {}, "Choir"));
  for (const item of items) {
    const figure = el("figure");
    figure.append(el("figcaption", {}, item.label));
    if (item.kind === "youtube") {
      const frame = el("div", { class: "video-frame" });
      frame.append(
        el("iframe", {
          src: `https://www.youtube-nocookie.com/embed/${item.id}`,
          title: item.label,
          loading: "lazy",
          allow:
            "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
          allowfullscreen: true,
          referrerpolicy: "strict-origin-when-cross-origin",
        }),
      );
      figure.append(frame);
    } else if (item.kind === "video") {
      const video = el("video", { controls: true, playsinline: true, preload: "metadata" });
      video.src = item.url;
      figure.append(video);
    } else {
      const audio = el("audio", { controls: true, preload: "metadata" });
      audio.src = item.url;
      figure.append(audio);
    }
    sectionEl.append(figure);
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
  back.replaceChildren(icon("back"), document.createTextNode("Hymns"));
  const listName =
    listIndex === "title" ? "title index" : listIndex === "author" ? "author index" : "hymn list";
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

    const recordings = recordingSection(hymn);
    if (recordings) article.append(recordings);

    if (isWithheld(hymn)) {
      const notice = el("div", { class: "notice" });
      notice.append(el("h2", {}, "These words are under copyright"));
      if (hymn.copyright_note) notice.append(el("p", {}, hymn.copyright_note));
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
        if (block.type === "gap") {
          text.append(el("p", { class: "omitted" }, block.note));
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

    if (!recordings) {
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

function render() {
  if (!ready) return;
  bubble.hidden = true;
  const current = route();
  if (current.view === "hymn") renderHymn(current.number);
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
    const response = await fetch(new URL("data/hymns.json", import.meta.url));
    if (!response.ok) throw new Error(String(response.status));
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("bad data");
    hymns = data;
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

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(new URL("sw.js", import.meta.url)).catch(() => {});
  });
}
