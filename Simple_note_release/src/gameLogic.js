const STORAGE_KEY = 'simple-notes-app-notes';
const API_BASE = '/api/notes';

/**
 * @typedef {Object} Note
 * @property {string} id
 * @property {string} content
 * @property {string|null} imageDataUrl
 * @property {number} createdAt
 * @property {number} updatedAt
 */

function getLocalNotes() {
  try {
    const notesJson = localStorage.getItem(STORAGE_KEY);
    const notes = notesJson ? JSON.parse(notesJson) : [];
    return Array.isArray(notes) ? notes : [];
  } catch (error) {
    console.error('Failed to load local notes:', error);
    return [];
  }
}

function saveLocalNotes(notes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch (error) {
    console.error('Failed to save local notes:', error);
  }
}

async function requestJson(path = '', options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

/**
 * Get all notes. Uses shared API first; falls back to local mode if API is unavailable.
 * @returns {Promise<Note[]>}
 */
export async function getAllNotes() {
  try {
    const payload = await requestJson();
    if (payload && Array.isArray(payload.notes)) {
      return payload.notes;
    }
  } catch (error) {
    console.warn('Shared API unavailable, using local mode:', error.message);
  }

  return getLocalNotes();
}

/**
 * Create a new note
 * @param {string} content
 * @param {string|null} imageDataUrl
 * @returns {Promise<Note>}
 */
export async function createNote(content, imageDataUrl = null) {
  const payload = {
    content: content.trim(),
    imageDataUrl: imageDataUrl || null,
  };

  try {
    const result = await requestJson('', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (result && result.note) {
      return result.note;
    }
  } catch (error) {
    console.warn('Shared API unavailable, writing to local mode:', error.message);
  }

  const now = Date.now();
  const localNote = {
    id: `note_${now}_${Math.random().toString(36).slice(2, 11)}`,
    content: payload.content,
    imageDataUrl: payload.imageDataUrl,
    createdAt: now,
    updatedAt: now,
  };
  const notes = getLocalNotes();
  notes.unshift(localNote);
  saveLocalNotes(notes);
  return localNote;
}

/**
 * Update an existing note
 * @param {string} id
 * @param {string} content
 * @param {string|null} imageDataUrl
 * @returns {Promise<Note|null>}
 */
export async function updateNote(id, content, imageDataUrl = null) {
  const payload = {
    content: content.trim(),
    imageDataUrl: imageDataUrl || null,
  };

  try {
    const result = await requestJson(`/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (result && result.note) {
      return result.note;
    }
  } catch (error) {
    console.warn('Shared API unavailable, updating local mode:', error.message);
  }

  const notes = getLocalNotes();
  const index = notes.findIndex(note => note.id === id);
  if (index === -1) {
    return null;
  }

  const updated = {
    ...notes[index],
    content: payload.content,
    imageDataUrl: payload.imageDataUrl,
    updatedAt: Date.now(),
  };

  notes[index] = updated;
  saveLocalNotes(notes);
  return updated;
}

/**
 * Delete a note
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function deleteNote(id) {
  try {
    await requestJson(`/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return true;
  } catch (error) {
    console.warn('Shared API unavailable, deleting in local mode:', error.message);
  }

  const notes = getLocalNotes();
  const filtered = notes.filter(note => note.id !== id);
  if (filtered.length === notes.length) {
    return false;
  }

  saveLocalNotes(filtered);
  return true;
}

/**
 * Format a timestamp to a readable date string
 * @param {number} timestamp
 * @returns {string}
 */
export function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString();
}
