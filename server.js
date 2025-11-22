const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware - increase payload size for images
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// Store notes in memory
let notes = [];

// Load notes from file if it exists
try {
  const data = fs.readFileSync(path.join(__dirname, 'notes.json'), 'utf8');
  notes = JSON.parse(data);
  console.log('Loaded', notes.length, 'notes from file');
} catch (error) {
  console.log('No existing notes file, starting fresh');
  notes = [];
}

// Save notes to file
function saveNotesToFile() {
  try {
    fs.writeFileSync(path.join(__dirname, 'notes.json'), JSON.stringify(notes, null, 2));
    console.log('Saved', notes.length, 'notes to file');
  } catch (error) {
    console.error('Error saving notes:', error);
  }
}

// Routes
app.get('/api/notes', (req, res) => {
  console.log('GET /api/notes - Returning', notes.length, 'notes');
  res.json(notes);
});

// Save all notes
app.post('/api/notes', (req, res) => {
  console.log('POST /api/notes - Saving', req.body.length, 'notes');
  notes = req.body;
  saveNotesToFile();
  res.json({ message: 'Notes saved successfully', count: notes.length });
});

// Serve the main page for ALL other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Shared Notes app running on http://0.0.0.0:${PORT}`);
  console.log('Your app is ready for production!');
});
