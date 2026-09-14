#!/usr/bin/env node
// live.mjs -- the published book, driven at iPhone size: does the cover
// clip really play from the host, does the pen write, is the service worker
// in charge. Prints one JSON line.
//
//   node live.mjs [url]
import { chromium } from "file:///C:/dev/lattice/node_modules/playwright-core/index.mjs";
const url = process.argv[2] || "https://richardrapka-spec.github.io/fairly-odd-bitches/";
const browser = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const failed = [];
page.on("requestfailed", (r) => failed.push(`${r.failure()?.errorText} ${r.url().split("/").pop()}`));
page.on("response", (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url().split("/").pop()}`); });
await page.goto(url, { waitUntil: "load" });
await page.waitForTimeout(1500);
await page.click("#lift");
await page.waitForTimeout(9500);
const out = await page.evaluate(() => {
  const v = document.querySelector("#vOpen");
  return { name: document.querySelector("#name").textContent, folio: document.querySelector("#folio").textContent, sw: !!navigator.serviceWorker?.controller, open: { duration: v.duration, currentTime: v.currentTime, readyState: v.readyState, ended: v.ended, error: v.error ? v.error.code : null } };
});
await page.screenshot({ path: "C:/Users/richa/AppData/Local/Temp/claude/C--Users-richa/8a6994a7-2d5f-4578-be99-ece8cd7b8419/scratchpad/live-page1.png" });
console.log(JSON.stringify({ ...out, failed }));
await browser.close();
