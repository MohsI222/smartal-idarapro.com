import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function checkTableColumns() {
  try {
    console.log('🔍 Checking columns in key tables for tenant isolation...\n');
    
    const tables = ['inventory_products', 'hr_employees', 'hr_absence_records', 'shift_reports', 'auto_real_estate', 'orders'];
    
    for (const table of tables) {
      console.log(`📋 Table: ${table}`);
      
      const { rows: columns } = await pool.query(
        `SELECT column_name, data_type, is_nullable 
         FROM information_schema.columns 
         WHERE table_name = $1 
         AND table_schema = 'public'
         ORDER BY ordinal_position`,
        [table]
      );
      
      columns.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type} (${col.is_nullable})`);
      });
      
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkTableColumns();
