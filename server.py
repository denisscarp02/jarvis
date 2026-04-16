#!/usr/bin/env python3
"""
J.A.R.V.I.S. Server v2.0 — FastAPI backend with WebSocket, Gemini AI, edge-tts
"""

import asyncio, glob, json, os, re, subprocess, time
from contextlib import asynccontextmanager
from pathlib import Path

import psutil
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

# ── Config ───────────────────────────────────────────────────────────────────

BASE_DIR = Path(__file__).parent
CONFIG_PATH = BASE_DIR / "config.json"
TTS_CACHE = BASE_DIR / "tts_cache"
TTS_CACHE.mkdir(exist_ok=True)

def load_config():
    if CONFIG_PATH.exists():
        return json.loads(CONFIG_PATH.read_text())
    return {}

CFG = load_config()

# ── FastAPI app ──────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app):
    print("\n  J.A.R.V.I.S. Server v2.0")
    print("  http://localhost:5100\n")
    asyncio.create_task(status_broadcaster())
    yield

app = FastAPI(title="J.A.R.V.I.S.", version="2.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Static mounts
app.mount("/tts_cache", StaticFiles(directory=str(TTS_CACHE)), name="tts_cache")
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")

# ── Helpers ──────────────────────────────────────────────────────────────────

def run_osascript(script: str) -> str:
    try:
        r = subprocess.run(["osascript", "-e", script], capture_output=True, text=True, timeout=10)
        return r.stdout.strip()
    except Exception as e:
        return f"error: {e}"

def run_shell(cmd: str) -> str:
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=10)
        return r.stdout.strip()
    except Exception as e:
        return f"error: {e}"

# ── System Status ────────────────────────────────────────────────────────────

def _get_battery_pmset() -> tuple[int, bool, str]:
    """Get accurate battery from macOS pmset (more reliable than psutil)."""
    try:
        r = subprocess.run(["pmset", "-g", "batt"], capture_output=True, text=True, timeout=5)
        for line in r.stdout.split("\n"):
            if "%" in line:
                import re
                m = re.search(r"(\d+)%", line)
                pct = int(m.group(1)) if m else -1
                charging = "charging" in line and "discharging" not in line
                remaining = ""
                rm = re.search(r"(\d+:\d+) remaining", line)
                if rm:
                    remaining = rm.group(1)
                return pct, charging, remaining
    except Exception:
        pass
    b = psutil.sensors_battery()
    return (b.percent if b else -1, b.power_plugged if b else False, "")

# Keep a running CPU average (non-blocking)
psutil.cpu_percent(interval=None)  # prime the counter

def get_system_status() -> dict:
    cpu = psutil.cpu_percent(interval=None)  # non-blocking, uses delta since last call
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    batt_percent, batt_charging, batt_remaining = _get_battery_pmset()

    ms = ('tell application "System Events"\n'
          'if exists process "Music" then\n'
          'tell application "Music"\n'
          'if player state is playing then\n'
          'return "playing|" & name of current track & "|" & artist of current track\n'
          'else if player state is paused then\n'
          'return "paused|" & name of current track & "|" & artist of current track\n'
          'else\nreturn "stopped||"\nend if\nend tell\n'
          'else\nreturn "closed||"\nend if\nend tell')
    mr = run_osascript(ms).split("|")
    music = {
        "state": mr[0] if len(mr) > 0 else "unknown",
        "track": mr[1] if len(mr) > 1 else "",
        "artist": mr[2] if len(mr) > 2 else ""
    }

    boot = psutil.boot_time()
    us = int(time.time() - boot)
    h, rem = divmod(us, 3600)
    m, _ = divmod(rem, 60)

    return {
        "cpu": round(cpu, 1),
        "memory": round(mem.percent, 1),
        "memory_used_gb": round(mem.used / (1024**3), 1),
        "memory_total_gb": round(mem.total / (1024**3), 1),
        "disk_percent": round(disk.percent, 1),
        "disk_free_gb": round(disk.free / (1024**3), 1),
        "battery": batt_percent,
        "battery_charging": batt_charging,
        "battery_remaining": batt_remaining,
        "music": music,
        "uptime": f"{h}h {m}m",
        "timestamp": time.time()
    }

# ── Email (IMAP) ─────────────────────────────────────────────────────────────

def fetch_unread_emails(max_count=5) -> list[dict]:
    """Fetch unread email subjects via IMAP. Returns list of {from, subject, date}."""
    addr = CFG.get("gmail_address", "")
    pwd = CFG.get("gmail_app_password", "")
    if not addr or not pwd:
        return []
    try:
        import imaplib, email
        from email.header import decode_header

        imap = imaplib.IMAP4_SSL("imap.gmail.com")
        imap.login(addr, pwd)
        imap.select("INBOX")
        _, msgs = imap.search(None, "UNSEEN")
        ids = msgs[0].split()
        if not ids:
            imap.logout()
            return []

        results = []
        for mid in ids[-max_count:]:
            _, data = imap.fetch(mid, "(BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)])")
            if data[0] is None:
                continue
            raw = data[0][1]
            msg = email.message_from_bytes(raw)

            subj = msg.get("Subject", "")
            decoded = decode_header(subj)
            subject = ""
            for part, enc in decoded:
                if isinstance(part, bytes):
                    subject += part.decode(enc or "utf-8", errors="replace")
                else:
                    subject += part

            from_raw = msg.get("From", "")
            decoded_from = decode_header(from_raw)
            sender = ""
            for part, enc in decoded_from:
                if isinstance(part, bytes):
                    sender += part.decode(enc or "utf-8", errors="replace")
                else:
                    sender += part
            # Clean sender - just the name part
            if "<" in sender:
                sender = sender.split("<")[0].strip().strip('"')

            results.append({"from": sender, "subject": subject[:80]})

        imap.logout()
        return results
    except Exception as e:
        print(f"[Email] IMAP error: {e}")
        return []

# ── TTS (edge-tts) ──────────────────────────────────────────────────────────

async def generate_speech(text: str) -> str | None:
    if not CFG.get("tts_enabled", True) or not text.strip():
        return None
    voice = CFG.get("tts_voice", "it-IT-DiegoNeural")
    filename = f"tts_{int(time.time()*1000)}.mp3"
    filepath = TTS_CACHE / filename
    try:
        import edge_tts
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(str(filepath))
        cleanup_tts_cache()
        return f"/tts_cache/{filename}"
    except Exception as e:
        print(f"[TTS] edge-tts failed: {e}, trying macOS say")
        try:
            wav_path = TTS_CACHE / filename.replace(".mp3", ".aiff")
            subprocess.run(["say", "-v", "Alice", "-o", str(wav_path), text],
                         capture_output=True, timeout=15)
            subprocess.run(["ffmpeg", "-y", "-i", str(wav_path), "-q:a", "4", str(filepath)],
                         capture_output=True, timeout=15)
            wav_path.unlink(missing_ok=True)
            cleanup_tts_cache()
            return f"/tts_cache/{filename}"
        except Exception as e2:
            print(f"[TTS] fallback also failed: {e2}")
            return None

def cleanup_tts_cache():
    max_files = CFG.get("max_tts_cache_files", 50)
    files = sorted(TTS_CACHE.glob("tts_*"), key=lambda f: f.stat().st_mtime)
    while len(files) > max_files:
        files.pop(0).unlink(missing_ok=True)

# ── Gemini AI ────────────────────────────────────────────────────────────────

_gemini_chat = None

def get_gemini_chat():
    global _gemini_chat
    api_key = CFG.get("gemini_api_key", "")
    if not api_key:
        return None
    if _gemini_chat is None:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            "gemini-2.0-flash",
            system_instruction=(
                f"Sei J.A.R.V.I.S., Just A Rather Very Intelligent System, "
                f"l'assistente AI personale del signor {CFG.get('user_name', 'Dennis')}. "
                "Parli SOLO in italiano. Il tuo stile e' ESATTAMENTE quello del J.A.R.V.I.S. "
                "dei film Iron Man interpretato da Paul Bettany: formale ma non rigido, "
                "dai del lei al signor Dennis, sei cortese, preciso, con un sottile umorismo "
                "inglese e occasionali osservazioni argute. "
                "Sei un maggiordomo digitale di altissimo livello. "
                "Rispondi sempre in modo conciso, mai piu' di 2-3 frasi. "
                "Quando confermi un'azione di sistema, sii elegante: "
                "'Fatto, signore' oppure 'Come desidera' oppure 'Certamente'. "
                "Non usare MAI markdown, emoji o formattazione. Parla come parleresti a voce. "
                "Se il signor Dennis ti chiede qualcosa di impossibile, rispondi con garbo e ironia."
            )
        )
        _gemini_chat = model.start_chat(history=[])
    return _gemini_chat

async def ask_gemini(message: str, system_context: str = "") -> str:
    chat = get_gemini_chat()
    if chat is None:
        return ("Non ho ancora la chiave API di Gemini. "
                "Inseriscila in config.json per attivarmi completamente.")
    try:
        prompt = message
        if system_context:
            prompt = f"[Stato sistema: {system_context}]\n\nUtente: {message}"
        response = chat.send_message(prompt)
        return response.text.strip()
    except Exception as e:
        return f"Mi dispiace, ho avuto un problema: {e}"

# ── Italian Command Parser ───────────────────────────────────────────────────

def parse_command(text: str) -> dict | None:
    t = text.lower().strip()

    # App launch
    m = re.match(r"(?:apri|lancia|avvia|apri\s*l'app)\s+(.+)", t)
    if m:
        return {"action": "open_app", "app": m.group(1).strip().title()}

    # Music
    if any(w in t for w in ["play", "riproduci", "fai partire la musica"]):
        return {"action": "music_play"}
    if any(w in t for w in ["pausa", "metti in pausa", "ferma la musica", "stop"]):
        return {"action": "music_pause"}
    if any(w in t for w in ["prossima", "prossima canzone", "avanti", "skip", "next"]):
        return {"action": "music_next"}
    if any(w in t for w in ["precedente", "canzone precedente", "indietro", "previous"]):
        return {"action": "music_prev"}
    if any(w in t for w in ["musica", "toggle musica"]):
        return {"action": "music_toggle"}

    # Volume
    m = re.match(r"(?:volume|metti il volume)\s*(?:a|al)?\s*(\d+)", t)
    if m:
        return {"action": "set_volume", "level": int(m.group(1))}
    if any(w in t for w in ["alza volume", "volume su", "piu forte"]):
        return {"action": "volume_up"}
    if any(w in t for w in ["abbassa volume", "volume giu", "piu piano"]):
        return {"action": "volume_down"}

    # Screenshot
    if any(w in t for w in ["screenshot", "cattura schermo", "schermata"]):
        return {"action": "screenshot"}

    # Dark mode
    if any(w in t for w in ["modo scuro", "dark mode", "tema scuro", "cambia tema"]):
        return {"action": "dark_mode"}

    # System
    if any(w in t for w in ["spegni", "spegniti", "shutdown"]):
        return {"action": "shutdown", "mode": "shutdown"}
    if any(w in t for w in ["riavvia", "restart"]):
        return {"action": "shutdown", "mode": "restart"}
    if any(w in t for w in ["sospendi", "dormi", "sleep", "a nanna"]):
        return {"action": "shutdown", "mode": "sleep"}

    return None

async def execute_command(cmd: dict) -> str:
    action = cmd["action"]

    if action == "open_app":
        app_name = cmd["app"]
        run_osascript(f'tell application "{app_name}" to activate')
        return f"Apro {app_name}."

    if action == "music_play":
        run_osascript('tell application "Music" to play')
        return "Musica in riproduzione."
    if action == "music_pause":
        run_osascript('tell application "Music" to pause')
        return "Musica in pausa."
    if action == "music_toggle":
        run_osascript('tell application "Music" to playpause')
        return "Toggle musica."
    if action == "music_next":
        run_osascript('tell application "Music" to next track')
        return "Prossima canzone."
    if action == "music_prev":
        run_osascript('tell application "Music" to previous track')
        return "Canzone precedente."

    if action == "set_volume":
        level = cmd["level"]
        run_osascript(f"set volume output volume {level}")
        return f"Volume impostato a {level}."
    if action == "volume_up":
        vol = run_osascript("output volume of (get volume settings)")
        new_vol = min(100, int(vol) + 15) if vol.isdigit() else 60
        run_osascript(f"set volume output volume {new_vol}")
        return f"Volume alzato a {new_vol}."
    if action == "volume_down":
        vol = run_osascript("output volume of (get volume settings)")
        new_vol = max(0, int(vol) - 15) if vol.isdigit() else 40
        run_osascript(f"set volume output volume {new_vol}")
        return f"Volume abbassato a {new_vol}."

    if action == "screenshot":
        p = os.path.expanduser("~/Desktop/jarvis_screenshot.png")
        run_shell(f"screencapture -x {p}")
        return "Screenshot salvato sulla scrivania."

    if action == "dark_mode":
        run_osascript('tell application "System Events" to tell appearance preferences to set dark mode to not dark mode')
        return "Tema cambiato."

    if action == "shutdown":
        mode = cmd.get("mode", "sleep")
        cmds = {
            "sleep": 'tell application "System Events" to sleep',
            "shutdown": 'tell application "System Events" to shut down',
            "restart": 'tell application "System Events" to restart'
        }
        if mode in cmds:
            labels = {"sleep": "Sospendo il sistema.", "shutdown": "Spengo il sistema.", "restart": "Riavvio il sistema."}
            run_osascript(cmds[mode])
            return labels.get(mode, "Fatto.")

    return "Comando non riconosciuto."

# ── WebSocket Manager ────────────────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.connections: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.connections.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.connections:
            self.connections.remove(ws)

    async def broadcast(self, data: dict):
        dead = []
        for ws in self.connections:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

manager = ConnectionManager()

# ── WebSocket endpoint ───────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            data = await ws.receive_json()
            msg_type = data.get("type", "")

            if msg_type == "chat" or msg_type == "voice_transcript":
                text = data.get("text", "").strip()
                if not text:
                    continue

                # Try command first
                cmd = parse_command(text)
                if cmd:
                    result = await execute_command(cmd)
                    await ws.send_json({"type": "chat_response", "text": result, "is_command": True})
                    audio_url = await generate_speech(result)
                    if audio_url:
                        await ws.send_json({"type": "tts_audio", "url": audio_url})
                    continue

                # Otherwise ask Gemini
                await ws.send_json({"type": "thinking", "active": True})
                status = get_system_status()
                ctx = f"CPU: {status['cpu']}%, RAM: {status['memory']}%, Batteria: {status['battery']}%"
                if status["music"]["state"] == "playing":
                    ctx += f", Musica: {status['music']['track']} di {status['music']['artist']}"

                response = await ask_gemini(text, ctx)
                await ws.send_json({"type": "thinking", "active": False})
                await ws.send_json({"type": "chat_response", "text": response, "is_command": False})

                audio_url = await generate_speech(response)
                if audio_url:
                    await ws.send_json({"type": "tts_audio", "url": audio_url})

            elif msg_type == "command":
                action = data.get("action", "")
                cmd = {"action": action}
                cmd.update({k: v for k, v in data.items() if k not in ("type", "action")})
                result = await execute_command(cmd)
                await ws.send_json({"type": "command_result", "action": action, "text": result, "ok": True})

    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception as e:
        print(f"[WS] Error: {e}")
        manager.disconnect(ws)

# ── Background status broadcaster ────────────────────────────────────────────

async def status_broadcaster():
    interval = CFG.get("status_interval_seconds", 2)
    while True:
        await asyncio.sleep(interval)
        if manager.connections:
            try:
                status = get_system_status()
                await manager.broadcast({"type": "status", "data": status})
            except Exception:
                pass


# ── REST endpoints (backward compatible) ─────────────────────────────────────

@app.get("/")
async def serve_index():
    return FileResponse(str(BASE_DIR / "static" / "index.html"))

@app.get("/overlay")
async def serve_overlay():
    return FileResponse(str(BASE_DIR / "static" / "overlay.html"))

@app.get("/api/ping")
async def ping():
    return {"status": "online", "name": "J.A.R.V.I.S.", "version": "2.0"}

@app.get("/api/greeting")
async def greeting():
    """Iron Man movie-style J.A.R.V.I.S. greeting — like the real film."""
    import datetime
    now = datetime.datetime.now()
    hour = now.hour

    if hour < 6:
        saluto = "Buonanotte"
    elif hour < 12:
        saluto = "Buongiorno"
    elif hour < 14:
        saluto = "Buon pomeriggio"
    elif hour < 18:
        saluto = "Buon pomeriggio"
    else:
        saluto = "Buonasera"

    giorni = ["lunedi", "martedi", "mercoledi", "giovedi", "venerdi", "sabato", "domenica"]
    mesi = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
            "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"]
    giorno = giorni[now.weekday()]
    mese = mesi[now.month - 1]
    user = CFG.get("user_name", "Dennis")

    # Fresh system status
    status = get_system_status()
    batt = status["battery"]
    remaining = status.get("battery_remaining", "")
    cpu = status["cpu"]
    ram = status["memory"]

    # Email digest

    # Build greeting — Jarvis movie style: formal, precise, useful
    parts = []

    # Opening — like the film: "Good morning, sir. It's 7am..."
    parts.append(
        f"{saluto} signor {user}. "
        f"Sono le {hour}:{now.minute:02d} di {giorno} {now.day} {mese}."
    )

    # System report — precise, real numbers
    sys_report = f"Rapporto sistemi: processore al {cpu:.0f} percento, memoria al {ram:.0f} percento"
    if batt >= 0:
        sys_report += f", batteria al {batt} percento"
        if status["battery_charging"]:
            sys_report += " in carica"
        elif remaining:
            sys_report += f", autonomia stimata {remaining.replace(':', ' ore e ')} minuti"
    sys_report += ". Tutti i sistemi nominali."
    parts.append(sys_report)

    # Music — casual mention
    if status["music"]["state"] == "playing":
        parts.append(
            f"Noto che sta ascoltando {status['music']['track']} di {status['music']['artist']}."
        )

    # Emails — use daily digest file if available, otherwise live IMAP
    digest_path = BASE_DIR / "daily_digest.json"
    digest_used = False
    if digest_path.exists():
        try:
            import datetime as _dt
            digest = json.loads(digest_path.read_text())
            if digest.get("date") == _dt.datetime.now().strftime("%Y-%m-%d") and digest.get("summary_voice"):
                parts.append(digest["summary_voice"])
                digest_used = True
        except Exception:
            pass

    if not digest_used:
        emails = fetch_unread_emails(5)
        if emails:
            n = len(emails)
            important = [e for e in emails if not any(
                kw in (e.get("from", "") + e.get("subject", "")).lower()
                for kw in ["promo", "news@", "noreply", "newsletter", "marionnaud",
                           "vans", "dressinn", "tradeinn", "statuspage", "trabajo"]
            )]
            if important:
                parts.append(f"Ha {n} email non lette. Tra quelle degne di nota: "
                    + ", ".join(f"{e['from']}" for e in important[:2]) + ".")
            else:
                parts.append(f"Ha {n} email non lette, nulla di urgente.")
        else:
            parts.append("Nessuna nuova email al momento.")

    # Market summary
    try:
        import httpx
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get("https://financialmodelingprep.com/api/v3/quote/SPY,QQQ,AAPL?apikey=oxySZoo7QEhfBVJMvwSc9ymKpx8fNL82")
            if r.status_code == 200:
                mkts = r.json()
                mkt_parts = []
                for m in mkts:
                    name = {"SPY": "S&P 500", "QQQ": "Nasdaq", "AAPL": "Apple"}.get(m["symbol"], m["symbol"])
                    ch = m.get("changesPercentage", 0)
                    direction = "in rialzo" if ch > 0 else "in ribasso" if ch < 0 else "invariato"
                    mkt_parts.append(f"{name} {direction} del {abs(ch):.1f} percento")
                if mkt_parts:
                    parts.append("Situazione mercati: " + ", ".join(mkt_parts) + ".")
    except Exception:
        pass

    # Closing — ready to serve
    parts.append("Sono a sua completa disposizione.")

    text = " ".join(parts)
    audio_url = await generate_speech(text)

    return {"text": text, "audio_url": audio_url}

@app.get("/api/emails")
async def get_emails():
    emails = fetch_unread_emails(10)
    return {"emails": emails, "count": len(emails)}

@app.get("/api/status")
async def system_status():
    return get_system_status()

@app.post("/api/music/play")
async def music_play():
    run_osascript('tell application "Music" to play')
    return {"ok": True}

@app.post("/api/music/pause")
async def music_pause():
    run_osascript('tell application "Music" to pause')
    return {"ok": True}

@app.post("/api/music/toggle")
async def music_toggle():
    run_osascript('tell application "Music" to playpause')
    return {"ok": True}

@app.post("/api/music/next")
async def music_next():
    run_osascript('tell application "Music" to next track')
    return {"ok": True}

@app.post("/api/music/prev")
async def music_prev():
    run_osascript('tell application "Music" to previous track')
    return {"ok": True}

@app.post("/api/app/open")
async def open_app_route(request: Request):
    data = await request.json()
    a = data.get("app", "")
    if not a:
        return JSONResponse({"ok": False}, 400)
    run_osascript(f'tell application "{a}" to activate')
    return {"ok": True, "app": a}

@app.get("/api/apps/running")
async def running_apps():
    s = ('tell application "System Events"\n'
         'set al to name of every process whose background only is false\n'
         'set AppleScript\'s text item delimiters to "|"\n'
         'return al as text\nend tell')
    raw = run_osascript(s)
    return {"apps": [x.strip() for x in raw.split("|") if x.strip()]}

@app.post("/api/say")
async def say_text(request: Request):
    data = await request.json()
    text = data.get("text", "")
    voice = data.get("voice", "Alice")
    rate = data.get("rate", 180)
    if not text:
        return JSONResponse({"ok": False}, 400)
    subprocess.Popen(["say", "-v", voice, "-r", str(rate), text])
    return {"ok": True}

@app.post("/api/screenshot")
async def take_screenshot():
    p = os.path.expanduser("~/Desktop/jarvis_screenshot.png")
    run_shell(f"screencapture -x {p}")
    return {"ok": True, "path": p}

@app.post("/api/volume")
async def set_volume(request: Request):
    data = await request.json()
    level = data.get("level", 50)
    run_osascript(f"set volume output volume {level}")
    return {"ok": True, "volume": level}

@app.get("/api/volume/get")
async def get_volume():
    vol = run_osascript("output volume of (get volume settings)")
    return {"ok": True, "volume": int(vol) if vol.isdigit() else 0}

@app.post("/api/dark-mode/toggle")
async def toggle_dark_mode():
    run_osascript('tell application "System Events" to tell appearance preferences to set dark mode to not dark mode')
    return {"ok": True}

@app.post("/api/open-url")
async def open_url(request: Request):
    data = await request.json()
    url = data.get("url", "")
    if not url:
        return JSONResponse({"ok": False}, 400)
    if not url.startswith("http"):
        url = "https://" + url
    run_shell(f'open "{url}"')
    return {"ok": True, "url": url}

@app.post("/api/shutdown")
async def shutdown_mac(request: Request):
    data = await request.json()
    mode = data.get("mode", "sleep")
    cmds = {
        "sleep": 'tell application "System Events" to sleep',
        "shutdown": 'tell application "System Events" to shut down',
        "restart": 'tell application "System Events" to restart'
    }
    if mode in cmds:
        run_osascript(cmds[mode])
        return {"ok": True, "mode": mode}
    return JSONResponse({"ok": False}, 400)

@app.post("/api/clap")
async def clap_event(request: Request):
    data = await request.json()
    await manager.broadcast({"type": "clap_event", "apps": data.get("apps", [])})
    return {"ok": True}

@app.post("/api/gesture")
async def gesture_event(request: Request):
    data = await request.json()
    gesture = data.get("gesture", "")
    await manager.broadcast({"type": "gesture", "gesture": gesture})
    return {"ok": True}

# ── Dashboard ────────────────────────────────────────────────────────────────

app.mount("/dashboard", StaticFiles(directory=str(BASE_DIR / "static" / "dashboard"), html=True), name="dashboard")

@app.get("/finscope")
async def serve_dashboard():
    return FileResponse(str(BASE_DIR / "static" / "dashboard" / "index.html"))

@app.get("/email-report")
async def serve_email_report():
    return FileResponse(str(BASE_DIR / "static" / "dashboard" / "email-report.html"))

@app.get("/api/digest")
async def get_digest():
    digest_path = BASE_DIR / "daily_digest.json"
    if digest_path.exists():
        return json.loads(digest_path.read_text())
    return {"total": 0, "summary_voice": ""}

# ── Auth: WebAuthn + Guest ───────────────────────────────────────────────────

AUTH_FILE = BASE_DIR / "auth_data.json"
GUEST_LOG_FILE = BASE_DIR / "guest_log.json"

def load_auth():
    if AUTH_FILE.exists():
        return json.loads(AUTH_FILE.read_text())
    return {"credentials": [], "owner_registered": False}

def save_auth(data):
    AUTH_FILE.write_text(json.dumps(data, indent=2))

def load_guest_log():
    if GUEST_LOG_FILE.exists():
        return json.loads(GUEST_LOG_FILE.read_text())
    return []

def save_guest_log(log):
    GUEST_LOG_FILE.write_text(json.dumps(log, indent=2))

import base64, hashlib, secrets

# WebAuthn challenge store (in-memory, short-lived)
_challenges = {}

@app.get("/api/auth/challenge")
async def auth_challenge():
    challenge = secrets.token_bytes(32)
    challenge_b64 = base64.urlsafe_b64encode(challenge).decode()
    _challenges[challenge_b64] = time.time()
    # Cleanup old challenges
    now = time.time()
    for k in list(_challenges):
        if now - _challenges[k] > 300:
            del _challenges[k]
    return {"challenge": challenge_b64, "rp": {"name": "FinScope", "id": "localhost"}}

@app.post("/api/auth/register")
async def auth_register(request: Request):
    data = await request.json()
    auth = load_auth()
    auth["credentials"].append({
        "id": data.get("id", ""),
        "rawId": data.get("rawId", ""),
        "type": data.get("type", "public-key"),
        "registered_at": time.time()
    })
    auth["owner_registered"] = True
    save_auth(auth)
    return {"ok": True}

@app.post("/api/auth/verify")
async def auth_verify(request: Request):
    data = await request.json()
    auth = load_auth()
    cred_id = data.get("id", "")
    known = any(c["id"] == cred_id for c in auth["credentials"])
    return {"ok": known, "role": "owner" if known else "none"}

@app.get("/api/auth/status")
async def auth_status():
    auth = load_auth()
    return {"owner_registered": auth["owner_registered"]}

@app.post("/api/auth/guest")
async def auth_guest(request: Request):
    data = await request.json()
    name = data.get("name", "Ospite").strip()[:50]
    # Get client IP
    ip = request.client.host if request.client else "unknown"
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        ip = forwarded.split(",")[0].strip()

    log = load_guest_log()
    log.append({
        "name": name,
        "ip": ip,
        "user_agent": request.headers.get("user-agent", "")[:200],
        "timestamp": time.time(),
        "time_str": time.strftime("%Y-%m-%d %H:%M:%S")
    })
    # Keep last 100 entries
    log = log[-100:]
    save_guest_log(log)
    return {"ok": True, "role": "guest", "name": name}

@app.get("/api/auth/guest-log")
async def get_guest_log():
    """Only accessible from the local machine (owner)."""
    log = load_guest_log()
    return {"log": log}

# ── Market Summary (for Jarvis greeting) ─────────────────────────────────────

@app.get("/api/markets/summary")
async def market_summary():
    """Quick market overview for Jarvis voice greeting."""
    import httpx
    FMP = "https://financialmodelingprep.com/api/v3"
    key = "oxySZoo7QEhfBVJMvwSc9ymKpx8fNL82"
    symbols = ["^GSPC", "^IXIC", "AAPL", "BTC-USD", "GC=F"]
    names = {"^GSPC": "S&P 500", "^IXIC": "Nasdaq", "AAPL": "Apple", "BTC-USD": "Bitcoin", "GC=F": "Oro"}

    results = []
    # Use FMP batch quote
    try:
        syms = ",".join(["SPY", "QQQ", "AAPL"])
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(f"{FMP}/quote/{syms}?apikey={key}")
            if r.status_code == 200:
                for q in r.json():
                    results.append({
                        "name": q.get("name", q.get("symbol", "")),
                        "symbol": q.get("symbol", ""),
                        "price": q.get("price", 0),
                        "change_pct": round(q.get("changesPercentage", 0), 2)
                    })
    except Exception as e:
        print(f"[Markets] Error: {e}")

    return {"markets": results}

# ── Run ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=5100, log_level="warning")
