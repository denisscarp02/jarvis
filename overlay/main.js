const { app, BrowserWindow, screen, globalShortcut } = require('electron');
const path = require('path');

let overlayWindow = null;

function createOverlay() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    overlayWindow = new BrowserWindow({
        width: width,
        height: height,
        x: 0,
        y: 0,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        hasShadow: false,
        resizable: false,
        focusable: false,           // Don't steal focus from other apps
        type: 'panel',              // macOS: panel type sits above regular windows
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    // Load the HUD from the local server
    overlayWindow.loadURL('http://localhost:5100/overlay');

    // Make the window click-through on transparent areas
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });

    // Don't show in mission control / app switcher
    overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });

    overlayWindow.on('closed', () => {
        overlayWindow = null;
    });
}

app.whenReady().then(() => {
    createOverlay();

    // Toggle overlay visibility with Ctrl+Shift+J
    globalShortcut.register('Control+Shift+J', () => {
        if (overlayWindow) {
            if (overlayWindow.isVisible()) {
                overlayWindow.hide();
            } else {
                overlayWindow.show();
            }
        }
    });

    // Toggle click-through with Ctrl+Shift+H (to interact with HUD)
    globalShortcut.register('Control+Shift+H', () => {
        if (overlayWindow) {
            const isIgnoring = overlayWindow._ignoring !== false;
            overlayWindow.setIgnoreMouseEvents(!isIgnoring, { forward: true });
            overlayWindow._ignoring = !isIgnoring;
        }
    });
});

app.on('window-all-closed', () => {
    app.quit();
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});
