// Default models; the user can override both in Settings.
// "-latest" aliases follow Google's current Flash / Flash-Lite, so a rename of a
// concrete model does not break the app. Check the free-tier list in Google AI
// Studio and pin a concrete name if an alias ever misbehaves. Last checked: 2026-10-25.
export const DEFAULT_ANALYZE_MODEL = 'gemini-flash-latest'; // quality matters more
export const DEFAULT_EVALUATE_MODEL = 'gemini-flash-lite-latest'; // called more often, larger free quota
export const REQUEST_TIMEOUT_MS = 30_000;
