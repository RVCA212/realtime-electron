# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server with nodemon on port 3000
- `npm start` - Start production server
- `npm run build` - Build both client and server for production
- `npm run build:client` - Build React client with Vite (outputs to dist/client)
- `npm run build:server` - Build server with SSR (outputs to dist/server)
- `npm run lint` - Run ESLint with auto-fix on .js/.jsx files

## Architecture Overview

This is an OpenAI Realtime API console application that demonstrates WebRTC integration for real-time voice and text communication with OpenAI's realtime models.

### Server Architecture (`server.js`)
- **Express + Vite SSR**: Uses Express with Vite middleware for development and SSR rendering
- **WebRTC Proxy**: Acts as a proxy between client and OpenAI's realtime API via WebRTC
- **API Endpoints**:
  - `/token` - Generates ephemeral tokens for OpenAI Realtime API authentication
  - `/session` - Handles SDP negotiation for WebRTC connections
- **Session Configuration**: Hardcoded to use `gpt-realtime` model with "marin" voice output

### Client Architecture (`client/`)
- **React SPA**: Vite-based React application with SSR support
- **Component Structure**:
  - `App.jsx` - Main application component handling WebRTC connection logic
  - `SessionControls.jsx` - Start/stop session controls and text input
  - `ToolPanel.jsx` - Function calling examples (color palette demo)
  - `EventLog.jsx` - Real-time event logging for debugging
- **WebRTC Integration**: Direct browser-to-OpenAI WebRTC data channel communication
- **Real-time Events**: Handles bidirectional event streaming via WebRTC data channels

### Key Technical Details

**WebRTC Flow**:
1. Client requests ephemeral token from `/token` endpoint
2. Creates RTCPeerConnection with audio tracks and data channel
3. Performs SDP offer/answer exchange via OpenAI's realtime API
4. Establishes direct WebRTC connection for audio and event data

**Event System**:
- Events flow through WebRTC data channel as JSON messages
- Client events: `conversation.item.create`, `response.create`, `session.update`
- Server events logged and displayed in real-time event log
- Function calling demonstrated with `display_color_palette` tool

**Audio Handling**:
- Browser microphone input via `getUserMedia()`
- OpenAI model audio output played directly through WebRTC audio tracks
- No intermediate audio processing on server

## Environment Setup

Required environment variables in `.env`:
- `OPENAI_API_KEY` - OpenAI API key for realtime API access
- `PORT` - Optional, defaults to 3000

## Development Notes

- Uses ES modules (`"type": "module"` in package.json)
- Vite root set to `client/` directory
- No testing framework currently configured
- PostCSS with Tailwind CSS for styling
- React Router for client-side routing (minimal usage)