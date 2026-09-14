"""Bake the book's clips from the Grok page-turn video.

The clip is: cover (0 s) -> opening -> blank spread held (~6.9-8.7 s) ->
three page turns, each ending on an identical blank spread. Every held
spread looks the same, so one turn clip serves every page, forward or, as a
reversed bake, backward. iPhone Safari cannot play video backwards, hence the
reversed files.

  python bake.py "C:\\Users\\richa\\Downloads\\grok-video-....mp4"

Writes web/assets/{open,turn,turn-rev,close}.mp4 and cover.jpg / page.jpg.
"""
import os
import sys

import av
import cv2

SRC = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\richa\Downloads\grok-video-0dc4fea5-221c-4e53-9771-bb7daf5d81c0.mp4"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web", "assets")
os.makedirs(OUT, exist_ok=True)

OPEN_END = 7.8   # cover -> held open spread
TURN_START = 8.71  # end of the first hold
TURN_END = 10.69   # middle of the next hold


def load(path):
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
    frames = []
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        frames.append(frame)
    cap.release()
    return frames, fps


def write(frames, fps, dest):
    h, w = frames[0].shape[:2]
    container = av.open(dest, mode="w")
    stream = container.add_stream("libx264", rate=round(fps))
    stream.width, stream.height = w, h
    stream.pix_fmt = "yuv420p"
    stream.options = {"crf": "20", "preset": "medium", "profile": "high", "movflags": "+faststart"}
    for frame in frames:
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        for packet in stream.encode(av.VideoFrame.from_ndarray(rgb, format="rgb24")):
            container.mux(packet)
    for packet in stream.encode():
        container.mux(packet)
    container.close()
    print(f"{os.path.basename(dest)}: {len(frames)} frames, {os.path.getsize(dest) // 1024} KB")


frames, fps = load(SRC)
f = lambda seconds: min(len(frames) - 1, int(round(seconds * fps)))
opening = frames[0 : f(OPEN_END) + 1]
turn = frames[f(TURN_START) : f(TURN_END) + 1]
write(opening, fps, os.path.join(OUT, "open.mp4"))
write(opening[::-1], fps, os.path.join(OUT, "close.mp4"))
write(turn, fps, os.path.join(OUT, "turn.mp4"))
write(turn[::-1], fps, os.path.join(OUT, "turn-rev.mp4"))
cv2.imwrite(os.path.join(OUT, "cover.jpg"), frames[0], [cv2.IMWRITE_JPEG_QUALITY, 88])
cv2.imwrite(os.path.join(OUT, "page.jpg"), turn[-1], [cv2.IMWRITE_JPEG_QUALITY, 88])
# the home-screen icon: the cover's plaque and tree, square
h, w = frames[0].shape[:2]
side = int(w * 0.72)
cx, cy = int(w * 0.50), int(h * 0.47)
icon = frames[0][cy - side // 2 : cy + side // 2, cx - side // 2 : cx + side // 2]
cv2.imwrite(os.path.join(OUT, "icon-180.png"), cv2.resize(icon, (180, 180), interpolation=cv2.INTER_AREA))
cv2.imwrite(os.path.join(OUT, "icon-512.png"), cv2.resize(icon, (512, 512), interpolation=cv2.INTER_AREA))
print("posters and icons written")
