const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.static('.'));

// MongoDB connection - USING YOUR PROVIDED CONNECTION STRING
const mongoUrl = process.env.MONGODB_URI || 'mongodb+srv://notes-admin:SMR40K@shared-notes-cluster.stiblxk.mongodb.net/notesapp?retryWrites=true&w=majority';
let db;

// Connect to MongoDB
async function connectDB() {
  try {
    const client = new MongoClient(mongoUrl);
    await client.connect();
    db = client.db(); // Let it use the database from connection string
    console.log('✅ SUCCESS: Connected to MongoDB Atlas!');
    
    // Create index for better performance
    await db.collection('notes').createIndex({ id: 1 });
  } catch (error) {
    console.error('MongoDB connection error:', error);
    // Don't exit, let the server start anyway
  }
}

// Routes - NOTES ONLY

// Get all notes
app.get('/api/notes', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }
    
    const notes = await db.collection('notes').find({}).toArray();
    
    // Convert MongoDB _id to string id for frontend
    const formattedNotes = notes.map(note => {
      const { _id, ...noteData } = note;
      return noteData;
    });
    
    res.json(formattedNotes);
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// Save all notes
app.post('/api/notes', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }
    
    const notes = req.body;
    
    // Clear existing notes and insert new ones
    await db.collection('notes').deleteMany({});
    
    if (notes.length > 0) {
      // Prepare notes for insertion - keep original IDs and dates
      const notesToInsert = notes.map(note => ({
        ...note,
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
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }
    
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
    
    // Convert MongoDB _id to string id for frontend
    const formattedNotes = notes.map(note => {
      const { _id, ...noteData } = note;
      return noteData;
    });
    
    res.json(formattedNotes);
  } catch (error) {
    console.error('Error searching notes:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Export notes
app.get('/api/export', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }
    
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

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    if (!db) {
      return res.json({ status: 'Database disconnected' });
    }
    await db.command({ ping: 1 });
    res.json({ status: 'OK', database: 'Connected' });
  } catch (error) {
    res.json({ status: 'Database error' });
  }
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
async function startServer() {
  await connectDB();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Shared Notes Wall running on port ${PORT}`);
    console.log(`💾 Database: MongoDB Atlas`);
    console.log(`🔓 No login required - open access`);
    console.log(`📝 Notes will persist in cloud storage!`);
    
    if (!db) {
      console.log(`⚠️  Warning: Database not connected, using local storage only`);
    }
  });
}

startServer().catch(console.error);
