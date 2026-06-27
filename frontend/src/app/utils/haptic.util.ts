/** Light haptic tap via Vibration API (Android / supported devices). */
export function hapticTap(durationMs = 12): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return;
  }
  try {
    navigator.vibrate(durationMs);
  } catch {
    // Unsupported or blocked — ignore silently
  }
}

/** Stronger pulse when pull-to-refresh triggers. */
export function hapticRefresh(): void {
  hapticTap(18);
}
