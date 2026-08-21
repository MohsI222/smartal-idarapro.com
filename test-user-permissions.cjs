const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function testUserPermissions() {
  try {
    // Test with a sample user ID (the one used in migration)
    const testUserId = 'c905d8d6-dcbd-4414-8214-7300ff6c7552';
    
    console.log('🔍 Testing user permissions for inventory_products...');
    console.log('👤 Test User ID:', testUserId);
    
    // Check if user can insert
    try {
      const testProduct = {
        id: 'TEST-' + Date.now(),
        user_id: testUserId,
        name: 'منتج اختبار',
        sku: 'TEST-001',
        retail_type: 'retail',
        pieces_per_carton: 1,
        unit_price: 10.0,
        stock_pieces: 5,
        unit_kind: 'piece',
        cost_price: 8.0,
        low_stock_alert: 10
      };
      
      await pool.query(`
        INSERT INTO inventory_products (id, user_id, name, sku, retail_type, pieces_per_carton, unit_price, stock_pieces, unit_kind, cost_price, low_stock_alert)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [testProduct.id, testProduct.user_id, testProduct.name, testProduct.sku, testProduct.retail_type, testProduct.pieces_per_carton, testProduct.unit_price, testProduct.stock_pieces, testProduct.unit_kind, testProduct.cost_price, testProduct.low_stock_alert]);
      
      console.log('✅ User can INSERT products');
      
      // Clean up test product
      await pool.query('DELETE FROM inventory_products WHERE id = $1', [testProduct.id]);
      console.log('🧹 Cleaned up test product');
      
    } catch (error) {
      console.error('❌ INSERT permission error:', error.message);
    }
    
    // Check if user can select their own products
    try {
      const result = await pool.query('SELECT COUNT(*) as count FROM inventory_products WHERE user_id = $1', [testUserId]);
      console.log('✅ User can SELECT their products:', result.rows[0].count, 'products');
    } catch (error) {
      console.error('❌ SELECT permission error:', error.message);
    }
    
    // Check if user can update
    try {
      await pool.query('UPDATE inventory_products SET low_stock_alert = 15 WHERE user_id = $1 LIMIT 1', [testUserId]);
      console.log('✅ User can UPDATE products');
    } catch (error) {
      console.error('❌ UPDATE permission error:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}
testUserPermissions();
