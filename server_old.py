#!/usr/bin/env python3
import subprocess, time, psutil, os
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

def run_osascript(script):
    try:
        r = subprocess.run(["osascript", "-e", script], capture_output=True, text=True, timeout=10)
        return r.stdout.strip()
    except Exception as e:
        return f"error: {e}"

def run_shell(cmd):
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=10)
        return r.stdout.strip()
    except Exception as e:
        return f"error: {e}"

@app.route("/api/status")
def system_status():
    cpu = psutil.cpu_percent(interval=0.5)
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    battery = psutil.sensors_battery()
    batt_percent = battery.percent if battery else -1
    batt_charging = battery.power_plugged if battery else False
    ms = 'tell application "System Events"\nif exists process "Music" then\ntell application "Music"\nif player state is playing then\nreturn "playing|" & name of current track & "|" & artist of current track\nelse if player state is paused then\nreturn "paused|" & name of current track & "|" & artist of current track\nelse\nreturn "stopped||"\nend if\nend tell\nelse\nreturn "closed||"\nend if\nend tell'
    mr = run_osascript(ms).split("|")
    music = {"state": mr[0] if len(mr) > 0 else "unknown", "track": mr[1] if len(mr) > 1 else "", "artist": mr[2] if len(mr) > 2 else ""}
    boot = psutil.boot_time()
    us = int(time.time() - boot)
    h, rem = divmod(us, 3600)
    m, _ = divmod(rem, 60)
    return jsonify({"cpu": cpu, "memory": round(mem.percent, 1), "memory_used_gb": round(mem.used / (1024**3), 1), "memory_total_gb": round(mem.total / (1024**3), 1), "disk_percent": round(disk.percent, 1), "disk_free_gb": round(disk.free / (1024**3), 1), "battery": batt_percent, "battery_charging": batt_charging, "music": music, "uptime": f"{h}h {m}m"})

@app.route("/api/music/play", methods=["POST"])
def music_play():
    run_osascript('tell application "Music" to play')
    return jsonify({"ok": True})

@app.route("/api/music/pause", methods=["POST"])
def music_pause():
    run_osascript('tell application "Music" to pause')
    return jsonify({"ok": True})

@app.route("/api/music/toggle", methods=["POST"])
def music_toggle():
    run_osascript('tell application "Music" to playpause')
    return jsonify({"ok": True})

@app.route("/api/music/next", methods=["POST"])
def music_next():
    run_osascript('tell application "Music" to next track')
    return jsonify({"ok": True})

@app.route("/api/music/prev", methods=["POST"])
def music_prev():
    run_osascript('tell application "Music" to previous track')
    return jsonify({"ok": True})

@app.route("/api/app/open", methods=["POST"])
def open_app_route():
    data = request.json or {}
    a = data.get("app", "")
    if not a:
        return jsonify({"ok": False}), 400
    run_osascript(f'tell application "{a}" to activate')
    return jsonify({"ok": True, "app": a})

@app.route("/api/apps/running")
def running_apps():
    s = "tell application \"System Events\"\nset al to name of every process whose background only is false\nset AppleScript's text item delimiters to \"|\"\nreturn al as text\nend tell"
    raw = run_osascript(s)
    return jsonify({"apps": [x.strip() for x in raw.split("|") if x.strip()]})

@app.route("/api/say", methods=["POST"])
def say_text():
    data = request.json or {}
    text = data.get("text", "")
    voice = data.get("voice", "Alice")
    rate = data.get("rate", 180)
    if not text:
        return jsonify({"ok": False}), 400
    subprocess.Popen(["say", "-v", voice, "-r", str(rate), text])
    return jsonify({"ok": True})

@app.route("/api/screenshot", methods=["POST"])
def take_screenshot():
    p = os.path.expanduser("~/Desktop/jarvis_screenshot.png")
    run_shell(f"screencapture -x {p}")
    return jsonify({"ok": True, "path": p})

@app.route("/api/volume", methods=["POST"])
def set_volume():
    data = request.json or {}
    level = data.get("level", 50)
    run_osascript(f"set volume output volume {level}")
    return jsonify({"ok": True, "volume": level})

@app.route("/api/volume/get")
def get_volume():
    vol = run_osascript("output volume of (get volume settings)")
    return jsonify({"ok": True, "volume": int(vol) if vol.isdigit() else 0})

@app.route("/api/dark-mode/toggle", methods=["POST"])
def toggle_dark_mode():
    run_osascript('tell application "System Events" to tell appearance preferences to set dark mode to not dark mode')
    return jsonify({"ok": True})

@app.route("/api/open-url", methods=["POST"])
def open_url():
    data = request.json or {}
    url = data.get("url", "")
    if not url:
        return jsonify({"ok": False}), 400
    if not url.startswith("http"):
        url = "https://" + url
    run_shell(f'open "{url}"')
    return jsonify({"ok": True, "url": url})

@app.route("/api/shutdown", methods=["POST"])
def shutdown_mac():
    data = request.json or {}
    mode = data.get("mode", "sleep")
    cmds = {
        "sleep": 'tell application "System Events" to sleep',
        "shutdown": 'tell application "System Events" to shut down',
        "restart": 'tell application "System Events" to restart'
    }
    if mode in cmds:
        run_osascript(cmds[mode])
        return jsonify({"ok": True, "mode": mode})
    return jsonify({"ok": False}), 400

@app.route("/api/ping")
def ping():
    return jsonify({"status": "online", "name": "J.A.R.V.I.S.", "version": "1.0"})

if __name__ == "__main__":
    print("\n  J.A.R.V.I.S. Server v1.0")
    print("  http://localhost:5100\n")
    app.run(host="127.0.0.1", port=5100, debug=False)
