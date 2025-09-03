#!/bin/bash

echo "🚀 Setting up OpenAI Realtime Console Electron App..."

# Install main dependencies
echo "📦 Installing main dependencies..."
npm install

# Install remote server dependencies
echo "📦 Installing remote server dependencies..."
cd remote-server
npm install
cd ..

# Create environment files if they don't exist
echo "⚙️ Setting up environment files..."

if [ ! -f "remote-server/.env" ]; then
    echo "Creating remote-server/.env from example..."
    cp remote-server/.env.example remote-server/.env
    echo "⚠️  Please edit remote-server/.env with your OpenAI API key and other settings"
fi

if [ ! -f "client/.env" ]; then
    echo "Creating client/.env from example..."
    cp client.env.example client/.env
fi

echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Edit remote-server/.env with your OpenAI API key and MongoDB URI"
echo "2. Run: npm run dev"
echo ""
echo "🎯 Available commands:"
echo "  npm run dev     - Run server + client + electron app"
echo "  npm run build   - Build for production"
echo "  npm run dist    - Create distributable app"