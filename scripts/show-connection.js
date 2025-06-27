#!/usr/bin/env node

import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl) {
  console.log('📋 Copy this DATABASE_URL to Render:');
  console.log('');
  console.log(databaseUrl);
  console.log('');
  console.log('✅ This is your Neon connection string for production');
} else {
  console.log('❌ DATABASE_URL not found in .env file');
} 