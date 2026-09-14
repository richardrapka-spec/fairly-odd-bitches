# Fairly Odd Bitches

A book on a phone. The cover opens with the real clip, each page turn is the
real turn, and when a page settles a pen writes its name onto it. Every page
keeps one ChatGPT conversation: tapping the page opens that thread in the
ChatGPT app. Six pages: Sloan (baking), Quinn (homeschool), Vesper (book
club), Maeve (writing), Pippa (fun stuff), and all of them at once.

Nothing here needs a computer once it is on the phone. The pages and their
links live in the phone's own storage; the clips are cached by a service
worker, so the book opens with no network.

## Files

- `docs/` — the app. `index.html`, `app.js`, `style.css`, `sw.js`,
  `manifest.webmanifest`, and `assets/` (the four clips, two posters, icons).
- `bake.py` — bakes `docs/assets/full.mp4` (the whole clip, one continuous
  film) and `full-rev.mp4` (its reverse; iPhone Safari cannot play video
  backwards). The book plays the film from one rest to the next and stops.
  Rest times are set in `?tune` (a slider; press a rest button to save the
  slider's time) and kept on the phone; the defaults are in `app.js`. Every
  rest in the clip is the same blank spread, so pages past the last rest
  replay the last turn.
- `preview.mjs` — the book at iPhone size in a headless browser, screenshots
  of cover, page one written, page two, and the editor.

## Putting it on her phone

The `docs/` folder is static: any https host serves it (GitHub Pages, Netlify,
Cloudflare Pages). Open the address in Safari, Share → Add to Home Screen.
From then on it opens full screen, offline, from the icon.

On each page, tap ✎ and paste the conversation's address: open chatgpt.com in
Safari, open the conversation, copy the address bar (it has `/c/` in it).
Not the Share link, which is a public read-only snapshot. Tapping the page
after that opens the thread in the ChatGPT app.

## What it cannot do

Read or write those threads itself. There is no door from another app into a
ChatGPT conversation, so the chat happens in ChatGPT; the book is the front
door.
