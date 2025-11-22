const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// Simple in-memory storage (no file system)
let notes = [];

// Routes
app.get('/api/notes', (req, res) => {
  console.log('✅ GET /api/notes - Returning', notes.length, 'notes');
  res.json(notes);
});

app.post('/api/notes', (req, res) => {
  console.log('💾 POST /api/notes - Saving', req.body.length, 'notes');
  notes = req.body;
  res.json({ message: 'Notes saved successfully', count: notes.length });
});

// Serve the main page
app.get('*', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.listen(PORT, () => {
  console.log('🚀 Ultimate Shared Notes Wall running on port', PORT);
  console.log('✅ Ready for collaboration!');
});
