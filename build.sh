#!/bin/bash

set -e  # Exit on any error

echo "Starting build process..."

# Set environment
export NODE_ENV=production
echo "NODE_ENV: $NODE_ENV"

# Clear any existing node_modules and package-lock.json to ensure clean install
echo "Cleaning existing dependencies..."
rm -rf node_modules package-lock.json

# Install dependencies explicitly
echo "Installing dependencies..."
npm install --production=false

# Verify vite is installed
echo "Verifying Vite installation..."
if ! npx vite --version; then
    echo "Vite not found after installation!"
    echo "Installed packages:"
    npm list vite
    exit 1
fi

# Build client
echo "Building client with Vite..."
npx vite build

# Build server
echo "Building server with esbuild..."
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# Verify build
if [ -d "dist/public" ]; then
    echo "Build completed successfully!"
    echo "Build files found at: dist/public"
    ls -la dist/public
else
    echo "Build failed - dist/public directory not found"
    exit 1
fi 