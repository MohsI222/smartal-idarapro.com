/**
 * Check current user role in users table
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

async function checkUserRole() {
  const client = await pool.connect();
  try {
    console.log('\n=== Users in public.users table ===\n');
    const result = await client.query(`
      SELECT id, email, role, created_at
      FROM public.users
      ORDER BY created_at DESC
    `);
    
    if (result.rows.length === 0) {
      console.log('No users found in public.users table');
    } else {
      console.table(result.rows);
    }
    
    console.log('\n=== Auth users ===\n');
    const result2 = await client.query(`
      SELECT id, email, created_at
      FROM auth.users
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    console.table(result2.rows);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
  }
  
  await pool.end();
}

checkUserRole().catch(console.error);
