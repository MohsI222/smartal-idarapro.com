#!/usr/bin/env node

/**
 * Check HR Employees Schema
 * This script checks the schema of hr_employees table
 */

const { Pool } = require('pg');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('Error: DATABASE_URL must be set in .env.local');
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

async function checkSchema() {
  const client = await pool.connect();
  
  console.log('='.repeat(60));
  console.log('Checking HR Employees Schema');
  console.log('='.repeat(60));
  
  try {
    // Get table columns
    const columnsResult = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'hr_employees'
      ORDER BY ordinal_position
    `);
    
    console.log('\n--- hr_employees Columns ---');
    if (columnsResult.rows.length === 0) {
      console.log('No columns found');
    } else {
      columnsResult.rows.forEach(row => {
        console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
      });
    }
    
    // Show sample employees with correct columns
    console.log('\n--- Sample Employees ---');
    const sampleResult = await client.query(`
      SELECT * 
      FROM public.hr_employees 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    if (sampleResult.rows.length === 0) {
      console.log('No employees found');
    } else {
      sampleResult.rows.forEach(row => {
        console.log(`ID: ${row.id}`);
        console.log(`  User ID: ${row.user_id || 'NULL'}`);
        console.log(`  Created: ${row.created_at}`);
        console.log('');
      });
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

checkSchema().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
