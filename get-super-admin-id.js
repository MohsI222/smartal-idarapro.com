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

async function getSuperAdminId() {
  try {
    console.log('🔍 Getting super admin user ID...\n');
    
    const result = await pool.query(`
      SELECT id, email 
      FROM auth.users 
      WHERE email = 'lahcenm534@gmail.com'
      AND deleted_at IS NULL
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Super admin found:');
      console.log('   ID:', result.rows[0].id);
      console.log('   Email:', result.rows[0].email);
    } else {
      console.log('❌ Super admin not found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

getSuperAdminId();
