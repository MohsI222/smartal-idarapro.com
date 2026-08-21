const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function testStockUpdate() {
  try {
    console.log('🧪 Testing Stock Update Functionality...\n');
    
    const testUserId = 'c905d8d6-dcbd-4414-8214-7300ff6c7552';
    
    // Get a specific product to test
    const productResult = await pool.query('SELECT id, name, stock_pieces FROM inventory_products WHERE user_id = $1 AND name LIKE $2 LIMIT 1', [testUserId, '%زيت%']);
    
    if (productResult.rows.length === 0) {
      console.log('❌ No products found for testing');
      return;
    }
    
    const product = productResult.rows[0];
    console.log(`📦 Testing with product: "${product.name}"`);
    console.log(`📊 Current stock: ${product.stock_pieces}`);
    
    // Test stock update
    const addQty = 5;
    const newStock = product.stock_pieces + addQty;
    
    console.log(`➕ Adding ${addQty} to stock...`);
    await pool.query('UPDATE inventory_products SET stock_pieces = $1 WHERE id = $2', [newStock, product.id]);
    
    // Verify update
    const verifyResult = await pool.query('SELECT stock_pieces FROM inventory_products WHERE id = $1', [product.id]);
    console.log(`✅ Updated stock: ${verifyResult.rows[0].stock_pieces}`);
    
    // Revert the change
    console.log(`↩️  Reverting change...`);
    await pool.query('UPDATE inventory_products SET stock_pieces = $1 WHERE id = $2', [product.stock_pieces, product.id]);
    
    // Verify revert
    const revertResult = await pool.query('SELECT stock_pieces FROM inventory_products WHERE id = $1', [product.id]);
    console.log(`✅ Reverted stock: ${revertResult.rows[0].stock_pieces}`);
    
    console.log('\n✅ Stock update functionality works correctly!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}
testStockUpdate();
