import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function enableRLS() {
  try {
    console.log('🔧 Enabling RLS on hr_employees...');
    
    await pool.query('ALTER TABLE public.hr_employees ENABLE ROW LEVEL SECURITY');
    
    console.log('✅ RLS enabled on hr_employees');
    
    // Verify
    const result = await pool.query(`
      SELECT tablename, relrowsecurity 
      FROM pg_tables t
      JOIN pg_class c ON c.relname = t.tablename
      WHERE t.schemaname = 'public' 
      AND t.tablename = 'hr_employees'
    `);
    
    console.log('🔒 RLS Status:', result.rows[0]);
    
  } catch (error) {
    console.error('❌ Error enabling RLS:', error.message);
  } finally {
    await pool.end();
  }
}

enableRLS();
