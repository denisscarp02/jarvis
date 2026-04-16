// ── J.A.R.V.I.S. Arc Reactor — Three.js 3D Scene ────────────────────────────

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// State: "idle" | "thinking" | "speaking"
let reactorState = 'idle';
let stateIntensity = 0;

export function setReactorState(state) {
    reactorState = state;
}

export function initReactor(canvas) {
    const container = canvas.parentElement;
    const w = container.clientWidth;
    const h = container.clientHeight;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.toneMapping = THREE.ReinhardToneMapping;
    renderer.toneMappingExposure = 1.5;

    // Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(0, 0, 6);

    // Post-processing (bloom)
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 1.2, 0.6, 0.2);
    composer.addPass(bloom);

    // Materials
    const cyanMat = new THREE.MeshBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.9 });
    const dimCyanMat = new THREE.MeshBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.3, wireframe: true });
    const brightMat = new THREE.MeshBasicMaterial({ color: 0x80eeff, transparent: true, opacity: 0.95 });

    // ── Core ring ────────────────────────────────────────────────────────────
    const coreRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.4, 0.04, 16, 64),
        brightMat.clone()
    );
    scene.add(coreRing);

    // Inner glow sphere
    const innerGlow = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 32, 32),
        new THREE.MeshBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.15 })
    );
    scene.add(innerGlow);

    // ── Triangle segments (arc reactor pattern) ──────────────────────────────
    const triangles = [];
    for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const shape = new THREE.Shape();
        shape.moveTo(0, 0.55);
        shape.lineTo(-0.06, 1.1);
        shape.lineTo(0.06, 1.1);
        shape.closePath();

        const geo = new THREE.ShapeGeometry(shape);
        const mesh = new THREE.Mesh(geo, cyanMat.clone());
        mesh.rotation.z = angle;
        scene.add(mesh);
        triangles.push(mesh);
    }

    // ── Outer rotating rings ─────────────────────────────────────────────────
    const rings = [];
    const ringConfigs = [
        { radius: 1.4, tube: 0.015, tiltX: 0.3, tiltZ: 0.1, speed: 0.3 },
        { radius: 1.7, tube: 0.01, tiltX: -0.2, tiltZ: 0.4, speed: -0.2 },
        { radius: 2.0, tube: 0.008, tiltX: 0.15, tiltZ: -0.25, speed: 0.15 },
    ];
    for (const cfg of ringConfigs) {
        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(cfg.radius, cfg.tube, 8, 128),
            dimCyanMat.clone()
        );
        ring.rotation.x = cfg.tiltX;
        ring.rotation.z = cfg.tiltZ;
        ring.userData = { speed: cfg.speed, baseTiltX: cfg.tiltX };
        scene.add(ring);
        rings.push(ring);
    }

    // ── Particles ────────────────────────────────────────────────────────────
    const particleCount = 400;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = [];

    for (let i = 0; i < particleCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 1.2 + Math.random() * 1.2;
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
        velocities.push({
            theta: Math.random() * 0.01 - 0.005,
            phi: Math.random() * 0.005 - 0.0025,
            r
        });
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(
        particleGeo,
        new THREE.PointsMaterial({ color: 0x00d4ff, size: 0.02, transparent: true, opacity: 0.6, sizeAttenuation: true })
    );
    scene.add(particles);

    // ── Hex grid ring (decorative) ───────────────────────────────────────────
    const hexRing = new THREE.Mesh(
        new THREE.RingGeometry(2.3, 2.35, 6),
        new THREE.MeshBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.1, side: THREE.DoubleSide })
    );
    scene.add(hexRing);

    // ── Animation loop ───────────────────────────────────────────────────────
    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);
        const t = clock.getElapsedTime();
        const dt = clock.getDelta();

        // State transitions
        const targetIntensity = reactorState === 'thinking' ? 1.0 : reactorState === 'speaking' ? 0.7 : 0.0;
        stateIntensity += (targetIntensity - stateIntensity) * 0.05;

        const speedMult = 1.0 + stateIntensity * 2.0;
        const glowMult = 1.0 + stateIntensity * 0.5;

        // Core pulse
        const pulse = 1.0 + Math.sin(t * (2 + stateIntensity * 4)) * 0.08 * glowMult;
        coreRing.scale.set(pulse, pulse, 1);
        coreRing.material.opacity = 0.7 + Math.sin(t * 3) * 0.15 * glowMult;

        // Inner glow
        const glowPulse = 1.0 + Math.sin(t * 1.5) * 0.15 * glowMult;
        innerGlow.scale.set(glowPulse, glowPulse, glowPulse);
        innerGlow.material.opacity = 0.1 + stateIntensity * 0.15;

        // Triangles rotate slowly
        for (const tri of triangles) {
            tri.rotation.z += 0.002 * speedMult;
        }

        // Outer rings
        for (const ring of rings) {
            ring.rotation.y += ring.userData.speed * 0.01 * speedMult;
            ring.rotation.x = ring.userData.baseTiltX + Math.sin(t * 0.5) * 0.05;
            ring.material.opacity = 0.2 + stateIntensity * 0.2;
        }

        // Particles orbit
        const pos = particleGeo.attributes.position.array;
        for (let i = 0; i < particleCount; i++) {
            const v = velocities[i];
            const angle = t * (v.theta * 10) * speedMult;
            const r = v.r + Math.sin(t * 0.5 + i) * 0.05;
            const phi = Math.acos(2 * ((i / particleCount + t * v.phi * speedMult) % 1) - 1);
            pos[i * 3] = r * Math.sin(phi) * Math.cos(angle + i);
            pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(angle + i);
            pos[i * 3 + 2] = r * Math.cos(phi);
        }
        particleGeo.attributes.position.needsUpdate = true;
        particles.material.opacity = 0.4 + stateIntensity * 0.3;

        // Hex ring
        hexRing.rotation.z = t * 0.1;

        // Bloom intensity
        bloom.strength = 1.0 + stateIntensity * 0.8;

        composer.render();
    }

    animate();

    // Resize handler
    const onResize = () => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        composer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return { setReactorState };
}
