# OpenAI Realtime Console - Electron App

This is an Electron desktop application for the OpenAI Realtime Console, converted from a web application to run as a native macOS app with remote server authentication.

## Architecture

- **Electron Client**: Native desktop app with React frontend
- **Remote Server**: Node.js server with authentication, rate limiting, and OpenAI API proxy
- **Authentication**: JWT-based user authentication with MongoDB storage

## Quick Setup

### One-Command Setup
```bash
./setup.sh
```

Or manually:
```bash
npm run setup
```

### Configure Environment
Edit `remote-server/.env` with your settings:
```bash
OPENAI_API_KEY=your_openai_api_key_here
JWT_SECRET=your_jwt_secret_here
MONGODB_URI=mongodb://localhost:27017/openai-realtime
PORT=3001
CLIENT_ORIGINS=http://localhost:3000,app://localhost
```

### Run Everything
**Single command to run server + client + Electron app:**
```bash
npm run dev
```

This starts:
- 🟦 **SERVER**: Remote server on port 3001
- 🟪 **CLIENT**: Vite dev server on port 3000  
- 🟩 **ELECTRON**: Desktop app (waits for both servers)

### Other Commands
```bash
npm run build        # Build for production
npm run dist         # Create distributable DMG
npm run electron     # Run Electron app only
```

## Features

- **Native Desktop App**: Runs as a native macOS application
- **User Authentication**: Secure login/registration system
- **Usage Tracking**: Monitor daily API usage and limits
- **Rate Limiting**: Server-side rate limiting to prevent abuse
- **Secure API Proxy**: Server proxies OpenAI API calls securely

## Development

The app uses:
- Electron 28+ for desktop wrapper
- React 18 for UI
- Vite for building
- Tailwind CSS for styling
- JWT for authentication
- MongoDB for user storage

## Deployment

### Remote Server
Deploy the `remote-server/` to any Node.js hosting platform:
- Railway
- Render
- Heroku
- AWS/DigitalOcean

### Desktop App
Build and distribute the Electron app:
- macOS: DMG installer
- Code signing recommended for distribution

## Security

- API keys stored securely on remote server only
- JWT tokens for client authentication
- Rate limiting and usage tracking
- CORS protection
- Security headers with Helmet