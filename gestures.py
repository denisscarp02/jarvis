#!/usr/bin/env python3
"""
J.A.R.V.I.S. Gesture Control — MediaPipe Tasks API (v0.10+)
Gestures:
  - Pinch (pizzicotto) + drag: sposta la finestra in primo piano
  - Swipe right (mano aperta da sx a dx): prossimo desktop / app fullscreen
  - Swipe left (mano aperta da dx a sx): desktop precedente / app fullscreen
"""

import json, math, os, subprocess, sys, time, urllib.request
from pathlib import Path

import cv2
import numpy as np
import mediapipe as mp

BaseOptions = mp.tasks.BaseOptions
HandLandmarker = mp.tasks.vision.HandLandmarker
HandLandmarkerOptions = mp.tasks.vision.HandLandmarkerOptions
RunningMode = mp.tasks.vision.RunningMode

MODEL_PATH = Path(__file__).parent / "hand_landmarker.task"

# Landmark indices (MediaPipe hand model)
WRIST = 0
THUMB_TIP = 4
INDEX_TIP = 8
MIDDLE_TIP = 12
RING_TIP = 16
PINKY_TIP = 20
INDEX_PIP = 6
MIDDLE_PIP = 10
MIDDLE_MCP = 9
RING_PIP = 14
PINKY_PIP = 18

# ── Helpers ──────────────────────────────────────────────────────────────────

def run_osascript(script):
    try:
        subprocess.run(["osascript", "-e", script], capture_output=True, text=True, timeout=5)
    except Exception:
        pass

def get_screen_size():
    script = ('tell application "Finder"\n'
              'set _b to bounds of window of desktop\n'
              'return (item 3 of _b) & "," & (item 4 of _b)\nend tell')
    try:
        r = subprocess.run(["osascript", "-e", script], capture_output=True, text=True, timeout=5)
        parts = r.stdout.strip().split(",")
        return int(parts[0].strip()), int(parts[1].strip())
    except Exception:
        return 1920, 1080

def dist(lm, i1, i2):
    a, b = lm[i1], lm[i2]
    return math.sqrt((a.x - b.x)**2 + (a.y - b.y)**2)

def notify_hud(gesture_name):
    try:
        data = json.dumps({"gesture": gesture_name}).encode()
        req = urllib.request.Request("http://localhost:5100/api/gesture",
                                     data=data, headers={"Content-Type": "application/json"})
        urllib.request.urlopen(req, timeout=1)
    except Exception:
        pass

# ── Gesture Detector ─────────────────────────────────────────────────────────

class GestureController:
    def __init__(self):
        self.screen_w, self.screen_h = get_screen_size()

        # Pinch state
        self.pinch_active = False
        self.pinch_start_x = 0
        self.pinch_start_y = 0
        self.win_start_x = 0
        self.win_start_y = 0

        # Swipe state
        self.swipe_tracking = False
        self.swipe_start_x = 0
        self.swipe_start_time = 0
        self.swipe_cooldown = 0

    def is_pinching(self, lm):
        return dist(lm, THUMB_TIP, INDEX_TIP) < 0.05

    def is_open_hand(self, lm):
        tips = [INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP]
        pips = [INDEX_PIP, MIDDLE_PIP, RING_PIP, PINKY_PIP]
        extended = sum(1 for t, p in zip(tips, pips) if lm[t].y < lm[p].y)
        return extended >= 3

    def get_frontmost_window_pos(self):
        script = ('tell application "System Events"\n'
                  'set fp to first process whose frontmost is true\n'
                  'tell fp\nset wp to position of window 1\n'
                  'return (item 1 of wp) & "," & (item 2 of wp)\n'
                  'end tell\nend tell')
        try:
            r = subprocess.run(["osascript", "-e", script], capture_output=True, text=True, timeout=3)
            parts = r.stdout.strip().split(",")
            return int(parts[0].strip()), int(parts[1].strip())
        except Exception:
            return 0, 0

    def move_frontmost_window(self, x, y):
        script = (f'tell application "System Events"\n'
                  f'set fp to first process whose frontmost is true\n'
                  f'tell fp\nset position of window 1 to {{{int(x)}, {int(y)}}}\n'
                  f'end tell\nend tell')
        run_osascript(script)

    def swipe_desktop(self, direction):
        now = time.time()
        if now < self.swipe_cooldown:
            return
        self.swipe_cooldown = now + 1.0

        if direction == "right":
            run_osascript('tell application "System Events" to key code 124 using control down')
            notify_hud("swipe_right")
            print("[Gesture] Swipe RIGHT -> desktop successivo")
        elif direction == "left":
            run_osascript('tell application "System Events" to key code 123 using control down')
            notify_hud("swipe_left")
            print("[Gesture] Swipe LEFT -> desktop precedente")

    def process(self, landmarks):
        """Process hand landmarks list."""
        lm = landmarks
        now = time.time()

        # ── Pinch ────────────────────────────────────────────────────────
        if self.is_pinching(lm):
            cx = (lm[THUMB_TIP].x + lm[INDEX_TIP].x) / 2
            cy = (lm[THUMB_TIP].y + lm[INDEX_TIP].y) / 2
            screen_x = (1 - cx) * self.screen_w  # mirrored
            screen_y = cy * self.screen_h

            if not self.pinch_active:
                self.pinch_active = True
                self.pinch_start_x = screen_x
                self.pinch_start_y = screen_y
                self.win_start_x, self.win_start_y = self.get_frontmost_window_pos()
                notify_hud("pinch_start")
                print("[Gesture] Pinch START")
            else:
                dx = screen_x - self.pinch_start_x
                dy = screen_y - self.pinch_start_y
                self.move_frontmost_window(self.win_start_x + dx, self.win_start_y + dy)
        else:
            if self.pinch_active:
                self.pinch_active = False
                notify_hud("pinch_end")
                print("[Gesture] Pinch END")

        # ── Swipe ────────────────────────────────────────────────────────
        if self.is_open_hand(lm) and not self.pinch_active:
            palm_x = (lm[WRIST].x + lm[MIDDLE_MCP].x) / 2

            if not self.swipe_tracking:
                self.swipe_tracking = True
                self.swipe_start_x = palm_x
                self.swipe_start_time = now
            else:
                dx = palm_x - self.swipe_start_x
                elapsed = now - self.swipe_start_time

                if elapsed < 0.6 and abs(dx) > 0.25:
                    self.swipe_desktop("left" if dx > 0 else "right")
                    self.swipe_tracking = False
                elif elapsed > 0.8:
                    self.swipe_tracking = False
        else:
            self.swipe_tracking = False


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    print("\n  J.A.R.V.I.S. Gesture Control")
    print("  Gesture:")
    print("    - Pizzicotto + trascina: sposta finestra")
    print("    - Swipe mano aperta: cambia desktop")
    print("    - Ctrl+C per uscire\n")

    if not MODEL_PATH.exists():
        print(f"[Errore] Modello non trovato: {MODEL_PATH}")
        print("  Scaricalo con:")
        print('  curl -sL -o hand_landmarker.task "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task"')
        sys.exit(1)

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("[Errore] Impossibile aprire la videocamera.")
        sys.exit(1)

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    cap.set(cv2.CAP_PROP_FPS, 30)

    controller = GestureController()
    show_preview = "--preview" in sys.argv

    options = HandLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=str(MODEL_PATH)),
        running_mode=RunningMode.VIDEO,
        num_hands=1,
        min_hand_detection_confidence=0.7,
        min_tracking_confidence=0.6,
    )

    with HandLandmarker.create_from_options(options) as landmarker:
        print("[OK] Hand landmarker caricato, videocamera attiva.")
        try:
            frame_ts = 0
            while True:
                ret, frame = cap.read()
                if not ret:
                    continue

                frame_ts += 33  # ~30fps in ms
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)

                result = landmarker.detect_for_video(mp_image, frame_ts)

                if result.hand_landmarks:
                    landmarks = result.hand_landmarks[0]
                    controller.process(landmarks)

                    if show_preview:
                        h, w = frame.shape[:2]
                        for lm in landmarks:
                            cx, cy = int(lm.x * w), int(lm.y * h)
                            cv2.circle(frame, (cx, cy), 3, (0, 212, 255), -1)

                if show_preview:
                    status = "PINCH" if controller.pinch_active else "IDLE"
                    cv2.putText(frame, f"JARVIS | {status}", (10, 30),
                               cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 212, 255), 2)
                    cv2.imshow("J.A.R.V.I.S. Gesture", frame)
                    if cv2.waitKey(1) & 0xFF == ord('q'):
                        break
                else:
                    time.sleep(0.01)

        except KeyboardInterrupt:
            print("\n  Gesture control fermato.")
        finally:
            cap.release()
            if show_preview:
                cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
