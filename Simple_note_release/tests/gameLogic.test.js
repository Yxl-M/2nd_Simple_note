import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createNote,
  deleteNote,
  formatDate,
  getAllNotes,
  updateNote,
} from '../src/gameLogic.js';

function createLocalStorageMock() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

global.localStorage = createLocalStorageMock();

test.beforeEach(() => {
  localStorage.clear();
});

test('getAllNotes returns shared notes from API when available', async () => {
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      notes: [{ id: 'a', content: 'shared', imageDataUrl: null, createdAt: 1, updatedAt: 1 }],
    }),
  });

  const notes = await getAllNotes();
  assert.equal(notes.length, 1);
  assert.equal(notes[0].content, 'shared');
});

test('createNote falls back to local mode when API fails', async () => {
  global.fetch = async () => {
    throw new Error('offline');
  };

  const created = await createNote('hello', 'data:image/png;base64,abc');
  const local = JSON.parse(localStorage.getItem('simple-notes-app-notes'));

  assert.equal(created.content, 'hello');
  assert.equal(created.imageDataUrl, 'data:image/png;base64,abc');
  assert.equal(local.length, 1);
});

test('updateNote sends PUT and returns server note', async () => {
  global.fetch = async (url, options) => {
    assert.equal(url, '/api/notes/n1');
    assert.equal(options.method, 'PUT');

    return {
      ok: true,
      status: 200,
      json: async () => ({
        note: {
          id: 'n1',
          content: 'after',
          imageDataUrl: null,
          createdAt: 1,
          updatedAt: 2,
        },
      }),
    };
  };

  const updated = await updateNote('n1', 'after', null);
  assert.equal(updated.id, 'n1');
  assert.equal(updated.content, 'after');
});

test('deleteNote returns true when API delete succeeds', async () => {
  global.fetch = async (url, options) => {
    assert.equal(url, '/api/notes/n1');
    assert.equal(options.method, 'DELETE');
    return { ok: true, status: 204, text: async () => '' };
  };

  const ok = await deleteNote('n1');
  assert.equal(ok, true);
});

test('formatDate returns a non-empty string', () => {
  const value = formatDate(Date.now());
  assert.equal(typeof value, 'string');
  assert.ok(value.length > 0);
});
