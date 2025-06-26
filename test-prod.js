#!/usr/bin/env node

import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

console.log('Testing production server...');

// Start the production server
const server = spawn('npm', ['start'], {
  stdio: 'pipe',
  env: { ...process.env, NODE_ENV: 'production' }
});

// Wait for server to start
await setTimeout(3000);

// Check if server is running
const { execSync } = await import('child_process');
try {
  const result = execSync('netstat -an | findstr :5001', { encoding: 'utf8' });
  console.log('Server is running on port 5001');
  console.log('Netstat output:', result);
} catch (error) {
  console.error('Server not running:', error.message);
}

// Kill the server
server.kill();
console.log('Test completed'); 