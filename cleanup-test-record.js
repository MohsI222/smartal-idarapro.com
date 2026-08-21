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

async function cleanup() {
  try {
    console.log('🧹 Cleaning up test records...\n');
    
    const result = await pool.query(`
      DELETE FROM public.auto_real_estate 
      WHERE brand_or_title = 'Test Connection'
      RETURNING id
    `);
    
    console.log('✅ Deleted test records:', result.rows.length);
    if (result.rows.length > 0) {
      result.rows.forEach(row => console.log('   ID:', row.id));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

cleanup();
