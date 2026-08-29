/**
 * Check RLS status on HR tables
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

async function checkRLS() {
  const client = await pool.connect();
  try {
    console.log('\n=== RLS Status on HR Tables ===\n');
    const result = await client.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN ('hr_employees', 'hr_absence_records')
    `);
    
    console.table(result.rows);
    
    if (result.rows[0].rowsecurity === false || result.rows[1].rowsecurity === false) {
      console.log('\n⚠ RLS is still disabled on one or both tables!');
    } else {
      console.log('\n✓ RLS is enabled on both tables');
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
  }
  
  await pool.end();
}

checkRLS().catch(console.error);
