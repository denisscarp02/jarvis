#!/usr/bin/env python3
"""
J.A.R.V.I.S. Email Digest — genera il riepilogo giornaliero delle email.
Eseguito ogni mattina alle 9:00 via LaunchAgent.
Salva il digest in /Users/denisscarp/jarvis/daily_digest.json
"""

import imaplib, email, json, os, time
from email.header import decode_header
from pathlib import Path

BASE_DIR = Path(__file__).parent
CONFIG_PATH = BASE_DIR / "config.json"
DIGEST_PATH = BASE_DIR / "daily_digest.json"

def load_config():
    if CONFIG_PATH.exists():
        return json.loads(CONFIG_PATH.read_text())
    return {}

def decode_header_value(raw):
    decoded = decode_header(raw or "")
    result = ""
    for part, enc in decoded:
        if isinstance(part, bytes):
            result += part.decode(enc or "utf-8", errors="replace")
        else:
            result += part
    return result.strip()

def fetch_emails(cfg, max_count=20):
    addr = cfg.get("gmail_address", "")
    pwd = cfg.get("gmail_app_password", "")
    if not addr or not pwd:
        return []

    try:
        imap = imaplib.IMAP4_SSL("imap.gmail.com")
        imap.login(addr, pwd)
        imap.select("INBOX")

        # Cerca email delle ultime 24 ore
        import datetime
        since = (datetime.datetime.now() - datetime.timedelta(days=1)).strftime("%d-%b-%Y")
        _, msgs = imap.search(None, f'(SINCE "{since}")')
        ids = msgs[0].split()

        results = []
        for mid in ids[-max_count:]:
            _, data = imap.fetch(mid, "(BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)] FLAGS)")
            if data[0] is None:
                continue

            raw = data[0][1]
            msg = email.message_from_bytes(raw)

            subject = decode_header_value(msg.get("Subject", ""))
            sender_raw = decode_header_value(msg.get("From", ""))
            sender = sender_raw.split("<")[0].strip().strip('"') if "<" in sender_raw else sender_raw
            date_str = msg.get("Date", "")

            # Check if read
            flags = data[1] if len(data) > 1 else b""
            is_read = b"\\Seen" in (flags if isinstance(flags, bytes) else b"")

            # Classify
            is_promo = any(kw in (sender + subject).lower() for kw in [
                "promo", "newsletter", "noreply", "news@", "marketing",
                "offerta", "sconto", "sale", "unsubscribe", "dressinn",
                "marionnaud", "vans", "tradeinn", "trabajo"
            ])

            results.append({
                "from": sender[:50],
                "subject": subject[:100],
                "date": date_str[:30],
                "read": is_read,
                "promo": is_promo
            })

        imap.logout()
        return results

    except Exception as e:
        print(f"[Digest] IMAP error: {e}")
        return []

def generate_digest():
    cfg = load_config()
    emails = fetch_emails(cfg)

    if not emails:
        digest = {
            "date": time.strftime("%Y-%m-%d"),
            "time": time.strftime("%H:%M"),
            "total": 0,
            "unread": 0,
            "important": [],
            "promo_count": 0,
            "summary_voice": "Nessuna nuova email nelle ultime 24 ore.",
            "emails": []
        }
    else:
        unread = [e for e in emails if not e["read"]]
        important = [e for e in emails if not e["promo"]]
        promos = [e for e in emails if e["promo"]]

        # Build voice summary
        parts = []
        parts.append(f"Riepilogo email: {len(emails)} email nelle ultime 24 ore, di cui {len(unread)} non lette.")

        if promos:
            parts.append(f"{len(promos)} sono promozioni che puoi ignorare.")

        imp_unread = [e for e in important if not e["read"]]
        if imp_unread:
            parts.append(f"Le {len(imp_unread)} email importanti non lette sono: ")
            for e in imp_unread[:5]:
                parts.append(f"da {e['from']}, oggetto: {e['subject'][:50]}.")
        elif important:
            parts.append("Tutte le email importanti sono gia state lette.")

        digest = {
            "date": time.strftime("%Y-%m-%d"),
            "time": time.strftime("%H:%M"),
            "total": len(emails),
            "unread": len(unread),
            "important": [{"from": e["from"], "subject": e["subject"]} for e in imp_unread[:5]],
            "promo_count": len(promos),
            "summary_voice": " ".join(parts),
            "emails": emails
        }

    DIGEST_PATH.write_text(json.dumps(digest, indent=2, ensure_ascii=False))
    print(f"[Digest] Saved: {digest['total']} emails, {digest['unread']} unread -> {DIGEST_PATH}")
    return digest

if __name__ == "__main__":
    generate_digest()
