const express = require('express');
const { MongoClient } = require('mongodb');
const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://notes-admin:SMR40K@shared-notes-cluster.stiblxk.mongodb.net/notesapp?retryWrites=true&w=majority';

let db;
let client;

// Connect to MongoDB
async function connectToMongoDB() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    
    client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });
    
    await client.connect();
    db = client.db('notesapp');
    
    // Test connection
    await db.command({ ping: 1 });
    console.log('✅ SUCCESS: Connected to MongoDB Atlas!');
    
    return true;
    
  } catch (error) {
    console.error('❌ MongoDB Connection Failed:', error.message);
    return false;
  }
}

connectToMongoDB();

app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// NOTES ROUTES - NO AUTHENTICATION NEEDED

// Get all notes (everyone sees everything)
app.get('/api/notes', async (req, res) => {
  try {
    if (!db) {
      return res.json([]);
    }
    
    const notes = await db.collection('notes').find({}).toArray();
    res.json(notes);
    
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.json([]);
  }
});

// Search notes
app.get('/api/notes/search', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.trim() === '') {
      return res.json([]);
    }
    
    if (!db) {
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
    console.error('Search error:', error);
    res.json([]);
  }
});

// Save/update notes
app.post('/api/notes', async (req, res) => {
  try {
    const notes = req.body;
    
    if (!db) {
      return res.json({ message: 'Database not available' });
    }
    
    // Delete all notes first (since no users, we replace everything)
    await db.collection('notes').deleteMany({});
    
    // Insert new notes with timestamp
    const notesWithTimestamp = notes.map(note => ({
      ...note,
      lastModified: new Date()
    }));
    
    if (notesWithTimestamp.length > 0) {
      await db.collection('notes').insertMany(notesWithTimestamp);
    }
    
    res.json({ 
      message: `Saved ${notesWithTimestamp.length} notes to database`
    });
    
  } catch (error) {
    console.error('Error saving notes:', error);
    res.status(500).json({ error: 'Failed to save notes' });
  }
});

// Export notes
app.get('/api/export', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }
    
    const notes = await db.collection('notes').find({}).toArray();
    
    const exportData = {
      exportedAt: new Date(),
      noteCount: notes.length,
      notes: notes
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=notes-export-${new Date().toISOString().split('T')[0]}.json`);
    res.send(JSON.stringify(exportData, null, 2));
    
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Export failed' });
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    if (db) {
      await db.command({ ping: 1 });
      res.json({ 
        status: 'healthy', 
        database: 'connected',
        timestamp: new Date().toISOString()
      });
    } else {
      res.json({ 
        status: 'healthy', 
        database: 'disconnected',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.json({ 
      status: 'healthy', 
      database: 'error',
      timestamp: new Date().toISOString()
    });
  }
});

// Serve the main app
app.get('*', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.listen(PORT, () => {
  console.log('🚀 Shared Notes Wall running on port', PORT);
  console.log('💾 Database: MongoDB Atlas');
  console.log('🔓 No login required - open access');
  console.log('✅ Notes persist in cloud storage!');
});
