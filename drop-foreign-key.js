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

async function dropForeignKey() {
  try {
    console.log('🔧 Dropping Foreign Key constraint auto_real_estate_user_id_fkey...');
    
    await pool.query(`
      ALTER TABLE public.auto_real_estate
      DROP CONSTRAINT IF EXISTS auto_real_estate_user_id_fkey
    `);
    
    console.log('✅ Foreign Key constraint dropped successfully');
    console.log('🎉 auto_real_estate table no longer has Foreign Key constraint on user_id');
    
  } catch (error) {
    console.error('❌ Error dropping Foreign Key:', error.message);
  } finally {
    await pool.end();
  }
}

dropForeignKey();
