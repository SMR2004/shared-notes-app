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
} catch (error) {
  console.log('No existing notes file, starting fresh');
}

// Save notes to file
function saveNotesToFile() {
  fs.writeFileSync(path.join(__dirname, 'notes.json'), JSON.stringify(notes, null, 2));
}

// IMPORTANT: Serve the main page for ALL routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    // Let API routes handle these
    return next();
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

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

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Shared Notes app running on http://0.0.0.0:${PORT}`);
  console.log('Your app is ready for production!');
});
