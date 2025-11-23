const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB connection - USE YOUR ACTUAL PASSWORD HERE
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://notes-admin:SMR40K@shared-notes-cluster.stiblxk.mongodb.net/notesapp?retryWrites=true&w=majority';

let db;
let client;

// Connect to MongoDB
async function connectToMongoDB() {
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db('notesapp');
    console.log('✅ Connected to MongoDB Atlas');
    console.log('📍 Cluster: shared-notes-cluster');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
  }
}

connectToMongoDB();

app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// Session middleware for user login
app.use(session({
  secret: 'notes-app-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// Check if user is logged in
function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Please login' });
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
    
    res.json({ message: 'User created successfully', username });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Login user
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
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
    
    res.json({ message: 'Login successful', username });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Logout user
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: 'Logout successful' });
});

// Get current user
app.get('/api/user', (req, res) => {
  if (req.session.userId) {
    res.json({ username: req.session.username, loggedIn: true });
  } else {
    res.json({ loggedIn: false });
  }
});

// NOTES ROUTES

// Get all notes for current user + public notes
app.get('/api/notes', requireLogin, async (req, res) => {
  try {
    const notes = await db.collection('notes').find({
      $or: [
        { userId: req.session.userId },
        { isPublic: true }
      ]
    }).toArray();
    
    res.json(notes);
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// Search notes
app.get('/api/notes/search', requireLogin, async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query required' });
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
    res.status(500).json({ error: 'Search failed' });
  }
});

// Save/update notes
app.post('/api/notes', requireLogin, async (req, res) => {
  try {
    const notes = req.body;
    
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
    
    res.json({ message: 'Notes saved to MongoDB' });
  } catch (error) {
    console.error('Error saving notes:', error);
    res.status(500).json({ error: 'Failed to save notes' });
  }
});

// Export user's notes
app.get('/api/export', requireLogin, async (req, res) => {
  try {
    const notes = await db.collection('notes').find({
      userId: req.session.userId
    }).toArray();
    
    const exportData = {
      exportedAt: new Date(),
      username: req.session.username,
      notes: notes
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=my-notes-export.json');
    res.send(JSON.stringify(exportData, null, 2));
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Export failed' });
  }
});

// Serve the main app
app.get('*', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.listen(PORT, () => {
  console.log('🚀 Shared Notes Wall running on port', PORT);
  console.log('💾 Database: MongoDB Atlas - shared-notes-cluster');
  console.log('✅ Notes persist forever in the cloud!');
});
