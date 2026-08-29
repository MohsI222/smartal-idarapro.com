/**
 * Check current RLS policies on HR tables
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

require('dotenv').config({ path: '.env' });
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL not found in .env file');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL + '?sslmode=disable',
});

async function checkPolicies() {
  const client = await pool.connect();
  try {
    console.log('\n=== Current RLS Policies on hr_employees ===\n');
    const result1 = await client.query(`
      SELECT policyname, cmd, roles, qual, with_check
      FROM pg_policies 
      WHERE tablename = 'hr_employees' 
      AND schemaname = 'public'
      ORDER BY policyname
    `);
    
    if (result1.rows.length === 0) {
      console.log('No policies found on hr_employees');
    } else {
      console.table(result1.rows);
    }
    
    console.log('\n=== Current RLS Policies on hr_absence_records ===\n');
    const result2 = await client.query(`
      SELECT policyname, cmd, roles, qual, with_check
      FROM pg_policies 
      WHERE tablename = 'hr_absence_records' 
      AND schemaname = 'public'
      ORDER BY policyname
    `);
    
    if (result2.rows.length === 0) {
      console.log('No policies found on hr_absence_records');
    } else {
      console.table(result2.rows);
    }
    
    console.log('\n=== Table Grants ===\n');
    const result3 = await client.query(`
      SELECT table_name, grantee, privilege_type 
      FROM information_schema.role_table_grants 
      WHERE table_name IN ('hr_employees', 'hr_absence_records') 
      AND table_schema = 'public'
      ORDER BY table_name, grantee
    `);
    
    console.table(result3.rows);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
  }
  
  await pool.end();
}

checkPolicies().catch(console.error);
