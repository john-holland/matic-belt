import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { ChatManager } from './chatManager';
import { ROLEPLAY_TEMPLATES } from './roleplayTemplates';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Initialize chat manager
const chatManager = new ChatManager(process.env.OPENAI_API_KEY || '');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Routes
app.get('/api/templates', (req, res) => {
  res.json(ROLEPLAY_TEMPLATES);
});

app.get('/api/templates/:category', (req, res) => {
  const { category } = req.params;
  const templates = ROLEPLAY_TEMPLATES.filter(t => t.category === category);
  res.json(templates);
});

app.get('/api/sessions', (req, res) => {
  const sessions = chatManager.getAllSessions();
  res.json(sessions);
});

app.get('/api/sessions/:id', (req, res) => {
  const { id } = req.params;
  const session = chatManager.getSession(id);
  if (session) {
    res.json(session);
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

app.delete('/api/sessions/:id', (req, res) => {
  const { id } = req.params;
  const deleted = chatManager.deleteSession(id);
  if (deleted) {
    res.json({ message: 'Session deleted successfully' });
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const request = req.body;
    const response = await chatManager.processMessage(request);
    res.json(response);
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

app.post('/api/sessions/:id/settings', (req, res) => {
  const { id } = req.params;
  const { settings } = req.body;
  const updated = chatManager.updateSessionSettings(id, settings);
  if (updated) {
    res.json({ message: 'Settings updated successfully' });
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

// WebSocket handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-session', (sessionId: string) => {
    socket.join(sessionId);
    console.log(`Client ${socket.id} joined session ${sessionId}`);
  });

  socket.on('leave-session', (sessionId: string) => {
    socket.leave(sessionId);
    console.log(`Client ${socket.id} left session ${sessionId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    sessions: chatManager.getAllSessions().length
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 Argument Diffuser server running on port ${PORT}`);
  console.log(`🌐 Open http://localhost:${PORT} in your browser`);
  console.log(`📡 WebSocket server ready for real-time chat`);
  
  if (!process.env.OPENAI_API_KEY) {
    console.warn('⚠️  Warning: OPENAI_API_KEY not set. Please set it in your .env file.');
  }
});

export { app, server, io, chatManager };







