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

async function verifyForeignKeyDropped() {
  try {
    console.log('🔍 Verifying Foreign Key constraint is dropped...');
    
    const constraints = await pool.query(`
      SELECT
        conname as constraint_name,
        contype as constraint_type,
        pg_get_constraintdef(oid) as constraint_definition
      FROM pg_constraint
      WHERE conrelid = 'public.auto_real_estate'::regclass
      AND contype = 'f'
    `);
    
    if (constraints.rows.length === 0) {
      console.log('✅ No Foreign Key constraints found on auto_real_estate table');
      console.log('🎉 Foreign Key was successfully dropped');
    } else {
      console.log('❌ Foreign Key constraints still exist:');
      constraints.rows.forEach(row => {
        console.log(`   ${row.constraint_name}: ${row.constraint_definition}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

verifyForeignKeyDropped();
