import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import "dotenv/config";

const app = express();
const port = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_ORIGINS ? process.env.CLIENT_ORIGINS.split(',') : ['http://localhost:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: "Too many requests, please try again later" }
});
app.use('/api', limiter);

// Stricter rate limit for OpenAI endpoints
const openaiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit to 10 OpenAI requests per minute per user
  message: { error: "OpenAI rate limit exceeded, please wait" }
});

app.use(express.json());
app.use(express.text());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint for basic server check
app.get('/', (req, res) => {
  res.json({
    message: 'OpenAI Realtime Server',
    status: 'running',
    endpoints: ['/api/auth/login', '/api/auth/register', '/api/session', '/api/token']
  });
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/openai-realtime');

// User schema
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  usage: {
    requests: { type: Number, default: 0 },
    tokens: { type: Number, default: 0 },
    lastReset: { type: Date, default: Date.now }
  },
  limits: {
    requestsPerDay: { type: Number, default: 100 },
    tokensPerDay: { type: Number, default: 10000 }
  },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// JWT middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Usage tracking middleware
const trackUsage = async (req, res, next) => {
  const user = req.user;
  const now = new Date();
  const daysSinceReset = Math.floor((now - user.usage.lastReset) / (1000 * 60 * 60 * 24));

  // Reset daily usage if needed
  if (daysSinceReset >= 1) {
    user.usage.requests = 0;
    user.usage.tokens = 0;
    user.usage.lastReset = now;
  }

  // Check limits
  if (user.usage.requests >= user.limits.requestsPerDay) {
    return res.status(429).json({ error: 'Daily request limit exceeded' });
  }

  // Increment usage
  user.usage.requests += 1;
  await user.save();

  next();
};

// Auth routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashedPassword });
    await user.save();

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, user: { id: user._id, email: user.email } });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        usage: user.usage,
        limits: user.limits
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// User info route
app.get('/api/user', authenticateToken, async (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      email: req.user.email,
      usage: req.user.usage,
      limits: req.user.limits
    }
  });
});

// OpenAI session configuration
const sessionConfig = JSON.stringify({
  session: {
    type: "realtime",
    model: "gpt-realtime",
    audio: {
      output: {
        voice: "cedar",
      },
    },
  },
});

// Protected OpenAI routes
app.post("/api/session", authenticateToken, trackUsage, openaiLimiter, async (req, res) => {
  try {
    console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
    console.log('OPENAI_API_KEY length:', process.env.OPENAI_API_KEY?.length || 0);
    console.log('OPENAI_API_KEY starts with sk-:', process.env.OPENAI_API_KEY?.startsWith('sk-') || false);

    const fd = new FormData();
    fd.set("sdp", req.body);
    fd.set("session", sessionConfig);

    console.log('Request body (SDP):', req.body.substring(0, 100) + '...');
    console.log('Session config:', sessionConfig);

    const response = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        "OpenAI-Beta": "realtime=v1",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: fd,
    });

    const sdp = await response.text();
    console.log('OpenAI API response status:', response.status);
    console.log('OpenAI API response headers:', Object.fromEntries(response.headers));
    console.log('OpenAI API SDP response:', sdp);

    if (!response.ok) {
      console.error('OpenAI API error response:', sdp);
      return res.status(response.status).json({ error: 'OpenAI API error', details: sdp });
    }

    res.send(sdp);
  } catch (error) {
    console.error("Session creation error:", error);
    res.status(500).json({ error: "Failed to create session" });
  }
});

app.get("/api/token", authenticateToken, trackUsage, openaiLimiter, async (req, res) => {
  try {
    const response = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: sessionConfig,
      },
    );

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Token generation error:", error);
    res.status(500).json({ error: "Failed to generate token" });
  }
});

app.listen(port, () => {
  console.log(`Remote server running on port ${port}`);
});