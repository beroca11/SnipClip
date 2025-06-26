#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('Starting deployment process...');

// Ensure NODE_ENV is set to production
process.env.NODE_ENV = 'production';

console.log(`NODE_ENV: ${process.env.NODE_ENV}`);

try {
  // Run the build process
  console.log('Running build process...');
  execSync('npm run build', { stdio: 'inherit' });
  
  // Check if build files exist
  const distPath = path.resolve(process.cwd(), 'dist', 'public');
  if (!fs.existsSync(distPath)) {
    throw new Error('Build files not found after build process');
  }
  
  console.log('Build completed successfully');
  console.log('Build files found at:', distPath);
  
  // List build files
  const files = fs.readdirSync(distPath);
  console.log('Build files:', files);
  
} catch (error) {
  console.error('Deployment failed:', error.message);
  process.exit(1);
} 