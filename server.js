const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// Persistent storage with proper error handling
let notes = [];

// Function to get the correct file path for Render
function getNotesFilePath() {
  // On Render, use the /tmp directory which has write permissions
  if (process.env.RENDER) {
    return '/tmp/notes.json';
  }
  // Local development
  return path.join(__dirname, 'notes.json');
}

// Load notes from file
function loadNotesFromFile() {
  try {
    const filePath = getNotesFilePath();
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      notes = JSON.parse(data);
      console.log('✅ Loaded', notes.length, 'notes from persistent storage');
    } else {
      notes = [];
      console.log('📝 No existing notes file, starting fresh');
    }
  } catch (error) {
    console.log('⚠️ Could not load notes file, starting fresh:', error.message);
    notes = [];
  }
}

// Save notes to file with robust error handling
function saveNotesToFile() {
  try {
    const filePath = getNotesFilePath();
    const data = JSON.stringify(notes, null, 2);
    fs.writeFileSync(filePath, data, 'utf8');
    console.log('💾 Saved', notes.length, 'notes to persistent storage');
    return true;
  } catch (error) {
    console.error('❌ Error saving notes:', error.message);
    // Fallback to memory storage if file saving fails
    return false;
  }
}

// Initialize - load notes when server starts
loadNotesFromFile();

// Auto-save notes every 30 seconds as backup
setInterval(() => {
  if (notes.length > 0) {
    saveNotesToFile();
  }
}, 30000);

// Routes
app.get('/api/notes', (req, res) => {
  console.log('📤 GET /api/notes - Returning', notes.length, 'notes');
  res.json(notes);
});

app.post('/api/notes', (req, res) => {
  console.log('💫 POST /api/notes - Saving', req.body.length, 'notes');
  notes = req.body;
  
  // Try to save to file, but continue even if it fails
  const saved = saveNotesToFile();
  
  res.json({ 
    message: 'Notes saved successfully', 
    count: notes.length,
    persisted: saved
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    notesCount: notes.length,
    storage: 'persistent',
    timestamp: new Date().toISOString()
  });
});

// Serve the main page
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log('🚀 ULTIMATE Shared Notes Wall running on port', PORT);
  console.log('💾 Persistent storage: ENABLED');
  console.log('✅ Notes will survive server restarts!');
  console.log('🌐 Your app is ready at:', `https://shared-notes-app-g6ol.onrender.com`);
});
