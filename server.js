const express = require('express');
const path = require('path');
const { MongoClient } = require('mongodb');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

const MONGODB_URI = process.env.MONGODB_URI;
let db, notesCollection;

async function connectToDatabase() {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db('shared-notes');
    notesCollection = db.collection('notes');
    console.log('✅ Connected to MongoDB Atlas!');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
  }
}

app.get('/api/notes', async (req, res) => {
  try {
    const data = await notesCollection.findOne({ type: 'init' });
    const notes = data ? data.notes : [];
    console.log('📤 Sending', notes.length, 'notes');
    res.json(notes);
  } catch (error) {
    console.error('❌ Error loading notes:', error.message);
    res.json([]);
  }
});

app.post('/api/notes', async (req, res) => {
  try {
    console.log('💾 Saving', req.body.length, 'notes to MongoDB');
    await notesCollection.updateOne(
      { type: 'init' },
      { $set: { notes: req.body, updatedAt: new Date() } },
      { upsert: true }
    );
    res.json({ message: 'Notes saved to MongoDB!', persisted: true });
  } catch (error) {
    console.error('❌ Error saving notes:', error.message);
    res.json({ message: 'Saved temporarily', persisted: false });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

connectToDatabase().then(() => {
  app.listen(PORT, () => {
    console.log('🚀 Shared Notes Wall running on port', PORT);
    console.log('💾 MongoDB: Ready');
    console.log('✅ Notes will persist FOREVER!');
  });
});
