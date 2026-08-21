const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function cleanCorruptedProducts() {
  try {
    console.log('🧹 Cleaning corrupted inventory products...\n');
    
    const testUserId = 'c905d8d6-dcbd-4414-8214-7300ff6c7552';
    
    // First, let's see what we have
    const allProducts = await pool.query('SELECT id, name FROM inventory_products WHERE user_id = $1', [testUserId]);
    console.log(`📊 Total products: ${allProducts.rows.length}`);
    
    // Identify corrupted products (UUIDs as names, "- -", etc.)
    const corruptedIds = [];
    const validProducts = [];
    
    for (const product of allProducts.rows) {
      const name = product.name.trim();
      // Check if name looks like a UUID or is invalid
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(name) || 
          name === '- -' || 
          name === '' ||
          name.length < 3) {
        corruptedIds.push(product.id);
      } else {
        validProducts.push(product);
      }
    }
    
    console.log(`❌ Corrupted products: ${corruptedIds.length}`);
    console.log(`✅ Valid products: ${validProducts.length}`);
    
    // Show some valid products
    console.log('\n📋 Sample valid products:');
    validProducts.slice(0, 10).forEach((p, i) => {
      console.log(`${i + 1}. "${p.name}"`);
    });
    
    // Delete corrupted products
    if (corruptedIds.length > 0) {
      console.log(`\n🗑️  Deleting ${corruptedIds.length} corrupted products...`);
      for (const id of corruptedIds) {
        try {
          await pool.query('DELETE FROM inventory_products WHERE id = $1', [id]);
        } catch (error) {
          console.error(`❌ Failed to delete ${id}:`, error.message);
        }
      }
      console.log('✅ Cleanup completed');
    }
    
    // Verify final state
    const finalCount = await pool.query('SELECT COUNT(*) as count FROM inventory_products WHERE user_id = $1', [testUserId]);
    console.log(`\n📊 Final product count: ${finalCount.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}
cleanCorruptedProducts();
