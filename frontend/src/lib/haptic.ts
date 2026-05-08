/**
 * Haptic Feedback Utility for PROK Vote
 * 
 * Android: Uses standard Vibration API (navigator.vibrate)
 * iOS 18+: Uses hidden <input type="checkbox" switch> trick
 *          — toggling a switch input triggers the Taptic Engine
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

type HapticType = keyof typeof HAPTIC_PATTERNS;

// ─── iOS Haptic via hidden switch input ─────────────────────────────
// iOS 18+ triggers Taptic Engine when a <input type="checkbox" switch> is toggled.
// We create a hidden one and programmatically click its label.

let iosSwitchInput: HTMLInputElement | null = null;
let iosSwitchLabel: HTMLLabelElement | null = null;
let iosHapticSupported: boolean | null = null;

function isIOS(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /iPhone|iPad|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function supportsVibrateAPI(): boolean {
    return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

/**
 * Initialize the hidden iOS switch element (created once, reused)
 */
function ensureIOSSwitchElement(): boolean {
    if (iosSwitchInput && iosSwitchLabel) return true;
    if (typeof document === 'undefined') return false;

    try {
        // Create hidden checkbox with switch attribute (iOS 18+)
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.setAttribute('switch', '');
        input.id = '__prok_haptic_switch';

        // Style to be invisible but still in the DOM
        Object.assign(input.style, {
            position: 'fixed',
            top: '-9999px',
            left: '-9999px',
            opacity: '0',
            pointerEvents: 'none',
            width: '0',
            height: '0',
        });

        const label = document.createElement('label');
        label.htmlFor = '__prok_haptic_switch';
        Object.assign(label.style, {
            position: 'fixed',
            top: '-9999px',
            left: '-9999px',
            opacity: '0',
            pointerEvents: 'none',
            width: '0',
            height: '0',
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

/**
 * Trigger iOS haptic by clicking the hidden switch label
 */
function triggerIOSHaptic(): void {
    if (!ensureIOSSwitchElement()) return;
    if (!iosSwitchLabel) return;

    try {
        iosSwitchLabel.click();
    } catch {
        // Silently ignore
    }
}

/**
 * For multi-pulse patterns on iOS, trigger multiple taps with delays
 */
function triggerIOSHapticPattern(pattern: HapticPattern): void {
    if (typeof pattern === 'number') {
        // Single vibration — one tap
        triggerIOSHaptic();
        return;
    }

    // Pattern array: [pause, vibrate, pause, vibrate, ...]
    // Each vibrate segment = one iOS tap
    let totalDelay = 0;
    for (let i = 0; i < pattern.length; i++) {
        if (i % 2 === 1) {
            // Odd index = vibrate duration → trigger a tap
            const delay = totalDelay;
            setTimeout(() => triggerIOSHaptic(), delay);
        }
        totalDelay += pattern[i];
    }
}

// ─── Main haptic function ───────────────────────────────────────────

/**
 * Trigger haptic feedback on supported devices.
 * - Android: navigator.vibrate() with pattern
 * - iOS 18+: Hidden switch toggle for Taptic Engine
 * - Unsupported: silently ignored
 */
function haptic(type: HapticType): void {
    const pattern = HAPTIC_PATTERNS[type];
    if (!pattern) return;

    try {
        // Try standard Vibration API first (Android)
        if (supportsVibrateAPI()) {
            navigator.vibrate(pattern);
            return;
        }

        // iOS fallback: switch input trick
        if (isIOS()) {
            triggerIOSHapticPattern(pattern);
            return;
        }
    } catch {
        // Silently ignore — haptic is non-critical UX enhancement
    }
}

export { haptic, HAPTIC_PATTERNS };
export type { HapticType };
export default haptic;
