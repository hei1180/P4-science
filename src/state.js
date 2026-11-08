import { APP_ID, SCHEMA_VERSION } from '../logic.js';
import { ANALYSIS_QUESTIONS, VARIABLE_QUESTIONS } from '../questions.js';

const SESSION_KEY = 'polarLab.session.v1';
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

export function saveSession(state) {
  if (!state?.sessionId) return false;
  return writeJson(SESSION_KEY, { savedAtMs: Date.now(), state });
}

export function loadSession(uid) {
  const wrapped = readJson(SESSION_KEY);
  if (!wrapped?.state) return null;
  const state = wrapped.state;
  if (state.app !== APP_ID || state.schemaVersion !== SCHEMA_VERSION) return null;
  if (uid && state.player?.uid !== uid) return null;
  return state;
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
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

export function sessionProgress(state) {
  const steps = [
    state?.training?.rounds?.length >= 4,
    state?.experiment?.readings?.length >= 6,
    state?.analysis?.answers?.length >= ANALYSIS_QUESTIONS.length,
    state?.variables?.answers?.length >= VARIABLE_QUESTIONS.length,
  ];
  return steps.filter(Boolean).length;
}
