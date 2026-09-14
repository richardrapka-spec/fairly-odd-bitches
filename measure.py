"""Where the open page sits in the film around each rest.

For every rest time the film is sampled from 0.6 s before to 0.5 s after,
and the cream of the open spread is found in each frame; its top, height and
right edge tell the app where the right-hand page is, so the words glide in
with the page as it settles and lift away with it as it turns.

  python measure.py                # rests from docs/app.js DEFAULT_HOLDS
  python measure.py 5.12 5.96 ...  # rests by hand

Writes docs/glide.json: { "<rest>": { "<time>": [x, y, w, h] } } as frame
fractions, x/w spanning the whole spread (the app takes the right page).
"""
import json
import os
import re
import sys

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = r"C:\Users\richa\Downloads\grok-video-0dc4fea5-221c-4e53-9771-bb7daf5d81c0.mp4"
OFFSETS = [-0.6, -0.45, -0.3, -0.15, 0.0, 0.15, 0.3, 0.5]

if len(sys.argv) > 1:
    rests = [float(a) for a in sys.argv[1:]]
else:
    app = open(os.path.join(HERE, "docs", "app.js"), encoding="utf-8").read()
    rests = [float(x) for x in re.search(r"DEFAULT_HOLDS = \[([^\]]+)\]", app).group(1).split(",")]

cap = cv2.VideoCapture(SRC)
fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
frames = []
while True:
    ok, frame = cap.read()
    if not ok:
        break
    frames.append(frame)
H, W = frames[0].shape[:2]


def page_box(t):
    frame = frames[max(0, min(len(frames) - 1, int(round(t * fps))))]
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    cream = ((hsv[..., 2] > 165) & (hsv[..., 1] < 70)).astype(np.uint8) * 255
    cream[:, : int(W * 0.25)] = 0
    cream = cv2.morphologyEx(cream, cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))
    n, _, stats, _ = cv2.connectedComponentsWithStats(cream)
    if n < 2:
        return None
    x, y, w, h, _ = stats[1 + int(np.argmax(stats[1:, 4]))]
    return [round(x / W, 4), round(y / H, 4), round(w / W, 4), round(h / H, 4)]


out = {}
for rest in rests:
    out[f"{rest:.2f}"] = {f"{rest + d:.2f}": page_box(rest + d) for d in OFFSETS}
with open(os.path.join(HERE, "docs", "glide.json"), "w", encoding="utf-8") as f:
    json.dump(out, f, separators=(",", ":"))
for rest, samples in out.items():
    print(rest, "rest", samples[rest], "y over time", [s[1] if s else None for s in samples.values()])
