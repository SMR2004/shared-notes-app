const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.static('.'));

// MongoDB connection
const mongoUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = 'shared-notes';
let db;

// Connect to MongoDB
async function connectDB() {
  try {
    const client = new MongoClient(mongoUrl);
    await client.connect();
    db = client.db(dbName);
    console.log('✅ SUCCESS: Connected to MongoDB Atlas!');
  } catch (error) {
    console.error('MongoDB connection error:', error);
  }
}

// Routes - NOTES ONLY (no background routes)

// Get all notes
app.get('/api/notes', async (req, res) => {
  try {
    const notes = await db.collection('notes').find({}).toArray();
    res.json(notes);
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// Save all notes
app.post('/api/notes', async (req, res) => {
  try {
    const notes = req.body;
    
    // Clear existing notes and insert new ones
    await db.collection('notes').deleteMany({});
    
    if (notes.length > 0) {
      // Convert string IDs to ObjectId if needed and ensure proper date format
      const notesToInsert = notes.map(note => ({
        ...note,
        _id: new ObjectId(),
        createdAt: note.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
      
      await db.collection('notes').insertMany(notesToInsert);
    }
    
    res.json({ success: true, message: 'Notes saved successfully' });
  } catch (error) {
    console.error('Error saving notes:', error);
    res.status(500).json({ error: 'Failed to save notes' });
  }
});

// Search notes
app.get('/api/notes/search', async (req, res) => {
  try {
    const query = req.query.query;
    if (!query) {
      return res.json([]);
    }
    
    const notes = await db.collection('notes').find({
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { content: { $regex: query, $options: 'i' } },
        { tags: { $regex: query, $options: 'i' } }
      ]
    }).toArray();
    
    res.json(notes);
  } catch (error) {
    console.error('Error searching notes:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Export notes
app.get('/api/export', async (req, res) => {
  try {
    const notes = await db.collection('notes').find({}).toArray();
    
    // Remove MongoDB _id field from export
    const exportData = notes.map(note => {
      const { _id, ...noteData } = note;
      return noteData;
    });
    
    res.setHeader('Content-Disposition', 'attachment; filename=notes-export.json');
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(exportData, null, 2));
  } catch (error) {
    console.error('Error exporting notes:', error);
    res.status(500).json({ error: 'Export failed' });
  }
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
async function startServer() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`🚀 Shared Notes Wall running on port ${PORT}`);
    console.log(`💾 Database: MongoDB Atlas`);
    console.log(`🔓 No login required - open access`);
    console.log(`✅ Notes persist in cloud storage!`);
  });
}

startServer().catch(console.error);
