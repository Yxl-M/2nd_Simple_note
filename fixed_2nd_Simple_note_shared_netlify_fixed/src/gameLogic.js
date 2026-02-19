// Shared notes backend: Netlify Functions + Netlify Blobs
const API_URL = '/.netlify/functions/notes';

// Cache for offline / temporary network failures
const CACHE_KEY = 'simple-notes-app-cache-notes';

// Per-device edit tokens (so you can edit/delete notes you created on this browser)
const TOKENS_KEY = 'simple-notes-app-edit-tokens';

/**
 * @typedef {Object} Note
 * @property {string} id
 * @property {string} content
 * @property {string|null} imageDataUrl
 * @property {number} createdAt
 * @property {number} updatedAt
 */

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function loadTokens() {
  const t = loadJson(TOKENS_KEY, {});
  return t && typeof t === 'object' ? t : {};
}

function saveTokens(tokens) {
  saveJson(TOKENS_KEY, tokens);
}

export function canEdit(noteId) {
  const tokens = loadTokens();
  return Boolean(tokens[noteId]);
}

function getToken(noteId) {
  const tokens = loadTokens();
  return tokens[noteId] || null;
}

function setToken(noteId, token) {
  const tokens = loadTokens();
  tokens[noteId] = token;
  saveTokens(tokens);
}

function deleteToken(noteId) {
  const tokens = loadTokens();
  delete tokens[noteId];
  saveTokens(tokens);
}

async function apiRequest(method, body = null, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(API_URL, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });

    const text = await res.text();
    const data = text ? JSON.parse(text) : null;

    if (!res.ok) {
      const msg = (data && data.error) ? data.error : `Request failed (${res.status})`;
      throw new Error(msg);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Get all notes from the shared backend.
 * Falls back to last cached notes if the network is unavailable.
 * @returns {Promise<Note[]>}
 */
export async function getAllNotes() {
  try {
    const notes = await apiRequest('GET');
    if (Array.isArray(notes)) {
      saveJson(CACHE_KEY, notes);
      return notes;
    }
    return [];
  } catch (error) {
    console.warn('Falling back to cached notes:', error?.message || error);
    const cached = loadJson(CACHE_KEY, []);
    return Array.isArray(cached) ? cached : [];
  }
}

/**
 * Create a new note (shared).
 * @param {string} content
 * @param {string|null} imageDataUrl
 * @returns {Promise<Note|null>}
 */
export async function createNote(content, imageDataUrl = null) {
  const payload = {
    content: (content ?? '').toString(),
    imageDataUrl: imageDataUrl || null
  };

  const data = await apiRequest('POST', payload);
  if (data && data.note && data.token) {
    setToken(data.note.id, data.token);
    return data.note;
  }
  return null;
}

/**
 * Update a note (only if this browser has the edit token for it).
 * @param {string} id
 * @param {string} content
 * @param {string|null} imageDataUrl
 * @returns {Promise<Note|null>}
 */
export async function updateNote(id, content, imageDataUrl = null) {
  const token = getToken(id);
  if (!token) return null;

  const payload = {
    id,
    token,
    content: (content ?? '').toString(),
    imageDataUrl: imageDataUrl || null
  };

  const data = await apiRequest('PUT', payload);
  return data && data.note ? data.note : null;
}

/**
 * Delete a note (only if this browser has the edit token for it).
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function deleteNote(id) {
  const token = getToken(id);
  if (!token) return false;

  const data = await apiRequest('DELETE', { id, token });
  if (data && data.ok) {
    deleteToken(id);
    return true;
  }
  return false;
}

/**
 * Format a timestamp to a readable date string
 * @param {number} timestamp
 * @returns {string}
 */
export function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString();
}
