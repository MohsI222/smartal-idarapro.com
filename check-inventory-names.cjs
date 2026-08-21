const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkInventoryNames() {
  try {
    console.log('📦 Checking actual inventory product names...\n');
    
    const testUserId = 'c905d8d6-dcbd-4414-8214-7300ff6c7552';
    const result = await pool.query('SELECT name, sku FROM inventory_products WHERE user_id = $1 ORDER BY name LIMIT 20', [testUserId]);
    
    console.log('📋 Sample inventory products:');
    result.rows.forEach((p, i) => {
      console.log(`${i + 1}. "${p.name}" (SKU: ${p.sku || 'N/A'})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}
checkInventoryNames();
