# OpenAI Realtime Remote Server

This is the remote server component for the OpenAI Realtime Console Electron app.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up MongoDB (local or cloud)

3. Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

4. Start the server:
```bash
npm run dev  # Development with nodemon
npm start    # Production
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/user` - Get user info (authenticated)

### OpenAI Realtime API
- `GET /api/token` - Get ephemeral token (authenticated)
- `POST /api/session` - Create WebRTC session (authenticated)

## Features

- JWT authentication
- Rate limiting
- Usage tracking per user
- Daily limits for requests and tokens
- Security headers with Helmet
- CORS configuration
- MongoDB user storage

## Deployment

This server can be deployed to any cloud platform that supports Node.js:
- Railway
- Render
- Heroku
- AWS
- DigitalOcean

Make sure to set environment variables in your deployment platform.