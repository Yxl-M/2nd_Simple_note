import {
  getAllNotes,
  createNote,
  updateNote,
  deleteNote,
  formatDate,
  canEdit
} from './gameLogic.js';

const noteInputEl = document.getElementById('note-input');
const imageInputEl = document.getElementById('image-input');
const clearImageBtn = document.getElementById('clear-image');
const imagePreviewEl = document.getElementById('image-preview');
const previewImgEl = document.getElementById('preview-img');
const addNoteBtn = document.getElementById('add-note');
const notesListEl = document.getElementById('notes-list');

const syncStatusEl = document.getElementById('sync-status');
const refreshBtn = document.getElementById('refresh-notes');

let editingNoteId = null;
let selectedImageDataUrl = null;
let autoRefreshTimer = null;

refreshBtn?.addEventListener('click', () => renderNotes({ force: true }));

addNoteBtn.addEventListener('click', handleAddOrUpdateNote);
imageInputEl.addEventListener('change', handleImageSelected);
clearImageBtn.addEventListener('click', clearSelectedImage);

noteInputEl.addEventListener('keydown', event => {
  if (event.ctrlKey && event.key === 'Enter') {
    handleAddOrUpdateNote();
  }
});

startAutoRefresh();
renderNotes({ force: true });

function startAutoRefresh() {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);

  // Refresh periodically so you can see notes from other people without reloading.
  autoRefreshTimer = setInterval(() => {
    // Don't interrupt while editing.
    if (!editingNoteId) {
      renderNotes({ force: false });
    }
  }, 15000);
}

async function handleAddOrUpdateNote() {
  const content = noteInputEl.value.trim();

  if (!content && !selectedImageDataUrl) {
    alert('Please enter text or choose an image.');
    return;
  }

  setStatus('Saving…');

  try {
    if (editingNoteId) {
      const updated = await updateNote(editingNoteId, content, selectedImageDataUrl);
      if (updated) {
        editingNoteId = null;
        addNoteBtn.textContent = 'Add Note';
      } else {
        alert('You can only edit notes created in this browser.');
      }
    } else {
      const created = await createNote(content, selectedImageDataUrl);
      if (!created) {
        alert('Failed to create note.');
      }
    }

    resetEditor();
    await renderNotes({ force: true });
    setStatus('Synced');
  } catch (err) {
    console.error(err);
    setStatus('Offline (showing cached notes)');
    alert(err?.message || 'Network error.');
  }
}

async function renderNotes({ force } = { force: false }) {
  setStatus(force ? 'Syncing…' : (syncStatusEl?.textContent || 'Sync: …').replace('Sync: ', ''));

  notesListEl.innerHTML = '<p class="empty-message">Loading…</p>';

  let notes = [];
  try {
    notes = await getAllNotes();
    setStatus(`Synced (${notes.length})`);
  } catch (err) {
    console.error(err);
    setStatus('Offline (cached)');
  }

  notesListEl.innerHTML = '';

  if (!notes || notes.length === 0) {
    notesListEl.innerHTML = '<p class="empty-message">No notes yet. Add your first note above!</p>';
    return;
  }

  notes.forEach(note => {
    notesListEl.appendChild(createNoteElement(note));
  });
}

function createNoteElement(note) {
  const noteEl = document.createElement('article');
  noteEl.className = 'note';
  noteEl.dataset.id = note.id;

  if (note.content) {
    const contentEl = document.createElement('p');
    contentEl.className = 'note-content';
    contentEl.textContent = note.content;
    noteEl.appendChild(contentEl);
  }

  if (note.imageDataUrl) {
    const imageEl = document.createElement('img');
    imageEl.className = 'note-image';
    imageEl.src = note.imageDataUrl;
    imageEl.alt = 'Note attachment';
    noteEl.appendChild(imageEl);
  }

  const metaEl = document.createElement('div');
  metaEl.className = 'note-meta';
  metaEl.textContent = `Created: ${formatDate(note.createdAt)}`;
  if (note.updatedAt > note.createdAt) {
    metaEl.textContent += ` | Updated: ${formatDate(note.updatedAt)}`;
  }

  const actionsEl = document.createElement('div');
  actionsEl.className = 'note-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'edit-btn';
  editBtn.textContent = 'Edit';
  editBtn.addEventListener('click', () => handleEditNote(note));

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-btn';
  deleteBtn.textContent = 'Delete';
  deleteBtn.addEventListener('click', () => handleDeleteNote(note.id));

  const editable = canEdit(note.id);
  if (!editable) {
    editBtn.disabled = true;
    deleteBtn.disabled = true;
    editBtn.title = 'You can only edit notes created in this browser.';
    deleteBtn.title = 'You can only delete notes created in this browser.';
  }

  actionsEl.appendChild(editBtn);
  actionsEl.appendChild(deleteBtn);

  noteEl.appendChild(metaEl);
  noteEl.appendChild(actionsEl);

  return noteEl;
}

function handleEditNote(note) {
  if (!canEdit(note.id)) {
    alert('You can only edit notes created in this browser.');
    return;
  }

  noteInputEl.value = note.content;
  selectedImageDataUrl = note.imageDataUrl || null;
  renderImagePreview();
  editingNoteId = note.id;
  addNoteBtn.textContent = 'Update Note';
  noteInputEl.focus();
}

async function handleDeleteNote(noteId) {
  if (!canEdit(noteId)) {
    alert('You can only delete notes created in this browser.');
    return;
  }

  if (!confirm('Are you sure you want to delete this note?')) {
    return;
  }

  setStatus('Deleting…');

  try {
    const deleted = await deleteNote(noteId);
    if (!deleted) {
      alert('Delete failed (maybe you do not own this note).');
      return;
    }

    if (editingNoteId === noteId) {
      editingNoteId = null;
      addNoteBtn.textContent = 'Add Note';
      resetEditor();
    }

    await renderNotes({ force: true });
    setStatus('Synced');
  } catch (err) {
    console.error(err);
    setStatus('Offline (cached)');
    alert(err?.message || 'Network error.');
  }
}

function handleImageSelected(event) {
  const [file] = event.target.files || [];

  if (!file) {
    return;
  }

  if (!file.type.startsWith('image/')) {
    alert('Please choose an image file.');
    imageInputEl.value = '';
    return;
  }

  // Keep images small-ish: huge data URLs will be slow and may hit storage limits.
  const maxBytes = 250 * 1024; // ~250KB
  if (file.size > maxBytes) {
    alert('Image is too large. Please choose an image smaller than ~250KB.');
    imageInputEl.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    selectedImageDataUrl = typeof reader.result === 'string' ? reader.result : null;
    renderImagePreview();
  };
  reader.onerror = () => {
    alert('Failed to read selected image.');
  };
  reader.readAsDataURL(file);
}

function clearSelectedImage() {
  selectedImageDataUrl = null;
  imageInputEl.value = '';
  renderImagePreview();
}

function renderImagePreview() {
  if (!selectedImageDataUrl) {
    imagePreviewEl.classList.add('hidden');
    previewImgEl.removeAttribute('src');
    return;
  }

  previewImgEl.src = selectedImageDataUrl;
  imagePreviewEl.classList.remove('hidden');
}

function resetEditor() {
  noteInputEl.value = '';
  clearSelectedImage();
}

function setStatus(text) {
  if (!syncStatusEl) return;
  syncStatusEl.textContent = `Sync: ${text}`;
}
