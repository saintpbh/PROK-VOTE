/**
 * Haptic Feedback Utility for PROK Vote
 * 
 * Android: Uses standard Vibration API (navigator.vibrate)
 * iOS 18+ (user gesture): Uses hidden <input type="checkbox" switch> trick
 * iOS (non-gesture, e.g. WebSocket events): Uses Web Audio API short beep as fallback
 * 
 * Silently fails on unsupported platforms.
 */

type HapticPattern = number | number[];

const HAPTIC_PATTERNS: Record<string, HapticPattern> = {
    /** Subtle tap — text input, keypress (10ms) */
    tap: 10,

    /** Light press — button click, navigation (20ms) */
    press: 25,

    /** Selection — choosing a vote option, toggling (40ms) */
    select: [0, 40],

    /** Confirm — vote submitted successfully (double pulse) */
    confirm: [0, 30, 60, 30],

    /** Vote Start — attention! voting has begun (rising pattern) */
    voteStart: [0, 50, 80, 80, 60, 120],

    /** Vote End — voting period closed (firm double) */
    voteEnd: [0, 60, 100, 60],

    /** Success — authentication passed, action completed (triple celebration) */
    success: [0, 30, 50, 30, 50, 30],

    /** Error — invalid action, rejection (long buzz) */
    error: [0, 200],

    /** Warning — session change, re-auth needed (pulsing alert) */
    warning: [0, 80, 60, 80],
};

// Audio feedback config per haptic type (frequency Hz, duration ms, volume 0-1)
const AUDIO_FEEDBACK: Record<string, { freq: number; duration: number; volume: number; pulses: number }> = {
    tap:       { freq: 1800, duration: 8,   volume: 0.08, pulses: 1 },
    press:     { freq: 1500, duration: 15,  volume: 0.10, pulses: 1 },
    select:    { freq: 1200, duration: 20,  volume: 0.12, pulses: 1 },
    confirm:   { freq: 1000, duration: 25,  volume: 0.15, pulses: 2 },
    voteStart: { freq: 800,  duration: 40,  volume: 0.20, pulses: 3 },
    voteEnd:   { freq: 600,  duration: 35,  volume: 0.18, pulses: 2 },
    success:   { freq: 1100, duration: 20,  volume: 0.15, pulses: 3 },
    error:     { freq: 300,  duration: 80,  volume: 0.20, pulses: 1 },
    warning:   { freq: 500,  duration: 50,  volume: 0.18, pulses: 2 },
};

type HapticType = keyof typeof HAPTIC_PATTERNS;

// ─── iOS Haptic via hidden switch input ─────────────────────────────

let iosSwitchInput: HTMLInputElement | null = null;
let iosSwitchLabel: HTMLLabelElement | null = null;

function isIOS(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /iPhone|iPad|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function supportsVibrateAPI(): boolean {
    return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

function ensureIOSSwitchElement(): boolean {
    if (iosSwitchInput && iosSwitchLabel) return true;
    if (typeof document === 'undefined') return false;

    try {
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.setAttribute('switch', '');
        input.id = '__prok_haptic_switch';
        Object.assign(input.style, {
            position: 'fixed', top: '-9999px', left: '-9999px',
            opacity: '0', pointerEvents: 'none', width: '0', height: '0',
        });

        const label = document.createElement('label');
        label.htmlFor = '__prok_haptic_switch';
        Object.assign(label.style, {
            position: 'fixed', top: '-9999px', left: '-9999px',
            opacity: '0', pointerEvents: 'none', width: '0', height: '0',
        });

        document.body.appendChild(input);
        document.body.appendChild(label);
        iosSwitchInput = input;
        iosSwitchLabel = label;
        return true;
    } catch {
        return false;
    }
}

function triggerIOSHaptic(): void {
    if (!ensureIOSSwitchElement() || !iosSwitchLabel) return;
    try { iosSwitchLabel.click(); } catch { /* ignore */ }
}

function triggerIOSHapticPattern(pattern: HapticPattern): void {
    if (typeof pattern === 'number') {
        triggerIOSHaptic();
        return;
    }
    let totalDelay = 0;
    for (let i = 0; i < pattern.length; i++) {
        if (i % 2 === 1) {
            const delay = totalDelay;
            setTimeout(() => triggerIOSHaptic(), delay);
        }
        totalDelay += pattern[i];
    }
}

// ─── Web Audio API fallback for iOS non-gesture events ──────────────
// When iOS blocks haptic (WebSocket events), play a very short audio "tick"
// using generated tones. This gives physical feedback through the phone speaker.

let audioCtx: AudioContext | null = null;
let audioUnlocked = false;

/**
 * Initialize AudioContext on first user gesture (iOS requires user activation).
 * Call this once from any touch/click handler early in the session.
 */
function unlockAudio(): void {
    if (audioUnlocked) return;
    try {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        // Play a silent buffer to unlock
        const buffer = audioCtx.createBuffer(1, 1, 22050);
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);
        source.start(0);
        audioUnlocked = true;
    } catch {
        // Ignore
    }
}

/**
 * Play a short beep tone as haptic alternative
 */
function playAudioTick(type: HapticType): void {
    if (!audioCtx || audioCtx.state === 'closed') return;

    // Resume if suspended
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
    }

    const config = AUDIO_FEEDBACK[type] || AUDIO_FEEDBACK.press;
    const { freq, duration, volume, pulses } = config;

    for (let p = 0; p < pulses; p++) {
        const startTime = audioCtx.currentTime + (p * (duration + 30) / 1000);

        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(freq, startTime);

        // Quick fade in/out to avoid clicks
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.003);
        gainNode.gain.linearRampToValueAtTime(0, startTime + duration / 1000);

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start(startTime);
        oscillator.stop(startTime + duration / 1000 + 0.01);
    }
}

// ─── Unlock audio on first user interaction ─────────────────────────

if (typeof document !== 'undefined') {
    const handleFirstInteraction = () => {
        unlockAudio();
        document.removeEventListener('touchstart', handleFirstInteraction);
        document.removeEventListener('click', handleFirstInteraction);
    };
    document.addEventListener('touchstart', handleFirstInteraction, { once: true });
    document.addEventListener('click', handleFirstInteraction, { once: true });
}

// ─── Main haptic function ───────────────────────────────────────────

/**
 * Trigger haptic feedback on supported devices.
 * - Android: navigator.vibrate() with pattern
 * - iOS (user gesture): Hidden switch toggle for Taptic Engine
 * - iOS (non-gesture, e.g. WebSocket): Audio tick fallback
 * - Unsupported: silently ignored
 */
function haptic(type: HapticType): void {
    const pattern = HAPTIC_PATTERNS[type];
    if (!pattern) return;

    try {
        // Android: standard Vibration API
        if (supportsVibrateAPI()) {
            navigator.vibrate(pattern);
            return;
        }

        // iOS: try switch trick first (works for user gestures)
        if (isIOS()) {
            triggerIOSHapticPattern(pattern);

            // Also play audio tick — switch trick may fail for non-gesture events,
            // but audio feedback will still work since AudioContext was unlocked
            // during the initial user touch.
            playAudioTick(type);
            return;
        }
    } catch {
        // Silently ignore
    }
}

export { haptic, HAPTIC_PATTERNS };
export type { HapticType };
export default haptic;
