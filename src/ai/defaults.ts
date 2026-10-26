// Default models; the user can override both in Settings.
// Concrete stable model names (not "-latest" aliases: the alias moved to a slow, heavily
// loaded Flash model and requests timed out). Both Flash-Lite models think only minimally,
// so they answer fast. Pin another name in Settings if Google retires these. Checked: 2026-10-26.
export const DEFAULT_ANALYZE_MODEL = 'gemini-3.5-flash-lite'; // quality matters more
export const DEFAULT_EVALUATE_MODEL = 'gemini-3.1-flash-lite'; // called more often, larger free quota
export const REQUEST_TIMEOUT_MS = 45_000;
