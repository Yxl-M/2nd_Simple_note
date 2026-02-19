import { getStore } from '@netlify/blobs';

const store = getStore('simple-notes-shared');
const NOTES_KEY = 'notes';
const MAX_IMAGE_DATA_URL_LENGTH = 2_000_000;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

async function loadNotes() {
  const notes = await store.getJSON(NOTES_KEY);
  return Array.isArray(notes) ? notes : [];
}

async function saveNotes(notes) {
  await store.setJSON(NOTES_KEY, notes);
}

function getNoteIdFromPath(url) {
  const pathname = new URL(url).pathname;
  const marker = '/.netlify/functions/notes/';

  if (!pathname.startsWith(marker)) {
    return null;
  }

  const raw = pathname.slice(marker.length);
  if (!raw) {
    return null;
  }

  return decodeURIComponent(raw);
}

function normalizePayload(payload) {
  const content = typeof payload?.content === 'string' ? payload.content.trim() : '';
  const imageDataUrl = typeof payload?.imageDataUrl === 'string' ? payload.imageDataUrl : null;

  if (!content && !imageDataUrl) {
    throw new Error('Content or image is required.');
  }

  if (imageDataUrl && imageDataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
    throw new Error('Image is too large. Please choose a smaller image.');
  }

  return {
    content,
    imageDataUrl,
  };
}

export default async function handler(request) {
  try {
    if (request.method === 'GET') {
      const notes = await loadNotes();
      return json({ notes });
    }

    if (request.method === 'POST') {
      const payload = normalizePayload(await request.json());
      const now = Date.now();
      const newNote = {
        id: `note_${now}_${Math.random().toString(36).slice(2, 11)}`,
        content: payload.content,
        imageDataUrl: payload.imageDataUrl,
        createdAt: now,
        updatedAt: now,
      };

      const notes = await loadNotes();
      notes.unshift(newNote);
      await saveNotes(notes);
      return json({ note: newNote }, 201);
    }

    if (request.method === 'PUT') {
      const noteId = getNoteIdFromPath(request.url);
      if (!noteId) {
        return json({ error: 'Note ID is required.' }, 400);
      }

      const payload = normalizePayload(await request.json());
      const notes = await loadNotes();
      const index = notes.findIndex(note => note.id === noteId);

      if (index === -1) {
        return json({ error: 'Note not found.' }, 404);
      }

      const updatedNote = {
        ...notes[index],
        content: payload.content,
        imageDataUrl: payload.imageDataUrl,
        updatedAt: Date.now(),
      };

      notes[index] = updatedNote;
      await saveNotes(notes);
      return json({ note: updatedNote });
    }

    if (request.method === 'DELETE') {
      const noteId = getNoteIdFromPath(request.url);
      if (!noteId) {
        return json({ error: 'Note ID is required.' }, 400);
      }

      const notes = await loadNotes();
      const filtered = notes.filter(note => note.id !== noteId);
      if (filtered.length === notes.length) {
        return json({ error: 'Note not found.' }, 404);
      }

      await saveNotes(filtered);
      return new Response(null, { status: 204 });
    }

    return json({ error: 'Method not allowed.' }, 405);
  } catch (error) {
    return json({ error: error.message || 'Internal server error.' }, 500);
  }
}
