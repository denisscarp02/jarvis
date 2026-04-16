// ── Voice Module — Web Speech API (STT) + Audio Playback (TTS) ──────────────

let recognition = null;
let isListening = false;
let onTranscript = null;
let audioQueue = [];
let isPlaying = false;
let onSpeakStart = null;
let onSpeakEnd = null;

export function initVoice({ onResult, onSpeaking, onSpeakingEnd }) {
    onTranscript = onResult;
    onSpeakStart = onSpeaking;
    onSpeakEnd = onSpeakingEnd;

    // Check for Web Speech API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.warn('[Voice] Web Speech API not available');
        return false;
    }

    recognition = new SpeechRecognition();
    recognition.lang = 'it-IT';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            } else {
                interimTranscript += transcript;
            }
        }

        if (finalTranscript && onTranscript) {
            onTranscript(finalTranscript.trim(), true);
        } else if (interimTranscript && onTranscript) {
            onTranscript(interimTranscript.trim(), false);
        }
    };

    recognition.onerror = (event) => {
        console.warn('[Voice] Recognition error:', event.error);
        if (event.error === 'not-allowed') {
            isListening = false;
        }
    };

    recognition.onend = () => {
        // Auto-restart if still supposed to be listening
        if (isListening) {
            try { recognition.start(); } catch (e) { /* already started */ }
        }
    };

    return true;
}

export function toggleListening() {
    if (!recognition) return false;

    if (isListening) {
        isListening = false;
        recognition.stop();
    } else {
        isListening = true;
        try { recognition.start(); } catch (e) { /* already started */ }
    }
    return isListening;
}

export function isVoiceListening() {
    return isListening;
}

// ── Audio Playback (TTS responses) ──────────────────────────────────────────

export function playTTSAudio(url) {
    audioQueue.push(url);
    if (!isPlaying) {
        playNext();
    }
}

function playNext() {
    if (audioQueue.length === 0) {
        isPlaying = false;
        if (onSpeakEnd) onSpeakEnd();
        return;
    }

    isPlaying = true;
    if (onSpeakStart) onSpeakStart();

    const url = audioQueue.shift();
    const audio = new Audio(url);

    audio.onended = () => playNext();
    audio.onerror = () => {
        console.warn('[Voice] Audio playback error for', url);
        playNext();
    };

    audio.play().catch(err => {
        console.warn('[Voice] Audio play failed:', err);
        playNext();
    });
}

export function stopAudio() {
    audioQueue = [];
    isPlaying = false;
    if (onSpeakEnd) onSpeakEnd();
}
