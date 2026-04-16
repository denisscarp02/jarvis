// ── J.A.R.V.I.S. Main — Bootstrap, WebSocket, Boot Sequence ─────────────────

import { initReactor, setReactorState } from './reactor.js';
import { updateStatus, initMusicControls } from './hud-panels.js';
import { addMessage, addSystemMessage, showThinking, removeThinking } from './chat.js';
import { initVoice, toggleListening, isVoiceListening, playTTSAudio } from './voice.js';

// ── WebSocket ───────────────────────────────────────────────────────────────

let ws = null;
let reconnectTimer = null;

function connectWS() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${location.host}/ws`);

    ws.onopen = () => {
        console.log('[WS] Connected');
        if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleMessage(data);
        } catch (e) {
            console.warn('[WS] Parse error:', e);
        }
    };

    ws.onclose = () => {
        console.log('[WS] Disconnected, reconnecting in 3s...');
        reconnectTimer = setTimeout(connectWS, 3000);
    };

    ws.onerror = () => {
        ws.close();
    };
}

function sendWS(data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

// ── Message Router ──────────────────────────────────────────────────────────

function handleMessage(data) {
    switch (data.type) {
        case 'status':
            updateStatus(data.data);
            break;

        case 'thinking':
            if (data.active) {
                showThinking();
                setReactorState('thinking');
            } else {
                removeThinking();
                setReactorState('idle');
            }
            break;

        case 'chat_response':
            removeThinking();
            addMessage(data.text, 'jarvis');
            setReactorState('idle');
            break;

        case 'tts_audio':
            if (data.url) {
                playTTSAudio(data.url);
            }
            break;

        case 'command_result':
            addMessage(data.text, 'jarvis');
            break;

        case 'clap_event':
            triggerFlash();
            addSystemMessage(`Clap rilevato — Avvio: ${data.apps.join(', ')}`);
            break;

        case 'gesture':
            handleGesture(data.gesture);
            break;
    }
}

// ── Gesture Feedback ────────────────────────────────────────────────────────

function handleGesture(gesture) {
    const indicator = document.getElementById('gesture-indicator');
    let icon = '';
    let label = '';

    switch (gesture) {
        case 'pinch_start':
            icon = '&#9995;'; label = 'FINESTRA AFFERRATA';
            break;
        case 'pinch_end':
            icon = '&#128076;'; label = 'RILASCIATA';
            break;
        case 'swipe_right':
            icon = '&#9654;'; label = 'DESKTOP SUCCESSIVO';
            triggerFlash();
            break;
        case 'swipe_left':
            icon = '&#9664;'; label = 'DESKTOP PRECEDENTE';
            triggerFlash();
            break;
        default:
            return;
    }

    indicator.innerHTML = `${icon} ${label}`;
    indicator.classList.remove('hidden');
    indicator.classList.add('show');
    clearTimeout(indicator._timer);
    indicator._timer = setTimeout(() => {
        indicator.classList.remove('show');
        indicator.classList.add('hidden');
    }, 1200);
}

// ── Chat Input ──────────────────────────────────────────────────────────────

const chatInput = document.getElementById('chat-input');
const btnSend = document.getElementById('btn-send');
const btnMic = document.getElementById('btn-mic');
const voiceStatus = document.getElementById('voice-status');

function sendChat(text) {
    if (!text.trim()) return;
    addMessage(text, 'user');
    sendWS({ type: 'chat', text: text.trim() });
    chatInput.value = '';
}

chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChat(chatInput.value);
});

btnSend.addEventListener('click', () => sendChat(chatInput.value));

// ── Voice Controls ──────────────────────────────────────────────────────────

const voiceAvailable = initVoice({
    onResult: (transcript, isFinal) => {
        if (isFinal) {
            sendChat(transcript);
        } else {
            chatInput.value = transcript;
        }
    },
    onSpeaking: () => setReactorState('speaking'),
    onSpeakingEnd: () => setReactorState('idle')
});

btnMic.addEventListener('click', () => {
    if (!voiceAvailable) {
        addSystemMessage('Riconoscimento vocale non disponibile in questo browser.');
        return;
    }
    const listening = toggleListening();
    btnMic.classList.toggle('active', listening);
    voiceStatus.classList.toggle('hidden', !listening);
});

// ── Music Controls ──────────────────────────────────────────────────────────

initMusicControls((action) => {
    sendWS({ type: 'command', action });
});

// ── Flash Effect ────────────────────────────────────────────────────────────

function triggerFlash() {
    const flash = document.getElementById('flash-overlay');
    flash.classList.remove('hidden', 'flash');
    void flash.offsetWidth; // force reflow
    flash.classList.add('flash');
    setTimeout(() => flash.classList.add('hidden'), 700);
}

// ── Boot Sequence ───────────────────────────────────────────────────────────

async function bootSequence() {
    const bootScreen = document.getElementById('boot-screen');
    const bootText = document.getElementById('boot-text');
    const bootBarFill = document.getElementById('boot-bar-fill');
    const hud = document.getElementById('hud');

    const lines = [
        'J.A.R.V.I.S. v2.0',
        'Inizializzazione sistemi...',
        'Connessione server...',
        'Reattore Arc: ONLINE',
        'Moduli vocali: ATTIVI',
        'Pronto.'
    ];

    for (let i = 0; i < lines.length; i++) {
        // Typewriter effect
        bootText.textContent = '';
        for (const ch of lines[i]) {
            bootText.textContent += ch;
            await sleep(30);
        }
        bootBarFill.style.width = `${((i + 1) / lines.length) * 100}%`;
        await sleep(300);
    }

    await sleep(500);

    // Connect WebSocket before showing HUD
    connectWS();

    // Fade out boot, show HUD
    bootScreen.classList.add('fade-out');
    await sleep(800);
    bootScreen.classList.add('hidden');

    hud.classList.remove('hidden');
    // Trigger reflow then animate in
    void hud.offsetWidth;
    hud.classList.add('visible');

    // Init Three.js reactor
    const canvas = document.getElementById('reactor-canvas');
    initReactor(canvas);

    // Welcome message
    addSystemMessage('J.A.R.V.I.S. v2.0 — Tutti i sistemi operativi.');

    // Load email digest into sidebar panel
    loadEmailDigest();

    // Iron Man style greeting via dedicated endpoint
    try {
        const resp = await fetch('/api/greeting');
        if (resp.ok) {
            const data = await resp.json();
            // Wait for WS to connect then play greeting
            await sleep(1500);
            if (data.text) {
                addMessage(data.text, 'jarvis');
            }
            if (data.audio_url) {
                playTTSAudio(data.audio_url);
                setReactorState('speaking');
            }
        }
    } catch (e) {
        // Server might not be ready yet
    }
}

// ── Email Digest Panel ──────────────────────────────────────────────────────

async function loadEmailDigest() {
    try {
        const resp = await fetch('/api/emails');
        if (!resp.ok) return;
        const data = await resp.json();

        const summaryEl = document.getElementById('email-summary');
        const listEl = document.getElementById('email-important-list');
        if (!summaryEl) return;

        // Try daily digest first
        try {
            const dResp = await fetch('/api/digest');
            if (dResp.ok) {
                const digest = await dResp.json();
                if (digest.total > 0) {
                    const scamWarn = digest.scam_count > 0
                        ? `<span style="color:var(--red)"> · ${digest.scam_count} phishing!</span>` : '';
                    summaryEl.innerHTML =
                        `<span style="color:var(--cyan)">${digest.total}</span> email · ` +
                        `<span style="color:var(--orange)">${digest.promo_count || 0}</span> promo · ` +
                        `<span style="color:var(--green)">${digest.important?.length || 0}</span> importanti` +
                        scamWarn;

                    if (digest.important && digest.important.length > 0) {
                        listEl.innerHTML = digest.important.slice(0, 4).map(e =>
                            `<div style="padding:4px 0;border-bottom:1px solid var(--border);font-size:0.65rem">` +
                            `<div style="color:var(--cyan);font-weight:600">${e.from}</div>` +
                            `<div style="color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e.subject}</div>` +
                            `</div>`
                        ).join('');
                    }
                    return;
                }
            }
        } catch (e) {}

        // Fallback to /api/emails
        if (data.count > 0) {
            summaryEl.innerHTML = `<span style="color:var(--cyan)">${data.count}</span> email non lette`;
            listEl.innerHTML = data.emails.slice(0, 4).map(e =>
                `<div style="padding:4px 0;border-bottom:1px solid var(--border);font-size:0.65rem">` +
                `<div style="color:var(--cyan);font-weight:600">${e.from}</div>` +
                `<div style="color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e.subject}</div>` +
                `</div>`
            ).join('');
        } else {
            summaryEl.textContent = 'Nessuna email non letta';
        }
    } catch (e) {
        const el = document.getElementById('email-summary');
        if (el) el.textContent = 'Email non disponibili';
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Start ───────────────────────────────────────────────────────────────────

bootSequence();
