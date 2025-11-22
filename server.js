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
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB error:', error);
  }
}

app.get('/api/notes', async (req, res) => {
  try {
    const data = await notesCollection.findOne({ type: 'init' });
    res.json(data ? data.notes : []);
  } catch (error) {
    res.json([]);
  }
});

app.post('/api/notes', async (req, res) => {
  try {
    await notesCollection.updateOne(
      { type: 'init' },
      { $set: { notes: req.body } },
      { upsert: true }
    );
    res.json({ message: 'Saved to MongoDB!' });
  } catch (error) {
    res.json({ message: 'Saved temporarily' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

connectToDatabase().then(() => {
  app.listen(PORT, () => {
    console.log('🚀 Server running on port', PORT);
  });
});
