const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const app = express();
const PORT = process.env.PORT || 3000;

// CORRECTED MongoDB connection string with SSL fix
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://notes-admin:SMR40K@shared-notes-cluster.stiblxk.mongodb.net/notesapp?retryWrites=true&w=majority&ssl=true&tlsAllowInvalidCertificates=false';

let db;
let client;

// Connect to MongoDB with error handling
async function connectToMongoDB() {
  try {
    client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 30000, // 30 seconds timeout
      socketTimeoutMS: 45000, // 45 seconds socket timeout
    });
    
    await client.connect();
    db = client.db('notesapp');
    
    // Test the connection
    await db.command({ ping: 1 });
    console.log('✅ Successfully connected to MongoDB Atlas!');
    console.log('📍 Cluster: shared-notes-cluster');
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.log('💡 Troubleshooting tips:');
    console.log('   1. Check your MongoDB Network Access (allow all IPs: 0.0.0.0/0)');
    console.log('   2. Verify your username/password in the connection string');
    console.log('   3. Make sure the database "notesapp" exists');
  }
}

connectToMongoDB();

app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// Session middleware - using memory store for simplicity
app.use(session({
  secret: process.env.SESSION_SECRET || 'notes-app-secret-key-2024-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, 
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true
  }
}));

// Check if user is logged in
function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Please login first' });
  }
  next();
}

// USER AUTHENTICATION ROUTES

// Register new user
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    
    if (password.length < 3) {
      return res.status(400).json({ error: 'Password must be at least 3 characters' });
    }
    
    // Check if database is connected
    if (!db) {
      return res.status(500).json({ error: 'Database not connected. Please try again.' });
    }
    
    // Check if user exists
    const existingUser = await db.collection('users').findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const result = await db.collection('users').insertOne({
      username,
      password: hashedPassword,
      createdAt: new Date()
    });
    
    // Auto-login after registration
    req.session.userId = result.insertedId.toString();
    req.session.username = username;
    
    res.json({ 
      message: 'Account created successfully!', 
      username,
      redirect: true
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error during registration. Please try again.' });
  }
});

// Login user
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    // Check if database is connected
    if (!db) {
      return res.status(500).json({ error: 'Database not connected. Please try again.' });
    }
    
    // Find user
    const user = await db.collection('users').findOne({ username });
    if (!user) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }
    
    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }
    
    // Create session
    req.session.userId = user._id.toString();
    req.session.username = username;
    
    res.json({ 
      message: 'Login successful!', 
      username,
      redirect: true
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login. Please try again.' });
  }
});

// Logout user
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logout successful' });
  });
});

// Get current user
app.get('/api/user', (req, res) => {
  if (req.session.userId) {
    res.json({ 
      username: req.session.username, 
      loggedIn: true 
    });
  } else {
    res.json({ loggedIn: false });
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
      res.status(503).json({ 
        status: 'unhealthy', 
        database: 'disconnected',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(503).json({ 
      status: 'unhealthy', 
      database: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// NOTES ROUTES

// Get all notes for current user + public notes
app.get('/api/notes', requireLogin, async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }
    
    const notes = await db.collection('notes').find({
      $or: [
        { userId: req.session.userId },
        { isPublic: true }
      ]
    }).sort({ lastModified: -1 }).toArray();
    
    res.json(notes);
    
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ error: 'Failed to load notes. Please refresh the page.' });
  }
});

// Search notes
app.get('/api/notes/search', requireLogin, async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.trim() === '') {
      return res.status(400).json({ error: 'Please enter a search term' });
    }
    
    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }
    
    const notes = await db.collection('notes').find({
      $and: [
        {
          $or: [
            { userId: req.session.userId },
            { isPublic: true }
          ]
        },
        {
          $or: [
            { title: { $regex: query, $options: 'i' } },
            { content: { $regex: query, $options: 'i' } },
            { tags: { $regex: query, $options: 'i' } }
          ]
        }
      ]
    }).toArray();
    
    res.json(notes);
    
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed. Please try again.' });
  }
});

// Save/update notes
app.post('/api/notes', requireLogin, async (req, res) => {
  try {
    const notes = req.body;
    
    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }
    
    // Delete all user's notes first
    await db.collection('notes').deleteMany({ userId: req.session.userId });
    
    // Insert new notes with user ID
    const notesWithUser = notes.map(note => ({
      ...note,
      userId: req.session.userId,
      username: req.session.username,
      lastModified: new Date()
    }));
    
    if (notesWithUser.length > 0) {
      await db.collection('notes').insertMany(notesWithUser);
    }
    
    res.json({ 
      message: `Saved ${notesWithUser.length} notes to database`,
      count: notesWithUser.length
    });
    
  } catch (error) {
    console.error('Error saving notes:', error);
    res.status(500).json({ error: 'Failed to save notes. Please try again.' });
  }
});

// Export user's notes
app.get('/api/export', requireLogin, async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }
    
    const notes = await db.collection('notes').find({
      userId: req.session.userId
    }).toArray();
    
    const exportData = {
      exportedAt: new Date(),
      username: req.session.username,
      noteCount: notes.length,
      notes: notes
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=${req.session.username}-notes-${new Date().toISOString().split('T')[0]}.json`);
    res.send(JSON.stringify(exportData, null, 2));
    
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Export failed. Please try again.' });
  }
});

// Serve the main app
app.get('*', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong! Please try again.' });
});

app.listen(PORT, () => {
  console.log('🚀 Ultimate Shared Notes Wall running on port', PORT);
  console.log('💾 Database: MongoDB Atlas Cloud');
  console.log('🔗 Health check: /api/health');
  console.log('✅ Notes persist forever in the cloud!');
  console.log('📱 App URL: https://shared-notes-app-g6ol.onrender.com');
});
