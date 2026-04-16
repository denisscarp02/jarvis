// ── HUD Panels — System Status & Music Controls ─────────────────────────────

// Elements cache
const els = {
    cpuBar: document.getElementById('cpu-bar'),
    cpuVal: document.getElementById('cpu-val'),
    ramBar: document.getElementById('ram-bar'),
    ramVal: document.getElementById('ram-val'),
    diskBar: document.getElementById('disk-bar'),
    diskVal: document.getElementById('disk-val'),
    battBar: document.getElementById('batt-bar'),
    battVal: document.getElementById('batt-val'),
    uptime: document.getElementById('uptime-val'),
    musicTrack: document.getElementById('music-track'),
    musicArtist: document.getElementById('music-artist'),
    musicState: document.getElementById('music-state'),
    reactorTime: document.getElementById('reactor-time'),
};

function setBar(barEl, valEl, percent, label, invertWarning = false) {
    barEl.style.width = `${Math.min(100, percent)}%`;
    valEl.textContent = label || `${Math.round(percent)}%`;

    barEl.classList.remove('warning', 'critical');
    if (invertWarning) {
        // Low is bad (battery)
        if (percent < 15) barEl.classList.add('critical');
        else if (percent < 30) barEl.classList.add('warning');
    } else {
        // High is bad (CPU, RAM, disk)
        if (percent > 85) barEl.classList.add('critical');
        else if (percent > 70) barEl.classList.add('warning');
    }
}

export function updateStatus(data) {
    setBar(els.cpuBar, els.cpuVal, data.cpu);
    setBar(els.ramBar, els.ramVal, data.memory);
    setBar(els.diskBar, els.diskVal, data.disk_percent);

    if (data.battery >= 0) {
        const battLabel = `${Math.round(data.battery)}%${data.battery_charging ? ' ⚡' : ''}`;
        setBar(els.battBar, els.battVal, data.battery, battLabel, true);
    } else {
        setBar(els.battBar, els.battVal, 0, 'N/A');
    }

    els.uptime.textContent = `Uptime: ${data.uptime}`;

    // Music
    if (data.music) {
        const m = data.music;
        if (m.state === 'playing' || m.state === 'paused') {
            els.musicTrack.textContent = m.track || '--';
            els.musicArtist.textContent = m.artist || '--';
            els.musicState.textContent = m.state === 'playing' ? '▶ IN RIPRODUZIONE' : '❚❚ IN PAUSA';
        } else {
            els.musicTrack.textContent = '--';
            els.musicArtist.textContent = '--';
            els.musicState.textContent = '';
        }
    }
}

// Clock update
function updateClock() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    els.reactorTime.textContent = `${h}:${m}:${s}`;
}

setInterval(updateClock, 1000);
updateClock();

// ── Music button handlers ───────────────────────────────────────────────────

let onMusicCommand = null;

export function initMusicControls(commandHandler) {
    onMusicCommand = commandHandler;

    document.getElementById('btn-prev').addEventListener('click', () => {
        if (onMusicCommand) onMusicCommand('music_prev');
    });
    document.getElementById('btn-toggle').addEventListener('click', () => {
        if (onMusicCommand) onMusicCommand('music_toggle');
    });
    document.getElementById('btn-next').addEventListener('click', () => {
        if (onMusicCommand) onMusicCommand('music_next');
    });
}
