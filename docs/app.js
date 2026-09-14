// Fairly Odd Bitches — a book of threads.
//
// The cover opens with the real clip, every page turn is the real turn (one
// clip forward, its reversed bake backward, because a phone cannot play video
// in reverse), and when a page settles the words are written onto it. Each
// page keeps one ChatGPT conversation: tapping the page opens that thread in
// the ChatGPT app. Nothing here talks to a server; the pages live on the
// phone.

const FRAME = { w: 800, h: 1136 };
// the right-hand page of the held spread, as fractions of the frame
const PAGE = { x: 0.115, y: 0.2, w: 0.62, h: 0.52 };
const KEY = "fob.pages.v1";
const DEFAULT_PAGES = [
  { name: "Sloan", about: "baking", note: "", link: "" },
  { name: "Quinn", about: "homeschool", note: "", link: "" },
  { name: "Vesper", about: "book club", note: "", link: "" },
  { name: "Maeve", about: "writing", note: "", link: "" },
  { name: "Pippa", about: "fun stuff", note: "", link: "" },
  { name: "All the bitches", about: "everyone at once", note: "", link: "" },
];

const $ = (s) => document.querySelector(s);
const book = $("#book"), poster = $("#poster"), pageEl = $("#page");
const clips = { open: $("#vOpen"), close: $("#vClose"), turn: $("#vTurn"), back: $("#vTurnRev") };
const state = { at: 0, busy: false, pages: loadPages(), writing: 0, loaded: false };

function loadPages() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(raw) && raw.length === DEFAULT_PAGES.length) return raw.map((p, i) => ({ ...DEFAULT_PAGES[i], ...(p || {}) }));
  } catch {}
  return DEFAULT_PAGES.map((p) => ({ ...p }));
}
function savePages() { try { localStorage.setItem(KEY, JSON.stringify(state.pages)); } catch {} }

// ---- layout: the words sit on the page wherever the frame lands ----------
function layout() {
  const W = innerWidth, H = innerHeight;
  // a phone fills the screen with the frame; a wide window (the PC) shows the
  // whole book letterboxed instead of a crop of its middle
  const wide = W / H > FRAME.w / FRAME.h;
  const s = wide ? H / FRAME.h : Math.max(W / FRAME.w, H / FRAME.h);
  const fw = FRAME.w * s, fh = FRAME.h * s;
  for (const layer of document.querySelectorAll(".layer")) layer.style.objectFit = wide ? "contain" : "cover";
  // a phone is narrower than the frame: slide the frame so the right-hand
  // page, not the spine, sits in the middle of the screen
  const cx = (PAGE.x + PAGE.w / 2) * fw;
  const px = fw > W ? Math.max(0, Math.min(1, (cx - W / 2) / (fw - W))) : 0.5;
  const ox = fw > W ? -px * (fw - W) : (W - fw) / 2, oy = (H - fh) / 2;
  for (const layer of document.querySelectorAll(".layer")) layer.style.objectPosition = `${(px * 100).toFixed(2)}% 50%`;
  pageEl.style.left = `${ox + PAGE.x * fw}px`;
  pageEl.style.top = `${oy + PAGE.y * fh}px`;
  pageEl.style.width = `${PAGE.w * fw}px`;
  pageEl.style.height = `${PAGE.h * fh}px`;
  pageEl.style.fontSize = `${16 * (fw / FRAME.w)}px`;
}
addEventListener("resize", layout);
layout();

// ---- the clips ------------------------------------------------------------
function warm() {
  if (state.loaded) return;
  state.loaded = true;
  for (const clip of Object.values(clips)) { try { clip.load(); } catch {} }
}
function play(clip) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (done) return; done = true; clip.removeEventListener("ended", finish); resolve(); };
    clip.addEventListener("ended", finish);
    try { clip.currentTime = 0; } catch {}
    clip.classList.add("playing");
    poster.classList.add("under");
    const p = clip.play();
    if (p && p.catch) p.catch(() => setTimeout(finish, 300));
    // a clip that never reports its end still lets the book go on
    setTimeout(finish, 12000);
  });
}
async function settle(clip, src) {
  if (poster.src.endsWith(src) === false) {
    poster.src = src;
    try { await poster.decode(); } catch {}
  }
  poster.classList.remove("under");
  clip.classList.remove("playing");
  try { clip.pause(); } catch {}
}

// ---- the pen --------------------------------------------------------------
function clearWriting() { state.writing += 1; }
function write(el, text, msPerChar) {
  const token = ++state.writing;
  el.replaceChildren();
  const spans = [];
  for (const ch of String(text || "")) {
    const span = document.createElement("span");
    span.className = "w";
    span.textContent = ch;
    el.appendChild(span);
    spans.push(span);
  }
  return new Promise((resolve) => {
    let i = 0;
    const tick = () => {
      if (token !== state.writing) return resolve(false);
      if (i >= spans.length) return resolve(true);
      spans[i].classList.add("on");
      i += 1;
      const ch = spans[i - 1].textContent;
      setTimeout(tick, /[.,!?]/.test(ch) ? msPerChar * 4 : ch === " " ? msPerChar * 1.6 : msPerChar);
    };
    tick();
  });
}

// ---- showing a page ---------------------------------------------------------
async function showPage(n) {
  const page = state.pages[n - 1];
  pageEl.hidden = false;
  $("#folio").textContent = `PAGE ${n} OF ${state.pages.length}`;
  const openBtn = $("#open"), hint = $("#hint");
  openBtn.classList.remove("ready"); hint.classList.remove("ready");
  $("#openLabel").textContent = page.link ? `Open ${n === state.pages.length ? "their" : page.name.split(" ")[0] + "'s"} thread` : "Choose the thread";
  hint.textContent = page.link ? "" : "Tap ✎ or here to paste her ChatGPT link";
  await write($("#name"), page.name, 55);
  await write($("#about"), page.about, 40);
  if (page.note) await write($("#note"), page.note, 28); else $("#note").replaceChildren();
  openBtn.classList.add("ready"); hint.classList.add("ready");
}
function hidePage() { clearWriting(); pageEl.hidden = true; }
function chrome() {
  const open = state.at > 0;
  $("#lift").hidden = open;
  $("#back").hidden = !open;
  $("#next").hidden = !open || state.at >= state.pages.length;
  $("#edit").hidden = !open;
}

// ---- turning ----------------------------------------------------------------
async function go(direction) {
  if (state.busy) return;
  const to = state.at + direction;
  if (to < 0 || to > state.pages.length) return;
  state.busy = true;
  warm();
  hidePage();
  try {
    if (state.at === 0 && to === 1) { await play(clips.open); await settle(clips.open, "assets/page.jpg"); }
    else if (state.at === 1 && to === 0) { await play(clips.close); await settle(clips.close, "assets/cover.jpg"); }
    else if (direction > 0) { await play(clips.turn); await settle(clips.turn, "assets/page.jpg"); }
    else { await play(clips.back); await settle(clips.back, "assets/page.jpg"); }
  } finally {
    state.at = to;
    state.busy = false;
    chrome();
    if (to > 0) showPage(to);
  }
}

// ---- gestures: swipe, or tap a side; the cover has one button ---------------
let press = null;
book.addEventListener("pointerdown", (event) => { if (event.target.closest("button, dialog")) return; press = { x: event.clientX, y: event.clientY, t: Date.now() }; });
book.addEventListener("pointerup", (event) => {
  if (!press) return;
  const dx = event.clientX - press.x, dy = event.clientY - press.y, dt = Date.now() - press.t;
  press = null;
  if (event.target.closest("button, dialog")) return;
  if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) return go(dx < 0 ? 1 : -1);
  if (dt > 500 || Math.abs(dx) + Math.abs(dy) > 12) return;
  if (state.at === 0) return go(1);
  const x = event.clientX / innerWidth;
  if (x > 0.6) go(1); else if (x < 0.4) go(-1);
});
$("#lift").addEventListener("click", () => go(1));
$("#next").addEventListener("click", () => go(1));
$("#back").addEventListener("click", () => go(-1));
addEventListener("keydown", (event) => {
  if ($("#editor").open) return;
  if (event.key === "ArrowRight" || event.key === " " || event.key === "Enter") go(1);
  else if (event.key === "ArrowLeft" || event.key === "Backspace") go(-1);
});

// ---- the thread: one tap, the ChatGPT app opens on it ----------------------
$("#open").addEventListener("click", () => {
  const page = state.pages[state.at - 1];
  if (!page) return;
  if (!page.link) return openEditor();
  location.href = page.link;
});

// ---- editing a page -----------------------------------------------------------
const editor = $("#editor");
function openEditor() {
  const page = state.pages[state.at - 1]; if (!page) return;
  $("#fName").value = page.name; $("#fAbout").value = page.about; $("#fNote").value = page.note || ""; $("#fLink").value = page.link || ""; $("#fLink").setCustomValidity("");
  editor.showModal();
}
$("#edit").addEventListener("click", openEditor);
$("#editCancel").addEventListener("click", () => editor.close());
$("#editForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const page = state.pages[state.at - 1]; if (!page) return editor.close();
  page.name = $("#fName").value.trim() || page.name;
  page.about = $("#fAbout").value.trim();
  page.note = $("#fNote").value.trim();
  let link = $("#fLink").value.trim();
  if (link && !/^https?:\/\//i.test(link)) link = `https://${link}`;
  // a Share link is a public snapshot, not the living thread
  if (/chatgpt\.com\/share\//i.test(link)) { $("#fLink").setCustomValidity("That is a Share snapshot. Open the conversation at chatgpt.com and copy its address, the one with /c/ in it."); $("#fLink").reportValidity(); return; }
  $("#fLink").setCustomValidity("");
  page.link = link;
  savePages();
  editor.close();
  showPage(state.at);
});

// ---- offline: the whole book stays on the phone --------------------------------
if ("serviceWorker" in navigator) {
  addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
}
chrome();
