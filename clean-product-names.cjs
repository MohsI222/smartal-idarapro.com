const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function cleanProductNames() {
  try {
    console.log('🧹 Cleaning product names...\n');
    
    // Get products with "- -" suffix
    const dirtyProducts = await pool.query("SELECT id, name FROM inventory_products WHERE name LIKE '% - -'");
    console.log(`📋 Found ${dirtyProducts.rows.length} products with dirty names`);
    
    let cleaned = 0;
    for (const product of dirtyProducts.rows) {
      const cleanName = product.name.replace(' - -', '').trim();
      if (cleanName !== product.name && cleanName.length > 2) {
        await pool.query('UPDATE inventory_products SET name = $1 WHERE id = $2', [cleanName, product.id]);
        console.log(`✅ Cleaned: "${product.name}" → "${cleanName}"`);
        cleaned++;
      }
    }
    
    console.log(`\n📊 Cleaned ${cleaned} product names`);
    
    // Show sample cleaned products
    const sampleResult = await pool.query('SELECT name FROM inventory_products ORDER BY name LIMIT 10');
    console.log('\n📋 Sample products after cleaning:');
    sampleResult.rows.forEach((p, i) => {
      console.log(`${i + 1}. "${p.name}"`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}
cleanProductNames();
