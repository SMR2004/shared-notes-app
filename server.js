<script>
// DOM Elements
const wall = document.getElementById("wall");
const status = document.getElementById("status");
const imageUpload = document.getElementById("imageUpload");
const standaloneImageUpload = document.getElementById("standaloneImageUpload");
const bgUpload = document.getElementById("bgUpload");
const imageModal = document.getElementById("imageModal");
const modalImage = document.getElementById("modalImage");
const closeModal = document.querySelector(".close-modal");
const soundToggle = document.getElementById("soundToggle");

// Toolbar elements
const addBtn = document.getElementById("addBtn");
const addImageBtn = document.getElementById("addImageBtn");
const colorBtn = document.getElementById("colorBtn");
const colorPalette = document.getElementById("colorPalette");
const bgBtn = document.getElementById("bgBtn");
const backgroundPicker = document.getElementById("backgroundPicker");
const searchBtn = document.getElementById("searchBtn");
const exportBtn = document.getElementById("exportBtn");
const searchBox = document.getElementById("searchBox");
const searchInput = document.getElementById("searchInput");
const doSearch = document.getElementById("doSearch");
const clearSearchBtn = document.getElementById("clearSearchBtn");

// State
let notes = [];
let isDragging = false;
let currentElement = null;
let dragOffset = { x: 0, y: 0 };
let isResizing = false;
let selectedColor = "#fff176";
let currentColorNote = null;
let isUserTyping = false;
let resizeStartSize = { width: 0, height: 0 };
let resizeStartPos = { x: 0, y: 0 };
let soundsEnabled = true;
let currentBackground = { type: 'color', value: '#f5f5f5' }; // NEW: Track current background

// Background options
const backgrounds = {
  default: '#f5f5f5',
  black: '#000000',
  white: '#ffffff',
  blue: '#2196F3',
  green: '#4CAF50'
};

// Initialize - NO AUTHENTICATION
async function init() {
  setupEventListeners();
  await loadBackground(); // NEW: Load shared background first
  await loadNotes();
  setInterval(smartRefresh, 3000);
  showStatus('Ready! Shared notes wall loaded.');
}

// NEW: Load shared background from server
async function loadBackground() {
  try {
    const response = await fetch('/api/background');
    const background = await response.json();
    currentBackground = background;
    applyBackground(background);
  } catch (error) {
    console.error('Error loading background:', error);
    // Fallback to default
    applyBackground({ type: 'color', value: '#f5f5f5' });
  }
}

// NEW: Apply background to wall
function applyBackground(background) {
  if (background.type === 'color') {
    wall.style.backgroundImage = 'none';
    wall.style.backgroundColor = background.value;
  } else if (background.type === 'image') {
    wall.style.backgroundImage = `url(${background.value})`;
    wall.style.backgroundColor = '#f5f5f5'; // Fallback color
  }
}

// NEW: Save background to server (shared for all users)
async function saveBackground(type, value) {
  try {
    const response = await fetch('/api/background', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, value }),
    });
    
    if (!response.ok) throw new Error('Failed to save background');
    
    currentBackground = { type, value };
    showStatus('Background updated for all users!');
  } catch (error) {
    console.error('Error saving background:', error);
    showStatus('Failed to update background', 'updating');
  }
}

// Smart refresh - UPDATED: Also refresh background
async function smartRefresh() {
  if (isUserTyping) return;
  
  try {
    // Refresh background
    const bgResponse = await fetch('/api/background');
    const serverBackground = await bgResponse.json();
    
    if (JSON.stringify(currentBackground) !== JSON.stringify(serverBackground)) {
      currentBackground = serverBackground;
      applyBackground(serverBackground);
    }
    
    // Refresh notes
    const notesResponse = await fetch('/api/notes');
    if (!notesResponse.ok) return;
    
    const serverNotes = await notesResponse.json();
    
    if (JSON.stringify(notes) !== JSON.stringify(serverNotes) && !isUserTyping) {
      notes = serverNotes;
      renderNotes();
    }
  } catch (error) {
    console.error('Error refreshing:', error);
  }
}

// Set up event listeners
function setupEventListeners() {
  // Toolbar buttons
  addBtn.addEventListener("click", () => {
    console.log("+ New Note clicked");
    createNote();
    addBtn.classList.add('pulse');
    setTimeout(() => addBtn.classList.remove('pulse'), 500);
  });
  
  addImageBtn.addEventListener("click", () => {
    console.log("📸 Add Image clicked");
    standaloneImageUpload.click();
    addImageBtn.classList.add('pulse');
    setTimeout(() => addImageBtn.classList.remove('pulse'), 500);
  });
  
  // Color picker
  colorBtn.addEventListener("click", () => {
    console.log("🎨 Colors clicked");
    toggleColorPalette();
    colorBtn.classList.add('pulse');
    setTimeout(() => colorBtn.classList.remove('pulse'), 500);
  });
  
  document.querySelectorAll('.color-option').forEach(option => {
    option.addEventListener('click', (e) => {
      selectedColor = e.target.dataset.color;
      document.querySelectorAll('.color-option').forEach(opt => {
        opt.classList.toggle('active', opt === e.target);
      });
      
      if (currentColorNote) {
        currentColorNote.style.backgroundColor = selectedColor;
        updateNoteColor(currentColorNote.dataset.id, selectedColor);
        currentColorNote.classList.add('pulse');
        setTimeout(() => currentColorNote.classList.remove('pulse'), 500);
      }
      
      colorPalette.style.display = 'none';
      currentColorNote = null;
    });
  });
  
  // Background picker - UPDATED: Save to server
  bgBtn.addEventListener("click", () => {
    console.log("🏞️ Background clicked");
    toggleBackgroundPicker();
    bgBtn.classList.add('pulse');
    setTimeout(() => bgBtn.classList.remove('pulse'), 500);
  });
  
  document.querySelectorAll('.bg-option').forEach(option => {
    option.addEventListener('click', (e) => {
      const bgType = e.target.dataset.bg || e.target.parentElement.dataset.bg;
      
      if (bgType === 'upload') {
        bgUpload.click();
      } else {
        // Save color background to server
        const colorValue = backgrounds[bgType] || '#f5f5f5';
        saveBackground('color', colorValue);
        applyBackground({ type: 'color', value: colorValue });
        wall.style.animation = 'pulse 0.5s ease-in-out';
        setTimeout(() => wall.style.animation = '', 500);
      }
      
      updateActiveBackground(bgType);
      backgroundPicker.style.display = 'none';
    });
  });
  
  // Background upload - UPDATED: Save image to server
  bgUpload.addEventListener('change', handleBackgroundUpload);
  
  // Image uploads
  standaloneImageUpload.addEventListener('change', handleStandaloneImageUpload);
  
  // Search functionality
  searchBtn.addEventListener('click', () => {
    console.log("🔍 Search clicked");
    toggleSearch();
    searchBtn.classList.add('pulse');
    setTimeout(() => searchBtn.classList.remove('pulse'), 500);
  });
  
  doSearch.addEventListener('click', performSearch);
  
  clearSearchBtn.addEventListener('click', () => {
    console.log("Clear search clicked");
    clearSearchFunction();
  });
  
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
  });
  
  // Export
  exportBtn.addEventListener('click', () => {
    console.log("📤 Export clicked");
    exportNotes();
    exportBtn.classList.add('pulse');
    setTimeout(() => exportBtn.classList.remove('pulse'), 500);
  });
  
  // Image modal
  closeModal.addEventListener('click', () => {
    imageModal.style.display = 'none';
  });
  
  imageModal.addEventListener('click', (e) => {
    if (e.target === imageModal) {
      imageModal.style.display = 'none';
    }
  });
  
  // Sound toggle
  soundToggle.addEventListener('click', () => {
    soundsEnabled = !soundsEnabled;
    soundToggle.classList.toggle('muted', !soundsEnabled);
    soundToggle.textContent = soundsEnabled ? '🔊' : '🔇';
    soundToggle.classList.add('pulse');
    setTimeout(() => soundToggle.classList.remove('pulse'), 500);
  });
  
  // Close pickers when clicking outside
  document.addEventListener('click', (e) => {
    if (!colorBtn.contains(e.target) && !colorPalette.contains(e.target)) {
      colorPalette.style.display = 'none';
      currentColorNote = null;
    }
    
    if (!bgBtn.contains(e.target) && !backgroundPicker.contains(e.target)) {
      backgroundPicker.style.display = 'none';
    }
    
    if (!searchBtn.contains(e.target) && !searchBox.contains(e.target)) {
      searchBox.style.display = 'none';
    }
  });
  
  // Keyboard shortcut
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      createNote();
    }
  });
}

// Load notes from server
async function loadNotes() {
  try {
    const response = await fetch('/api/notes');
    
    if (!response.ok) throw new Error('Failed to load notes');
    
    notes = await response.json();
    renderNotes();
    showStatus(`Loaded ${notes.length} notes`);
    
  } catch (error) {
    console.error('Error loading notes:', error);
    showStatus('Ready! Create your first note.');
  }
}

// Save notes to server - OPTIMIZED: Debounced saving
let saveTimeout;
async function saveNotes() {
  // Clear previous timeout to prevent multiple rapid saves
  if (saveTimeout) clearTimeout(saveTimeout);
  
  // Debounce saving to reduce server load
  saveTimeout = setTimeout(async () => {
    try {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notes),
      });
      
      if (!response.ok) throw new Error('Failed to save notes');
      
    } catch (error) {
      console.error('Error saving notes:', error);
    }
  }, 500); // Wait 500ms after last change
}

// Show status with animation
function showStatus(message, type = '') {
  status.textContent = message;
  status.className = `status ${type}`;
}

// Create a new note
async function createNote(x = 50, y = 50) {
  const newNote = {
    id: Date.now().toString(),
    type: 'note',
    x,
    y,
    width: 250,
    height: 200,
    title: 'New Note',
    content: 'Type your note here...',
    color: selectedColor,
    image: null,
    tags: [],
    isPublic: true,
    createdAt: new Date().toISOString()
  };
  
  notes.push(newNote);
  renderNotes();
  await saveNotes();
  showStatus('New note created!');
}

// Handle standalone image upload
function handleStandaloneImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  if (file.size > 5 * 1024 * 1024) {
    showStatus('Image too large! Max 5MB allowed.', 'updating');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (e) => {
    const standaloneImage = {
      id: Date.now().toString(),
      type: 'image',
      x: 100,
      y: 100,
      width: 300,
      height: 300,
      src: e.target.result,
      isPublic: true,
      createdAt: new Date().toISOString()
    };
    
    notes.push(standaloneImage);
    renderNotes();
    saveNotes();
    showStatus('Image added to wall!');
  };
  reader.readAsDataURL(file);
}

// Render all notes and images
function renderNotes() {
  const activeElement = document.activeElement;
  let focusedNoteId = null;
  let selectionStart = null;
  let selectionEnd = null;
  
  if (activeElement && (activeElement.classList.contains('note-title') || activeElement.classList.contains('note-content'))) {
    const noteElement = activeElement.closest('.note');
    if (noteElement) {
      focusedNoteId = noteElement.dataset.id;
      selectionStart = activeElement.selectionStart;
      selectionEnd = activeElement.selectionEnd;
    }
  }
  
  const existingElements = wall.querySelectorAll('.note, .standalone-image-container');
  existingElements.forEach(element => element.remove());
  
  notes.forEach(note => {
    if (note.type === 'image') {
      const imageElement = createImageElement(note);
      wall.appendChild(imageElement);
    } else {
      const noteElement = createNoteElement(note);
      wall.appendChild(noteElement);
      
      if (note.id === focusedNoteId) {
        const inputType = activeElement.classList.contains('note-title') ? 'note-title' : 'note-content';
        const input = noteElement.querySelector(`.${inputType}`);
        if (input) {
          setTimeout(() => {
            input.focus();
            input.setSelectionRange(selectionStart, selectionEnd);
          }, 10);
        }
      }
    }
  });
}

// Create note DOM element
function createNoteElement(note) {
  const noteDiv = document.createElement('div');
  noteDiv.className = 'note';
  noteDiv.style.left = note.x + 'px';
  noteDiv.style.top = note.y + 'px';
  noteDiv.style.width = note.width + 'px';
  noteDiv.style.height = note.height + 'px';
  noteDiv.style.backgroundColor = note.color;
  noteDiv.dataset.id = note.id;
  
  noteDiv.innerHTML = `
    <div class="note-header">
      <input type="text" class="note-title" value="${note.title}" placeholder="Note title">
      <div class="note-controls">
        <button class="note-btn color-btn" title="Change color">🎨</button>
        <button class="note-btn tag-btn" title="Add tags">🏷️</button>
        <button class="note-btn image-btn" title="Add image">🖼️</button>
        <button class="note-btn delete-btn" title="Delete note">×</button>
      </div>
    </div>
    <textarea class="note-content" placeholder="Type your note here...">${note.content}</textarea>
    ${note.tags && note.tags.length > 0 ? `<div class="note-tags">${note.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>` : ''}
    ${note.image ? `<img src="${note.image}" class="note-image" alt="Note image">` : ''}
    <div class="resize-handle" title="Resize"></div>
  `;
  
  setupNoteEvents(noteDiv, note);
  return noteDiv;
}

// Create standalone image element
function createImageElement(note) {
  const container = document.createElement('div');
  container.className = 'standalone-image-container';
  container.style.left = note.x + 'px';
  container.style.top = note.y + 'px';
  container.style.width = note.width + 'px';
  container.style.height = note.height + 'px';
  container.dataset.id = note.id;
  
  container.innerHTML = `
    <img src="${note.src}" class="standalone-image" alt="Uploaded image">
    <div class="note-controls" style="position: absolute; top: 10px; right: 10px;">
      <button class="note-btn delete-btn" title="Delete image">×</button>
    </div>
    <div class="resize-handle" title="Resize"></div>
  `;
  
  setupImageEvents(container, note);
  return container;
}

// Set up event listeners for a note
function setupNoteEvents(noteElement, noteData) {
  // Delete button
  noteElement.querySelector('.delete-btn').addEventListener('click', async (e) => {
    e.stopPropagation();
    notes = notes.filter(n => n.id !== noteData.id);
    renderNotes();
    await saveNotes();
    showStatus('Note deleted');
  });
  
  // Color button
  noteElement.querySelector('.color-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    currentColorNote = noteElement;
    
    const rect = noteElement.getBoundingClientRect();
    colorPalette.style.left = (rect.left - 100) + 'px';
    colorPalette.style.top = (rect.top + 40) + 'px';
    colorPalette.style.display = 'grid';
    
    document.querySelectorAll('.color-option').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.color === noteData.color);
    });
  });
  
  // Tag button
  noteElement.querySelector('.tag-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const tag = prompt('Enter tags (comma separated):', noteData.tags ? noteData.tags.join(', ') : '');
    if (tag !== null) {
      noteData.tags = tag.split(',').map(t => t.trim()).filter(t => t);
      renderNotes();
      saveNotes();
      showStatus('Tags updated');
    }
  });
  
  // Image button
  noteElement.querySelector('.image-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    currentColorNote = noteElement;
    imageUpload.onchange = (e) => handleImageUpload(e, noteData.id);
    imageUpload.click();
  });
  
  // Image click to enlarge
  const noteImage = noteElement.querySelector('.note-image');
  if (noteImage) {
    noteImage.addEventListener('click', () => {
      modalImage.src = noteImage.src;
      imageModal.style.display = 'flex';
    });
  }
  
  // Title input
  const titleInput = noteElement.querySelector('.note-title');
  titleInput.addEventListener('input', async (e) => {
    isUserTyping = true;
    noteData.title = e.target.value;
    await saveNotes();
    setTimeout(() => { isUserTyping = false; }, 1000);
  });
  
  titleInput.addEventListener('focus', () => { isUserTyping = true; });
  titleInput.addEventListener('blur', () => { isUserTyping = false; });
  
  // Content input
  const contentInput = noteElement.querySelector('.note-content');
  contentInput.addEventListener('input', async (e) => {
    isUserTyping = true;
    noteData.content = e.target.value;
    await saveNotes();
    setTimeout(() => { isUserTyping = false; }, 1000);
  });
  
  contentInput.addEventListener('focus', () => { isUserTyping = true; });
  contentInput.addEventListener('blur', () => { isUserTyping = false; });
  
  // Drag functionality - OPTIMIZED: Reduced lag
  setupDrag(noteElement, noteData);
  
  // Resize functionality
  setupResize(noteElement, noteData);
}

// Set up event listeners for standalone image
function setupImageEvents(imageElement, imageData) {
  // Delete button
  imageElement.querySelector('.delete-btn').addEventListener('click', async (e) => {
    e.stopPropagation();
    notes = notes.filter(n => n.id !== imageData.id);
    renderNotes();
    await saveNotes();
    showStatus('Image deleted');
  });
  
  // Image click to enlarge
  const img = imageElement.querySelector('.standalone-image');
  img.addEventListener('click', (e) => {
    if (e.target.classList.contains('note-btn')) return;
    modalImage.src = img.src;
    imageModal.style.display = 'flex';
  });
  
  // Drag functionality - OPTIMIZED: Reduced lag
  setupDrag(imageElement, imageData);
  
  // Resize functionality
  setupResize(imageElement, imageData);
}

// Drag functionality - OPTIMIZED: Reduced lag
function setupDrag(element, data) {
  let dragFrame;
  
  element.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('resize-handle') || 
        e.target.tagName === 'INPUT' || 
        e.target.tagName === 'TEXTAREA' ||
        e.target.classList.contains('note-btn')) {
      return;
    }
    
    e.preventDefault();
    isDragging = true;
    currentElement = element;
    element.classList.add('dragging');
    
    const rect = element.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
    
    function drag(e) {
      if (!isDragging) return;
      
      // Use requestAnimationFrame for smoother dragging
      if (dragFrame) cancelAnimationFrame(dragFrame);
      
      dragFrame = requestAnimationFrame(() => {
        const x = e.clientX - dragOffset.x;
        const y = e.clientY - dragOffset.y;
        
        element.style.left = x + 'px';
        element.style.top = y + 'px';
      });
    }
    
    function stopDrag() {
      isDragging = false;
      element.classList.remove('dragging');
      
      if (dragFrame) {
        cancelAnimationFrame(dragFrame);
        dragFrame = null;
      }
      
      // Only save final position, not during drag (reduces lag)
      data.x = parseInt(element.style.left);
      data.y = parseInt(element.style.top);
      saveNotes();
      
      document.removeEventListener('mousemove', drag);
      document.removeEventListener('mouseup', stopDrag);
    }
    
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDrag);
  });
}

// Resize functionality
function setupResize(element, data) {
  const handle = element.querySelector('.resize-handle');
  
  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    isResizing = true;
    element.classList.add('resizing');
    
    resizeStartSize.width = element.offsetWidth;
    resizeStartSize.height = element.offsetHeight;
    resizeStartPos.x = e.clientX;
    resizeStartPos.y = e.clientY;
    
    function resize(e) {
      if (!isResizing) return;
      
      const deltaX = e.clientX - resizeStartPos.x;
      const deltaY = e.clientY - resizeStartPos.y;
      
      const newWidth = Math.max(200, resizeStartSize.width + deltaX);
      const newHeight = Math.max(150, resizeStartSize.height + deltaY);
      
      element.style.width = newWidth + 'px';
      element.style.height = newHeight + 'px';
    }
    
    function stopResize() {
      isResizing = false;
      element.classList.remove('resizing');
      data.width = parseInt(element.style.width);
      data.height = parseInt(element.style.height);
      saveNotes();
      
      document.removeEventListener('mousemove', resize);
      document.removeEventListener('mouseup', stopResize);
    }
    
    document.addEventListener('mousemove', resize);
    document.addEventListener('mouseup', stopResize);
  });
}

// Handle image upload to note
function handleImageUpload(event, noteId) {
  const file = event.target.files[0];
  if (!file) return;
  
  if (file.size > 5 * 1024 * 1024) {
    showStatus('Image too large! Max 5MB allowed.', 'updating');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (e) => {
    const note = notes.find(n => n.id === noteId);
    if (note) {
      note.image = e.target.result;
      renderNotes();
      saveNotes();
      showStatus('Image added to note!');
    }
  };
  reader.readAsDataURL(file);
}

// Handle background upload - UPDATED: Save to server
function handleBackgroundUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  if (file.size > 10 * 1024 * 1024) {
    showStatus('Background image too large! Max 10MB allowed.', 'updating');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (e) => {
    // Save image background to server
    saveBackground('image', e.target.result);
    applyBackground({ type: 'image', value: e.target.result });
    showStatus('Background updated for all users!');
  };
  reader.readAsDataURL(file);
}

// Set background - UPDATED: Now uses shared background
function setBackground(bgType) {
  if (bgType === 'default') {
    saveBackground('color', '#f5f5f5');
    applyBackground({ type: 'color', value: '#f5f5f5' });
  } else if (backgrounds[bgType]) {
    saveBackground('color', backgrounds[bgType]);
    applyBackground({ type: 'color', value: backgrounds[bgType] });
  }
}

// Update active background in picker
function updateActiveBackground(activeBg) {
  document.querySelectorAll('.bg-option').forEach(option => {
    option.classList.toggle('active', option.dataset.bg === activeBg);
  });
}

// Update note color
function updateNoteColor(noteId, color) {
  const note = notes.find(n => n.id === noteId);
  if (note) {
    note.color = color;
    saveNotes();
  }
}

// Toggle color palette
function toggleColorPalette() {
  const isVisible = colorPalette.style.display === 'grid';
  colorPalette.style.display = isVisible ? 'none' : 'grid';
  backgroundPicker.style.display = 'none';
  searchBox.style.display = 'none';
  currentColorNote = null;
}

// Toggle background picker
function toggleBackgroundPicker() {
  const isVisible = backgroundPicker.style.display === 'flex';
  backgroundPicker.style.display = isVisible ? 'none' : 'flex';
  colorPalette.style.display = 'none';
  searchBox.style.display = 'none';
}

// Search functionality
function toggleSearch() {
  const isVisible = searchBox.style.display === 'block';
  searchBox.style.display = isVisible ? 'none' : 'block';
  colorPalette.style.display = 'none';
  backgroundPicker.style.display = 'none';
  
  if (!isVisible) {
    searchInput.focus();
  }
}

async function performSearch() {
  const query = searchInput.value;
  if (!query.trim()) return;
  
  try {
    const response = await fetch(`/api/notes/search?query=${encodeURIComponent(query)}`);
    const searchResults = await response.json();
    
    notes = searchResults;
    renderNotes();
    showStatus(`Found ${searchResults.length} notes matching "${query}"`);
  } catch (error) {
    showStatus('Search failed', 'updating');
  }
}

function clearSearchFunction() {
  searchInput.value = '';
  loadNotes();
  searchBox.style.display = 'none';
}

// Export notes
async function exportNotes() {
  try {
    const response = await fetch('/api/export');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notes-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    showStatus('Notes exported successfully!');
  } catch (error) {
    showStatus('Export failed', 'updating');
  }
}

// Initialize the app
init();
</script>
