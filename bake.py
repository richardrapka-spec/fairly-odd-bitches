"""Bake the book's video from the Grok page-turn clip.

The whole clip plays as one continuous film: the cover opens (~7.8 s), then
three page turns, each resting on an identical blank spread. The app stops
the film at saved rest times (one per page, tuned with the slider in ?tune)
and plays it backwards for a backward turn — from a reversed bake, because
iPhone Safari cannot play video in reverse.

  python bake.py "C:\\Users\\richa\\Downloads\\grok-video-....mp4"

Writes docs/assets/full.mp4, full-rev.mp4, cover.jpg and the icons.
"""
import os
import sys

import av
import cv2

SRC = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\richa\Downloads\grok-video-0dc4fea5-221c-4e53-9771-bb7daf5d81c0.mp4"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "docs", "assets")
os.makedirs(OUT, exist_ok=True)


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
    # a keyframe every 12 frames: seeking to a rest time lands fast and clean
    stream.options = {"crf": "21", "preset": "medium", "profile": "high", "movflags": "+faststart", "x264-params": "keyint=12:min-keyint=12:scenecut=0"}
    for frame in frames:
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        for packet in stream.encode(av.VideoFrame.from_ndarray(rgb, format="rgb24")):
            container.mux(packet)
    for packet in stream.encode():
        container.mux(packet)
    container.close()
    print(f"{os.path.basename(dest)}: {len(frames)} frames, {os.path.getsize(dest) // 1024} KB")


frames, fps = load(SRC)
write(frames, fps, os.path.join(OUT, "full.mp4"))
write(frames[::-1], fps, os.path.join(OUT, "full-rev.mp4"))
cv2.imwrite(os.path.join(OUT, "cover.jpg"), frames[0], [cv2.IMWRITE_JPEG_QUALITY, 88])
h, w = frames[0].shape[:2]
side = int(w * 0.72)
cx, cy = int(w * 0.50), int(h * 0.47)
icon = frames[0][cy - side // 2 : cy + side // 2, cx - side // 2 : cx + side // 2]
cv2.imwrite(os.path.join(OUT, "icon-180.png"), cv2.resize(icon, (180, 180), interpolation=cv2.INTER_AREA))
cv2.imwrite(os.path.join(OUT, "icon-512.png"), cv2.resize(icon, (512, 512), interpolation=cv2.INTER_AREA))
for stale in ("open.mp4", "close.mp4", "turn.mp4", "turn-rev.mp4", "page.jpg"):
    path = os.path.join(OUT, stale)
    if os.path.exists(path):
        os.remove(path)
print(f"duration {len(frames) / fps:.2f}s at {fps:g} fps; poster and icons written")
