#!/usr/bin/env node

/**
 * Check HR Employees Data
 * This script checks if hr_employees have user_id set correctly
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

async function checkEmployees() {
  const client = await pool.connect();
  
  console.log('='.repeat(60));
  console.log('Checking HR Employees Data');
  console.log('='.repeat(60));
  
  try {
    // Check total employees
    const totalResult = await client.query('SELECT COUNT(*) as count FROM public.hr_employees');
    console.log(`\nTotal employees: ${totalResult.rows[0].count}`);
    
    // Check employees with user_id
    const withUserIdResult = await client.query('SELECT COUNT(*) as count FROM public.hr_employees WHERE user_id IS NOT NULL');
    console.log(`Employees with user_id: ${withUserIdResult.rows[0].count}`);
    
    // Check employees without user_id
    const withoutUserIdResult = await client.query('SELECT COUNT(*) as count FROM public.hr_employees WHERE user_id IS NULL');
    console.log(`Employees without user_id: ${withoutUserIdResult.rows[0].count}`);
    
    // Show sample employees
    console.log('\n--- Sample Employees ---');
    const sampleResult = await client.query(`
      SELECT id, full_name, employee_id, user_id, created_at 
      FROM public.hr_employees 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    if (sampleResult.rows.length === 0) {
      console.log('No employees found');
    } else {
      sampleResult.rows.forEach(row => {
        console.log(`ID: ${row.id}`);
        console.log(`  Name: ${row.full_name || 'N/A'}`);
        console.log(`  Employee ID: ${row.employee_id || 'N/A'}`);
        console.log(`  User ID: ${row.user_id || 'NULL'}`);
        console.log(`  Created: ${row.created_at}`);
        console.log('');
      });
    }
    
    // Check absence records
    console.log('\n--- Absence Records ---');
    const absenceResult = await client.query('SELECT COUNT(*) as count FROM public.hr_absence_records');
    console.log(`Total absence records: ${absenceResult.rows[0].count}`);
    
    const absenceWithUserId = await client.query('SELECT COUNT(*) as count FROM public.hr_absence_records WHERE user_id IS NOT NULL');
    console.log(`Absence records with user_id: ${absenceWithUserId.rows[0].count}`);
    
  } finally {
    client.release();
    await pool.end();
  }
}

checkEmployees().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
