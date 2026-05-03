// src/utils/sessionCache.js
// Track the most recently entered session in localStorage so the landing page
// can offer a one-click rejoin after the user closes a tab, reloads, or
// navigates away. Cache is best-effort: stale or missing sessions silently
// fall back to the normal create/join flow.

const KEY = 'lastSession';
// Sessions auto-expire after 15 minutes of inactivity on the backend
// (see README → Database). Add a small buffer so we don't dangle the
// rejoin pill once the session is definitely gone.
const STALE_AFTER_MS = 30 * 60 * 1000;
// Room codes are `adjective-animal[-...]` words. Validate on read so tampered
// storage can't smuggle path traversal or scheme tricks into the rejoin link.
const ROOM_CODE_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+){1,4}$/;

function isValidRoomCode(code) {
  return typeof code === 'string' && ROOM_CODE_RE.test(code);
}

export function setLastSession(roomCode) {
  if (!isValidRoomCode(roomCode)) return;
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ roomCode, savedAt: Date.now() })
    );
  } catch {
    // quota / disabled storage — silent no-op
  }
}

export function getLastSession() {
  let raw;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    clearLastSession();
    return null;
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !isValidRoomCode(parsed.roomCode) ||
    typeof parsed.savedAt !== 'number'
  ) {
    clearLastSession();
    return null;
  }

  if (Date.now() - parsed.savedAt > STALE_AFTER_MS) {
    clearLastSession();
    return null;
  }

  return parsed;
}

export function clearLastSession() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
