const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function reMigrateProducts() {
  try {
    console.log('🔄 Re-migrating products with proper Arabic names...\n');
    
    const testUserId = 'c905d8d6-dcbd-4414-8214-7300ff6c7552';
    
    // First, delete all inventory_products for this user
    console.log('🗑️  Cleaning up existing inventory_products...');
    await pool.query('DELETE FROM inventory_products WHERE user_id = $1', [testUserId]);
    console.log('✅ Cleaned up existing products');
    
    // Get all products from original table
    const productsResult = await pool.query('SELECT * FROM products');
    console.log(`📋 Found ${productsResult.rows.length} products in original table`);
    
    // Insert into inventory_products with proper names
    let migrated = 0;
    for (const product of productsResult.rows) {
      const productId = product.id?.toString() || `STK-${Math.random().toString(36).substring(2, 12)}`;
      const userId = product.user_id || testUserId;
      
      // Check if already exists
      const existsResult = await pool.query('SELECT id FROM inventory_products WHERE id = $1', [productId]);
      if (existsResult.rows.length > 0) {
        console.log('Skipping existing product:', productId);
        continue;
      }
      
      await pool.query(`
        INSERT INTO inventory_products (id, user_id, name, sku, retail_type, pieces_per_carton, unit_price, stock_pieces, created_at, unit_kind, cost_price, expiry_date, low_stock_alert)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        productId,
        userId,
        product.name, // Use the original Arabic name directly
        product.sku,
        product.retail_type || 'retail',
        product.pieces_per_carton || 1,
        product.unit_price || 0,
        product.stock_pieces || 0,
        product.created_at || new Date().toISOString(),
        product.unit_kind || 'piece',
        product.cost_price || 0,
        product.expiry_date?.toISOString() || null,
        product.low_stock_alert || 10
      ]);
      
      migrated++;
      console.log('Migrated:', product.name);
    }
    
    console.log('Successfully migrated', migrated, 'products');
    
    // Verify the migration
    console.log('\n🔍 Verifying migration:');
    const verifyResult = await pool.query('SELECT name, sku, stock_pieces FROM inventory_products WHERE user_id = $1 ORDER BY name LIMIT 15', [testUserId]);
    verifyResult.rows.forEach((p, i) => {
      console.log(`${i + 1}. "${p.name}" (SKU: ${p.sku || 'N/A'}, Stock: ${p.stock_pieces})`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}
reMigrateProducts();
