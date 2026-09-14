// Fairly Odd Bitches — a book of threads.
//
// One continuous film: the cover opens, then page turns, each resting on a
// spread. The book plays the film forward from one rest to the next and
// stops there; backward it plays a reversed bake of the same film (a phone
// cannot play video in reverse). The rest times are the operator's, set with
// the slider in ?tune. Every rest in this film is the same blank spread, so
// pages past the last rest reuse the last turn without a visible seam.
//
// Each page keeps one ChatGPT conversation: tapping the page opens that
// thread in the ChatGPT app. Nothing talks to a server; it all lives on the
// phone.

const FRAME = { w: 800, h: 1136 };
// the right-hand page of a resting spread, as fractions of the frame
const PAGE = { x: 0.115, y: 0.2, w: 0.62, h: 0.52 };
const PAGES_KEY = "fob.pages.v1";
const HOLDS_KEY = "fob.holds.v1";
const DEFAULT_PAGES = [
  { name: "Sloan", about: "baking", note: "", link: "" },
  { name: "Quinn", about: "homeschool", note: "", link: "" },
  { name: "Vesper", about: "book club", note: "", link: "" },
  { name: "Maeve", about: "writing", note: "", link: "" },
  { name: "Pippa", about: "fun stuff", note: "", link: "" },
  { name: "All the bitches", about: "everyone at once", note: "", link: "" },
];
// where the film rests, in seconds: the open spread, then each turned spread
// Rich's rests, set with the slider on 2026-09-14: one per page
const DEFAULT_HOLDS = [5.12, 5.96, 8.06, 10.6, 12.08, 14.36];

const $ = (s) => document.querySelector(s);
const book = $("#book"), poster = $("#poster"), pageEl = $("#page");
const film = { fwd: $("#vFwd"), rev: $("#vRev") };
const state = { at: 0, busy: false, pages: loadPages(), holds: loadHolds(), writing: 0, loaded: false, showing: null, duration: 0 };
const tune = new URLSearchParams(location.search).has("tune");

function loadPages() {
  try {
    const raw = JSON.parse(localStorage.getItem(PAGES_KEY));
    if (Array.isArray(raw) && raw.length === DEFAULT_PAGES.length) return raw.map((p, i) => ({ ...DEFAULT_PAGES[i], ...(p || {}) }));
  } catch {}
  return DEFAULT_PAGES.map((p) => ({ ...p }));
}
function savePages() { try { localStorage.setItem(PAGES_KEY, JSON.stringify(state.pages)); } catch {} }
function loadHolds() {
  try {
    const raw = JSON.parse(localStorage.getItem(HOLDS_KEY));
    if (Array.isArray(raw) && raw.length >= 1 && raw.every((t) => typeof t === "number")) return raw;
  } catch {}
  return DEFAULT_HOLDS.slice();
}
function saveHolds() { try { localStorage.setItem(HOLDS_KEY, JSON.stringify(state.holds)); } catch {} }

// ---- layout: the words sit on the page wherever the frame lands ----------
function layout() {
  const W = innerWidth, H = innerHeight;
  // a phone fills the screen with the frame; a wide window (the PC) shows the
  // whole book letterboxed instead of a crop of its middle
  const wide = W / H > FRAME.w / FRAME.h;
  const s = wide ? H / FRAME.h : Math.max(W / FRAME.w, H / FRAME.h);
  const fw = FRAME.w * s, fh = FRAME.h * s;
  // a phone is narrower than the frame: slide the frame so the right-hand
  // page, not the spine, sits in the middle of the screen
  const cx = (PAGE.x + PAGE.w / 2) * fw;
  const px = fw > W ? Math.max(0, Math.min(1, (cx - W / 2) / (fw - W))) : 0.5;
  const ox = fw > W ? -px * (fw - W) : (W - fw) / 2, oy = (H - fh) / 2;
  for (const layer of document.querySelectorAll(".layer")) {
    layer.style.objectFit = wide ? "contain" : "cover";
    layer.style.objectPosition = `${(px * 100).toFixed(2)}% 50%`;
  }
  pageEl.style.left = `${ox + PAGE.x * fw}px`;
  pageEl.style.top = `${oy + PAGE.y * fh}px`;
  pageEl.style.width = `${PAGE.w * fw}px`;
  pageEl.style.height = `${PAGE.h * fh}px`;
  pageEl.style.fontSize = `${16 * (fw / FRAME.w)}px`;
}
addEventListener("resize", layout);
layout();

// ---- the film ---------------------------------------------------------------
const duration = () => state.duration || film.fwd.duration || 15.04;
// the rest time of page n (1-based); pages past the film's rests share the last one
const restOf = (n) => state.holds[Math.min(n, state.holds.length) - 1];
// The films are fetched whole and handed to the player as local blobs: a
// player asking a service worker for byte ranges of a cached file fails in
// Chromium, and a blob needs no ranges at all. Offline, the fetch is served
// from the cache; online the first visit downloads about 9 MB once.
let filmsReady = null;
function warm() {
  if (filmsReady) return filmsReady;
  filmsReady = Promise.all(Object.values(film).map(async (v) => {
    const src = v.dataset.src;
    if (!src || v.src) return;
    try {
      const blob = await (await fetch(src)).blob();
      v.src = URL.createObjectURL(blob);
      await new Promise((resolve) => { const done = () => { v.removeEventListener("loadedmetadata", done); resolve(); }; v.addEventListener("loadedmetadata", done); setTimeout(done, 8000); try { v.load(); } catch {} });
    } catch { v.src = src; }
  })).then(() => { state.loaded = true; const lift = $("#lift"); lift.disabled = false; lift.querySelector("span").textContent = "tap to open"; });
  return filmsReady;
}
function seek(v, t) {
  return new Promise((resolve) => {
    const done = () => { v.removeEventListener("seeked", done); resolve(); };
    if (Math.abs(v.currentTime - t) < 0.01) return resolve();
    v.addEventListener("seeked", done);
    try { v.currentTime = t; } catch { done(); }
    setTimeout(done, 1500);
  });
}
function show(v) {
  if (state.showing === v) return;
  v.classList.add("on");
  if (state.showing) state.showing.classList.remove("on");
  poster.classList.add("under");
  state.showing = v;
}
// play v from `from` and stop on the frame at `to`
function run(v, from, to) {
  return new Promise(async (resolve) => {
    await seek(v, from);
    show(v);
    let done = false;
    const stop = () => {
      if (done) return;
      done = true;
      try { v.pause(); } catch {}
      resolve();
    };
    const watch = () => {
      if (done) return;
      if (v.currentTime >= to - 0.03 || v.ended) return stop();
      requestAnimationFrame(watch);
    };
    const p = v.play();
    if (p && p.catch) p.catch(() => setTimeout(stop, 200));
    requestAnimationFrame(watch);
    setTimeout(stop, (to - from + 2) * 1000);
  });
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
  $("#lift").hidden = open || tune;
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
  await warm();
  hidePage();
  const D = duration();
  try {
    if (direction > 0) {
      // forward: from where the film rests now to where it rests next. Past
      // the film's last rest, jump to the spread before it (they look the
      // same) and play that last turn again.
      const last = state.holds.length;
      let from = state.at === 0 ? 0 : restOf(state.at);
      let until = restOf(to);
      if (to > last) { from = restOf(last - 1); until = restOf(last); }
      await run(film.fwd, from, until);
      // the reverse film stands ready on this same frame for a backward turn
      seek(film.rev, D - until);
    } else {
      const last = state.holds.length;
      let from = restOf(state.at);
      let until = to === 0 ? 0 : restOf(to);
      if (state.at > last) { from = restOf(last); until = restOf(last - 1); }
      await run(film.rev, D - from, D - until);
      seek(film.fwd, until);
    }
  } finally {
    state.at = to;
    state.busy = false;
    chrome();
    if (to > 0) showPage(to);
  }
}

// ---- gestures: swipe, or tap a side; the cover has one button ---------------
let press = null;
book.addEventListener("pointerdown", (event) => { if (event.target.closest("button, dialog, #tuner")) return; press = { x: event.clientX, y: event.clientY, t: Date.now() }; });
book.addEventListener("pointerup", (event) => {
  if (!press) return;
  const dx = event.clientX - press.x, dy = event.clientY - press.y, dt = Date.now() - press.t;
  press = null;
  if (event.target.closest("button, dialog, #tuner")) return;
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
  if ($("#editor").open || event.target.closest("input, textarea")) return;
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
  $("#fName").value = page.name; $("#fAbout").value = page.about; $("#fNote").value = page.note || ""; $("#fLink").value = page.link || "";
  $("#fLink").setCustomValidity("");
  editor.showModal();
}
$("#edit").addEventListener("click", openEditor);
$("#editCancel").addEventListener("click", () => editor.close());
$("#editForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const page = state.pages[state.at - 1]; if (!page) return editor.close();
  let link = $("#fLink").value.trim();
  if (link && !/^https?:\/\//i.test(link)) link = `https://${link}`;
  // Share makes a public read-only snapshot (/share/ or /s/), not the living
  // thread; the thread's own address has /c/ in it
  if (/chatgpt\.com\/(share|s)\//i.test(link)) {
    $("#fLink").setCustomValidity("That is a Share snapshot, not the thread. Open chatgpt.com in Safari, open the conversation, and copy the address bar (it has /c/ in it).");
    $("#fLink").reportValidity();
    return;
  }
  $("#fLink").setCustomValidity("");
  page.name = $("#fName").value.trim() || page.name;
  page.about = $("#fAbout").value.trim();
  page.note = $("#fNote").value.trim();
  page.link = link;
  savePages();
  editor.close();
  showPage(state.at);
});

// ---- ?tune: scrub the film, set where each page rests ----------------------
if (tune) {
  const tuner = document.createElement("div");
  tuner.id = "tuner";
  tuner.innerHTML = `
    <div class="t-row"><input id="tSlider" type="range" min="0" max="15.04" step="0.02" value="0"><b id="tTime">0.00s</b></div>
    <div class="t-row" id="tPages"></div>
    <div class="t-row"><button type="button" id="tPlay">play</button><button type="button" id="tBack">−1f</button><button type="button" id="tFwd">+1f</button><button type="button" id="tReset">defaults</button><button type="button" id="tCopy">copy times</button><button type="button" id="tDone">done</button></div>
    <textarea id="tOut" rows="2" readonly></textarea>`;
  document.body.appendChild(tuner);
  const slider = $("#tSlider"), timeEl = $("#tTime"), out = $("#tOut");
  const v = film.fwd;
  warm().then(() => { show(v); state.duration = v.duration; slider.max = v.duration.toFixed(2); });
  const setTime = (t) => { t = Math.max(0, Math.min(duration(), t)); v.pause(); v.currentTime = t; slider.value = t; timeEl.textContent = `${t.toFixed(2)}s`; };
  const render = () => {
    const holds = state.holds;
    $("#tPages").replaceChildren(...holds.map((t, i) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "t-hold";
      b.innerHTML = `<span>rest ${i + 1}</span><em>${t.toFixed(2)}s</em>`;
      b.title = i === 0 ? "the open spread: page 1 rests here" : `page ${i + 1} rests here`;
      b.addEventListener("click", () => { holds[i] = Number(slider.value); saveHolds(); render(); });
      return b;
    }), (() => { const b = document.createElement("button"); b.type = "button"; b.textContent = "+ rest here"; b.addEventListener("click", () => { holds.push(Number(slider.value)); holds.sort((a, b) => a - b); saveHolds(); render(); }); return b; })(),
       (() => { const b = document.createElement("button"); b.type = "button"; b.textContent = "− last"; b.addEventListener("click", () => { if (holds.length > 1) { holds.pop(); saveHolds(); render(); } }); return b; })());
    out.value = JSON.stringify(holds.map((t) => Math.round(t * 100) / 100));
  };
  v.addEventListener("loadedmetadata", () => { state.duration = v.duration; slider.max = v.duration.toFixed(2); });
  slider.addEventListener("input", () => setTime(Number(slider.value)));
  $("#tBack").addEventListener("click", () => setTime(v.currentTime - 1 / 24));
  $("#tFwd").addEventListener("click", () => setTime(v.currentTime + 1 / 24));
  $("#tPlay").addEventListener("click", () => { if (v.paused) { v.play(); $("#tPlay").textContent = "pause"; } else { v.pause(); $("#tPlay").textContent = "play"; } });
  v.addEventListener("timeupdate", () => { if (!v.paused) { slider.value = v.currentTime; timeEl.textContent = `${v.currentTime.toFixed(2)}s`; } });
  $("#tReset").addEventListener("click", () => { state.holds = DEFAULT_HOLDS.slice(); saveHolds(); render(); });
  $("#tCopy").addEventListener("click", async () => { try { await navigator.clipboard.writeText(out.value); } catch {} out.select(); });
  $("#tDone").addEventListener("click", () => { location.href = location.pathname; });
  // in tune mode the slider is the pen: press a rest button to save the
  // slider's time as that page's resting frame
  $("#lift").hidden = true;
  render();
}

// ---- offline: the whole book stays on the phone --------------------------------
if ("serviceWorker" in navigator && !tune && !new URLSearchParams(location.search).has("nosw")) {
  addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
}
window.__fob = { state, go, restOf, warm };
chrome();
warm();
