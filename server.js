const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware - increase payload size for images
app.use(express.json({ limit: '10mb' }));
app.use(express.static('.'));

// Store notes in memory
let notes = [];

// Load notes from file if it exists
try {
  const data = fs.readFileSync('notes.json', 'utf8');
  notes = JSON.parse(data);
} catch (error) {
  console.log('No existing notes file, starting fresh');
}

// Save notes to file
function saveNotesToFile() {
  fs.writeFileSync('notes.json', JSON.stringify(notes, null, 2));
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Get all notes
app.get('/api/notes', (req, res) => {
  res.json(notes);
});

// Save all notes
app.post('/api/notes', (req, res) => {
  notes = req.body;
  saveNotesToFile();
  res.json({ message: 'Notes saved successfully', count: notes.length });
});

// Start server
app.listen(PORT, () => {
  console.log(`Enhanced Shared Notes app running on http://localhost:${PORT}`);
  console.log('All features enabled: colors, resizing, images, backgrounds!');
});