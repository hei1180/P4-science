import { APP_ID, SCHEMA_VERSION } from '../logic.js';

const SESSION_PREFIX = 'polarLab.session.v2.';
const PROFILE_KEY = 'polarLab.profile.v1';
const MUTE_KEY = 'polarLab.muted.v1';

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

const sessionKey = (uid) => `${SESSION_PREFIX}${uid || 'anonymous'}`;

export function saveSession(state) {
  if (!state?.sessionId) return false;
  return writeJson(sessionKey(state.player?.uid), { savedAtMs: Date.now(), state });
}

export function loadSession(uid) {
  const wrapped = readJson(sessionKey(uid));
  if (!wrapped?.state) return null;
  const state = wrapped.state;
  if (state.app !== APP_ID || state.schemaVersion !== SCHEMA_VERSION) return null;
  if (uid && state.player?.uid !== uid) return null;
  return state;
}

export function clearSession(uid) {
  try {
    localStorage.removeItem(sessionKey(uid));
  } catch (e) {
    /* ignore */
  }
}

export function saveProfile(profile) {
  return writeJson(PROFILE_KEY, profile);
}

export function loadProfile() {
  return readJson(PROFILE_KEY) || {};
}

export function loadMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch (e) {
    return false;
  }
}

export function storeMuted(muted) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch (e) {
    /* ignore */
  }
}

export function isSessionFinished(state) {
  return !!state?.completed;
}


