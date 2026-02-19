import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";

/**
 * Simple shared-notes API using Netlify Functions + Netlify Blobs.
 *
 * Endpoints (same URL: /.netlify/functions/notes):
 *   - GET    -> list latest notes
 *   - POST   -> create note, returns {note, token}
 *   - PUT    -> update note (requires token)
 *   - DELETE -> delete note (requires token)
 */

const STORE_NAME = "simple-notes";
const INDEX_KEY = "notes:index";
const NOTE_PREFIX = "note:";

const MAX_CONTENT_CHARS = 2000;
// Data URLs get big fast; keep it modest for demo use.
const MAX_IMAGE_DATAURL_CHARS = 350000; // ~350KB of base64 text
const MAX_NOTES = 500;
const LIST_LIMIT = 50;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function cleanNote(note) {
  if (!note || typeof note !== "object") return null;
  const { editToken, ...publicNote } = note;
  return publicNote;
}

async function readJson(req) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export default async function handler(req, context) {
  const store = getStore({ name: STORE_NAME, consistency: "strong" });

  if (req.method === "OPTIONS") {
    return new Response("", { status: 204 });
  }

  // LIST
  if (req.method === "GET") {
    const index = (await store.get(INDEX_KEY, { type: "json" })) || [];
    const ids = Array.isArray(index) ? index.slice(0, LIST_LIMIT) : [];

    const notes = await Promise.all(
      ids.map((id) => store.get(`${NOTE_PREFIX}${id}`, { type: "json" }))
    );

    const cleaned = notes.map(cleanNote).filter(Boolean);
    return json(cleaned);
  }

  // CREATE
  if (req.method === "POST") {
    const body = await readJson(req);
    const content = String(body?.content ?? "").trim();
    const imageDataUrl = body?.imageDataUrl ? String(body.imageDataUrl) : null;

    if (!content && !imageDataUrl) {
      return json({ error: "Empty note." }, 400);
    }
    if (content.length > MAX_CONTENT_CHARS) {
      return json({ error: `Note is too long (max ${MAX_CONTENT_CHARS} chars).` }, 400);
    }
    if (imageDataUrl && imageDataUrl.length > MAX_IMAGE_DATAURL_CHARS) {
      return json({ error: "Image is too large. Please upload a smaller image." }, 400);
    }

    const now = Date.now();
    const id = crypto.randomUUID();
    const token = crypto.randomBytes(16).toString("hex");

    const note = {
      id,
      content,
      imageDataUrl,
      createdAt: now,
      updatedAt: now,
      editToken: token,
    };

    await store.setJSON(`${NOTE_PREFIX}${id}`, note);

    const existingIndex = (await store.get(INDEX_KEY, { type: "json" })) || [];
    const indexArray = Array.isArray(existingIndex) ? existingIndex : [];
    const newIndex = [id, ...indexArray.filter((x) => x !== id)].slice(0, MAX_NOTES);
    await store.setJSON(INDEX_KEY, newIndex);

    return json({ ok: true, note: cleanNote(note), token });
  }

  // UPDATE
  if (req.method === "PUT") {
    const body = await readJson(req);
    const id = String(body?.id ?? "");
    const token = String(body?.token ?? "");
    if (!id || !token) {
      return json({ error: "Missing id/token." }, 400);
    }

    const existing = await store.get(`${NOTE_PREFIX}${id}`, { type: "json" });
    if (!existing) {
      return json({ error: "Note not found." }, 404);
    }
    if (existing.editToken !== token) {
      return json({ error: "Forbidden." }, 403);
    }

    const content = String(body?.content ?? "").trim();
    const imageDataUrl = body?.imageDataUrl ? String(body.imageDataUrl) : null;

    if (!content && !imageDataUrl) {
      return json({ error: "Empty note." }, 400);
    }
    if (content.length > MAX_CONTENT_CHARS) {
      return json({ error: `Note is too long (max ${MAX_CONTENT_CHARS} chars).` }, 400);
    }
    if (imageDataUrl && imageDataUrl.length > MAX_IMAGE_DATAURL_CHARS) {
      return json({ error: "Image is too large. Please upload a smaller image." }, 400);
    }

    const updated = {
      ...existing,
      content,
      imageDataUrl,
      updatedAt: Date.now(),
    };

    await store.setJSON(`${NOTE_PREFIX}${id}`, updated);
    return json({ ok: true, note: cleanNote(updated) });
  }

  // DELETE
  if (req.method === "DELETE") {
    const body = await readJson(req);
    const id = String(body?.id ?? "");
    const token = String(body?.token ?? "");
    if (!id || !token) {
      return json({ error: "Missing id/token." }, 400);
    }

    const existing = await store.get(`${NOTE_PREFIX}${id}`, { type: "json" });
    if (!existing) {
      return json({ ok: true });
    }
    if (existing.editToken !== token) {
      return json({ error: "Forbidden." }, 403);
    }

    await store.delete(`${NOTE_PREFIX}${id}`);

    const existingIndex = (await store.get(INDEX_KEY, { type: "json" })) || [];
    const indexArray = Array.isArray(existingIndex) ? existingIndex : [];
    const newIndex = indexArray.filter((x) => x !== id);
    await store.setJSON(INDEX_KEY, newIndex);

    return json({ ok: true });
  }

  return json({ error: "Method not allowed." }, 405);
}
