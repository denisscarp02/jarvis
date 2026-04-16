// ── Chat Module — Message UI ────────────────────────────────────────────────

const messagesEl = document.getElementById('chat-messages');
let thinkingEl = null;

export function addMessage(text, sender = 'jarvis') {
    removeThinking();

    const msg = document.createElement('div');
    msg.className = `chat-msg ${sender}`;

    const senderLabel = document.createElement('div');
    senderLabel.className = 'sender';
    senderLabel.textContent = sender === 'user' ? 'TU' : sender === 'system' ? '' : 'J.A.R.V.I.S.';
    msg.appendChild(senderLabel);

    const body = document.createElement('div');
    body.textContent = text;
    msg.appendChild(body);

    messagesEl.appendChild(msg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return msg;
}

export function addSystemMessage(text) {
    const msg = document.createElement('div');
    msg.className = 'chat-msg system';
    msg.textContent = text;
    messagesEl.appendChild(msg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

export function showThinking() {
    removeThinking();
    thinkingEl = document.createElement('div');
    thinkingEl.className = 'chat-msg jarvis';

    const sender = document.createElement('div');
    sender.className = 'sender';
    sender.textContent = 'J.A.R.V.I.S.';
    thinkingEl.appendChild(sender);

    const dots = document.createElement('div');
    dots.className = 'thinking-dots';
    dots.innerHTML = '<span></span><span></span><span></span>';
    thinkingEl.appendChild(dots);

    messagesEl.appendChild(thinkingEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

export function removeThinking() {
    if (thinkingEl) {
        thinkingEl.remove();
        thinkingEl = null;
    }
}
