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

async function enablePermissions() {
  try {
    console.log('🔧 Enabling can_access_auto_real_estate for all users...');
    
    const result = await pool.query(`
      UPDATE permissions 
      SET can_access_auto_real_estate = true 
      WHERE can_access_auto_real_estate = false
    `);
    
    console.log(`✅ Updated ${result.rowCount} permission records`);
    console.log('🎉 All users now have access to Auto & Real Estate module');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

enablePermissions();
