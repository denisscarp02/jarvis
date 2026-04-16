// ═══ FinScope Auth — WebAuthn (Touch ID) + Guest ═══

const AUTH_API = '/api/auth';

// Check if WebAuthn is available
function isWebAuthnAvailable() {
    return window.PublicKeyCredential !== undefined &&
           typeof window.PublicKeyCredential === 'function';
}

// Check if platform authenticator (Touch ID / Face ID) is available
async function isPlatformAuthAvailable() {
    if (!isWebAuthnAvailable()) return false;
    try {
        return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch (e) { return false; }
}

// Register Touch ID credential
async function registerTouchID() {
    try {
        const challengeRes = await fetch(AUTH_API + '/challenge');
        const { challenge, rp } = await challengeRes.json();

        const credential = await navigator.credentials.create({
            publicKey: {
                challenge: base64ToBuffer(challenge),
                rp: { name: rp.name, id: location.hostname },
                user: {
                    id: new TextEncoder().encode('owner-dennis'),
                    name: 'Dennis',
                    displayName: 'Dennis Scarp'
                },
                pubKeyCredParams: [
                    { type: 'public-key', alg: -7 },   // ES256
                    { type: 'public-key', alg: -257 }  // RS256
                ],
                authenticatorSelection: {
                    authenticatorAttachment: 'platform',
                    userVerification: 'required'
                },
                timeout: 60000
            }
        });

        // Save credential to server
        await fetch(AUTH_API + '/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: credential.id,
                rawId: bufferToBase64(credential.rawId),
                type: credential.type
            })
        });

        return { ok: true };
    } catch (e) {
        console.error('Registration failed:', e);
        return { ok: false, error: e.message };
    }
}

// Login with Touch ID
async function loginTouchID() {
    try {
        const challengeRes = await fetch(AUTH_API + '/challenge');
        const { challenge } = await challengeRes.json();

        const assertion = await navigator.credentials.get({
            publicKey: {
                challenge: base64ToBuffer(challenge),
                rpId: location.hostname,
                userVerification: 'required',
                timeout: 60000
            }
        });

        // Verify with server
        const verifyRes = await fetch(AUTH_API + '/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: assertion.id,
                rawId: bufferToBase64(assertion.rawId),
                type: assertion.type
            })
        });

        return await verifyRes.json();
    } catch (e) {
        console.error('Login failed:', e);
        return { ok: false, error: e.message };
    }
}

// Guest login
async function loginGuest(name) {
    const res = await fetch(AUTH_API + '/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    });
    return await res.json();
}

// Get auth status
async function getAuthStatus() {
    const res = await fetch(AUTH_API + '/status');
    return await res.json();
}

// Get guest log (owner only)
async function getGuestLog() {
    const res = await fetch(AUTH_API + '/guest-log');
    return await res.json();
}

// Helpers
function base64ToBuffer(b64) {
    const pad = b64.length % 4;
    if (pad) b64 += '='.repeat(4 - pad);
    const binary = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
}

function bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
