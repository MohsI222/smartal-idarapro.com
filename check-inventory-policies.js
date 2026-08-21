import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function checkInventoryPolicies() {
  try {
    console.log('🔍 Checking inventory_products RLS policies for import/export access...\n');
    
    const { rows: policies } = await pool.query(
      `SELECT policyname, cmd, roles, qual, with_check 
       FROM pg_policies 
       WHERE tablename = 'inventory_products' AND schemaname = 'public'`
    );
    
    console.log('Current policies:');
    policies.forEach(p => {
      console.log(`\n📋 ${p.policyname}`);
      console.log(`   Command: ${p.cmd}`);
      console.log(`   Roles: ${p.roles}`);
      if (p.qual) console.log(`   USING: ${p.qual}`);
      if (p.with_check) console.log(`   WITH CHECK: ${p.with_check}`);
    });
    
    console.log('\n✅ Inventory policies checked');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkInventoryPolicies();
