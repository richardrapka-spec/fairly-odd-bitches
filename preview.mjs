#!/usr/bin/env node
// preview.mjs -- the book at iPhone size, driven the way a thumb would:
// cover, tap to open, wait for the pen, turn a page. Screenshots land in
// the folder you name. Uses Lattice's playwright-core and whatever Chromium
// is installed (Edge or Chrome).
//
//   node preview.mjs <outdir> [browser.exe]
import { chromium } from "../lattice/node_modules/playwright-core/index.mjs";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";

const out = process.argv[2] || ".";
const exe = process.argv[3] || ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"].find(existsSync);
const root = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "web");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".mp4": "video/mp4", ".jpg": "image/jpeg", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const server = createServer(async (req, res) => {
  const file = path.join(root, decodeURIComponent(new URL(req.url, "http://x").pathname.replace(/\/$/, "/index.html")));
  try {
    const info = await stat(file);
    const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range || "");
    const data = await readFile(file);
    if (range) {
      const start = Number(range[1]), end = range[2] ? Number(range[2]) : info.size - 1;
      res.writeHead(206, { "Content-Type": types[path.extname(file)] || "application/octet-stream", "Content-Range": `bytes ${start}-${end}/${info.size}`, "Accept-Ranges": "bytes", "Content-Length": end - start + 1 });
      return res.end(data.subarray(start, end + 1));
    }
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream", "Content-Length": info.size, "Accept-Ranges": "bytes" });
    res.end(data);
  } catch { res.writeHead(404); res.end("no"); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const shot = (name) => page.screenshot({ path: path.join(out, name) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  await page.goto(url);
  await sleep(800);
  await shot("book-cover.png");
  await page.click("#lift");
  await sleep(9500);
  await shot("book-page1.png");
  await page.click("#next");
  await sleep(4500);
  await shot("book-page2.png");
  await page.click("#edit");
  await sleep(500);
  await shot("book-edit.png");
  console.log(JSON.stringify(await page.evaluate(() => ({ at: window.__fob?.at, folio: document.querySelector("#folio").textContent, name: document.querySelector("#name").textContent, openLabel: document.querySelector("#openLabel").textContent }))));
} finally {
  await browser.close();
  server.close();
}
