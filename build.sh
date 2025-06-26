#!/bin/bash

echo "Starting build process..."

# Set environment
export NODE_ENV=production
echo "NODE_ENV: $NODE_ENV"

# Install dependencies
echo "Installing dependencies..."
npm install

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