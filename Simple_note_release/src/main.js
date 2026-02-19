import {
  getAllNotes,
  createNote,
  updateNote,
  deleteNote,
  formatDate
} from './gameLogic.js';

const noteInputEl = document.getElementById('note-input');
const imageInputEl = document.getElementById('image-input');
const clearImageBtn = document.getElementById('clear-image');
const imagePreviewEl = document.getElementById('image-preview');
const previewImgEl = document.getElementById('preview-img');
const addNoteBtn = document.getElementById('add-note');
const notesListEl = document.getElementById('notes-list');

let editingNoteId = null;
let selectedImageDataUrl = null;
let notesCache = [];

renderNotes();

addNoteBtn.addEventListener('click', handleAddOrUpdateNote);
imageInputEl.addEventListener('change', handleImageSelected);
clearImageBtn.addEventListener('click', clearSelectedImage);

noteInputEl.addEventListener('keydown', event => {
  if (event.ctrlKey && event.key === 'Enter') {
    handleAddOrUpdateNote();
  }
});

async function handleAddOrUpdateNote() {
  const content = noteInputEl.value.trim();

  if (!content && !selectedImageDataUrl) {
    alert('Please enter text or choose an image.');
    return;
  }

  setSavingState(true);
  try {
    if (editingNoteId) {
      const updated = await updateNote(editingNoteId, content, selectedImageDataUrl);
      if (updated) {
        editingNoteId = null;
        addNoteBtn.textContent = 'Add Note';
      }
    } else {
      await createNote(content, selectedImageDataUrl);
    }

    resetEditor();
    await renderNotes();
  } catch (error) {
    console.error(error);
    alert('Failed to save note. Please try again.');
  } finally {
    setSavingState(false);
  }
}

async function renderNotes() {
  notesListEl.innerHTML = '<p class="empty-message">Loading notes...</p>';

  try {
    notesCache = await getAllNotes();
  } catch (error) {
    console.error(error);
    notesCache = [];
  }

  notesListEl.innerHTML = '';

  if (notesCache.length === 0) {
    notesListEl.innerHTML = '<p class="empty-message">No notes yet. Add your first note above!</p>';
    return;
  }

  notesCache.forEach(note => {
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
  editBtn.addEventListener('click', () => handleEditNote(note.id));

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-btn';
  deleteBtn.textContent = 'Delete';
  deleteBtn.addEventListener('click', () => handleDeleteNote(note.id));

  actionsEl.appendChild(editBtn);
  actionsEl.appendChild(deleteBtn);

  noteEl.appendChild(metaEl);
  noteEl.appendChild(actionsEl);

  return noteEl;
}

function handleEditNote(noteId) {
  const note = notesCache.find(item => item.id === noteId);
  if (!note) {
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
  if (!confirm('Are you sure you want to delete this note?')) {
    return;
  }

  setSavingState(true);
  try {
    const deleted = await deleteNote(noteId);
    if (!deleted) {
      return;
    }

    if (editingNoteId === noteId) {
      editingNoteId = null;
      addNoteBtn.textContent = 'Add Note';
      resetEditor();
    }

    await renderNotes();
  } catch (error) {
    console.error(error);
    alert('Failed to delete note. Please try again.');
  } finally {
    setSavingState(false);
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

function setSavingState(isSaving) {
  addNoteBtn.disabled = isSaving;
  addNoteBtn.textContent = isSaving ? 'Saving...' : editingNoteId ? 'Update Note' : 'Add Note';
}
