const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkEncoding() {
  try {
    console.log('🔍 Checking Arabic text encoding in different tables...\n');
    
    // Check original products table
    console.log('📋 Original products table:');
    const productsResult = await pool.query('SELECT name FROM products WHERE name IS NOT NULL LIMIT 10');
    productsResult.rows.forEach((p, i) => {
      console.log(`${i + 1}. "${p.name}"`);
    });
    
    // Check inventory_products table
    console.log('\n📋 Inventory products table:');
    const inventoryResult = await pool.query('SELECT name FROM inventory_products WHERE name IS NOT NULL LIMIT 10');
    inventoryResult.rows.forEach((p, i) => {
      console.log(`${i + 1}. "${p.name}"`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}
checkEncoding();
