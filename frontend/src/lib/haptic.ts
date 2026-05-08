/**
 * Haptic Feedback Utility for PROK Vote
 * Uses the Vibration API (navigator.vibrate) for mobile devices.
 * Patterns are designed for voting UX — subtle but reassuring.
 */

type HapticPattern = number | number[];

const HAPTIC_PATTERNS = {
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
} as const;

type HapticType = keyof typeof HAPTIC_PATTERNS;

/**
 * Trigger haptic feedback on supported devices.
 * Silently fails on unsupported browsers/devices.
 */
function haptic(type: HapticType): void {
    try {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate(HAPTIC_PATTERNS[type] as HapticPattern);
        }
    } catch {
        // Silently ignore — haptic is non-critical UX enhancement
    }
}

export { haptic, HAPTIC_PATTERNS };
export type { HapticType };
export default haptic;
