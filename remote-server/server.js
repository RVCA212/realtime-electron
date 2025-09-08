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
app.use(express.text({ type: '*/*' }));

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

// Default system prompt for the AI assistant
const defaultSystemPrompt = `You are Jenni, an english speaking helpful, friendly AI assistant on the user's mac.
You should: - Be conversational and natural in your responses
- Keep responses concise but informative
- Show enthusiasm when appropriate
- Ask follow-up questions to better understand user needs
IMPORTANT: always speak in english NO MATTER WHAT:`;

// Default voice setting
const defaultVoice = "cedar";

// OpenAI session configuration for client secrets endpoint
const getClientSecretsConfig = (instructions = defaultSystemPrompt, voice = defaultVoice) => ({
  session: {
    type: "realtime",
    model: "gpt-realtime",
    instructions: instructions,
    audio: {
      output: {
        voice: voice,
      },
    },
    tools: [
      {
        type: "function",
        name: "display_color_palette",
        description: "Call this function when a user asks for a color palette.",
        parameters: {
          type: "object",
          strict: true,
          properties: {
            theme: {
              type: "string",
              description: "Description of the theme for the color scheme.",
            },
            colors: {
              type: "array",
              description: "Array of five hex color codes based on the theme.",
              items: {
                type: "string",
                description: "Hex color code",
              },
            },
          },
          required: ["theme", "colors"],
        },
      },
      {
        type: "function",
        name: "get_weather",
        description: "Get the current weather for a given city",
        parameters: {
          type: "object",
          strict: true,
          properties: {
            city: {
              type: "string",
              description: "The name of the city to get weather for",
            },
          },
          required: ["city"],
        },
      },
    ],
    tool_choice: "auto",
  },
});

// Legacy function for backward compatibility (now returns object format)
const getSessionConfig = (instructions = defaultSystemPrompt, voice = defaultVoice) =>
  getClientSecretsConfig(instructions, voice).session;

// WebRTC SDP exchange endpoint - proxies SDP to OpenAI realtime calls API using ephemeral key
app.post("/api/session", authenticateToken, trackUsage, openaiLimiter, async (req, res) => {
  try {
    console.log('Received SDP for WebRTC negotiation, length:', req.body?.length || 0);

    // Extract ephemeral key from custom header
    const ephemeralKey = req.headers['x-openai-ephemeral-key'];
    if (!ephemeralKey) {
      return res.status(400).json({
        error: 'Missing ephemeral API key',
        details: 'Expected X-OpenAI-Ephemeral-Key header with ephemeral key'
      });
    }

    console.log('Using ephemeral key for SDP exchange, key length:', ephemeralKey.length);

    // Validate that we received SDP data
    if (!req.body || typeof req.body !== 'string') {
      return res.status(400).json({
        error: 'Invalid request body',
        details: 'Expected SDP string in request body'
      });
    }

    // Validate SDP format
    if (!req.body.startsWith('v=')) {
      return res.status(400).json({
        error: 'Invalid SDP format',
        details: 'Request body does not appear to be valid SDP data'
      });
    }

    console.log('SDP preview:', req.body.substring(0, 100) + '...');

    // Make request to OpenAI realtime calls endpoint using the ephemeral key
    // This ensures the session uses the configuration embedded in the ephemeral key
    const response = await fetch("https://api.openai.com/v1/realtime/calls?model=gpt-realtime", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ephemeralKey}`,
        "Content-Type": "application/sdp",
        "OpenAI-Beta": "realtime=v1",
      },
      body: req.body,
    });

    console.log('OpenAI calls API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI calls API error response:', errorText);

      let errorMessage = 'Failed to exchange SDP with OpenAI';
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        }
      } catch (parseError) {
        errorMessage = errorText || errorMessage;
      }

      return res.status(response.status).json({
        error: errorMessage,
        details: 'Please check your ephemeral API key and ensure you have access to the Realtime API'
      });
    }

    const responseSdp = await response.text();
    console.log('Received SDP response from OpenAI, length:', responseSdp.length);

    // Validate that we received valid SDP data back
    if (!responseSdp.startsWith('v=')) {
      console.error('Invalid SDP received from OpenAI:', responseSdp.substring(0, 200));
      return res.status(500).json({
        error: 'Invalid SDP response from OpenAI API',
        details: 'The response does not appear to be valid SDP data'
      });
    }

    // Send back the SDP we received from OpenAI
    res.setHeader('Content-Type', 'application/sdp');
    res.send(responseSdp);
  } catch (error) {
    console.error("SDP exchange error:", error);
    res.status(500).json({ error: "Failed to exchange SDP" });
  }
});

app.get("/api/token", authenticateToken, trackUsage, openaiLimiter, async (req, res) => {
  try {
    // Extract custom instructions and voice from headers if provided
    const customInstructions = req.headers['x-system-prompt'];
    const customVoice = req.headers['x-voice'];

    // Use the client secrets config format with session wrapper
    const sessionConfig = getClientSecretsConfig(customInstructions, customVoice);

    console.log('Creating client secret with config:', JSON.stringify(sessionConfig, null, 2));

    const response = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
          "OpenAI-Beta": "realtime=v1",
        },
        body: JSON.stringify(sessionConfig),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Client secrets API error:', response.status, errorText);
      return res.status(response.status).json({
        error: 'Failed to create client secret',
        details: errorText
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Token generation error:", error);
    res.status(500).json({ error: "Failed to generate token" });
  }
});

// System prompt management endpoints
app.get("/api/system-prompt", authenticateToken, async (req, res) => {
  try {
    res.json({ prompt: defaultSystemPrompt });
  } catch (error) {
    console.error("Get system prompt error:", error);
    res.status(500).json({ error: "Failed to get system prompt" });
  }
});

app.post("/api/system-prompt", authenticateToken, async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: "Valid prompt string required" });
    }
    // For now, we'll return success - in a full implementation you might store per-user prompts
    res.json({ success: true, prompt: prompt });
  } catch (error) {
    console.error("Set system prompt error:", error);
    res.status(500).json({ error: "Failed to set system prompt" });
  }
});

// Voice management endpoints
app.get("/api/voice", authenticateToken, async (req, res) => {
  try {
    res.json({
      voice: defaultVoice,
      availableVoices: ['cedar', 'alloy', 'marin']
    });
  } catch (error) {
    console.error("Get voice error:", error);
    res.status(500).json({ error: "Failed to get voice setting" });
  }
});

app.post("/api/voice", authenticateToken, async (req, res) => {
  try {
    const { voice } = req.body;
    const validVoices = ['cedar', 'alloy', 'marin'];

    if (!voice || !validVoices.includes(voice)) {
      return res.status(400).json({
        error: "Valid voice required",
        availableVoices: validVoices
      });
    }

    // For now, we'll return success - in a full implementation you might store per-user voice preferences
    res.json({ success: true, voice: voice });
  } catch (error) {
    console.error("Set voice error:", error);
    res.status(500).json({ error: "Failed to set voice" });
  }
});

// Weather API endpoint (mock data)
app.get("/api/weather", authenticateToken, async (req, res) => {
  try {
    // Placeholder response: always return the same fixed data in expected format
    const placeholderWeatherData = {
      city: "Sample City",
      temperature: 25,
      condition: "sunny",
      humidity: 55,
      description: "The weather in Sample City is pleasant today!"
    };

    res.json(placeholderWeatherData);
  } catch (error) {
    console.error("Weather API error:", error);
    res.status(500).json({ error: "Failed to get weather data" });
  }
});

app.listen(port, () => {
  console.log(`Remote server running on port ${port}`);
});