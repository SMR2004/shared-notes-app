const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// Simple in-memory storage (resets on server restart, but browsers keep copies)
let notes = [];

app.get('/api/notes', (req, res) => {
  res.json(notes);
});

app.post('/api/notes', (req, res) => {
  notes = req.body;
  res.json({ message: 'Notes saved (browser storage is primary)' });
});

app.get('*', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.listen(PORT, () => {
  console.log('🚀 Shared Notes Wall running on port', PORT);
  console.log('💾 Primary storage: Browser localStorage');
  console.log('✅ Notes persist in browsers!');
});
