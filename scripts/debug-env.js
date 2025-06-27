#!/usr/bin/env node

import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

console.log('🔍 Environment Variable Debug:');
console.log('');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.log('❌ DATABASE_URL is not set');
  console.log('');
  console.log('Please check your .env file and make sure it contains:');
  console.log('DATABASE_URL=postgresql://username:password@ep-something.region.aws.neon.tech/database?sslmode=require');
} else {
  console.log('✅ DATABASE_URL is set');
  console.log('');
  console.log('📋 DATABASE_URL value:');
  console.log(databaseUrl);
  console.log('');
  
  // Check if it starts with postgresql://
  if (!databaseUrl.startsWith('postgresql://')) {
    console.log('❌ DATABASE_URL should start with "postgresql://"');
  } else {
    console.log('✅ DATABASE_URL starts with "postgresql://"');
  }
  
  // Check if it contains sslmode=require
  if (!databaseUrl.includes('sslmode=require')) {
    console.log('❌ DATABASE_URL should include "?sslmode=require" at the end');
  } else {
    console.log('✅ DATABASE_URL includes "sslmode=require"');
  }
  
  // Check if it has the expected Neon format
  if (!databaseUrl.includes('ep-') && !databaseUrl.includes('.neon.tech')) {
    console.log('❌ DATABASE_URL should contain "ep-" and ".neon.tech" (Neon format)');
  } else {
    console.log('✅ DATABASE_URL appears to be in Neon format');
  }
}

console.log('');
console.log('📁 .env file location:');
console.log(process.cwd() + '/.env'); 