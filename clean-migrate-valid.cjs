const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function cleanMigrateValid() {
  try {
    console.log('🧹 Cleaning and migrating only valid products...\n');
    
    const testUserId = 'c905d8d6-dcbd-4414-8214-7300ff6c7552';
    
    // Clean up existing inventory_products
    console.log('🗑️  Cleaning up existing inventory_products...');
    await pool.query('DELETE FROM inventory_products WHERE user_id = $1', [testUserId]);
    console.log('✅ Cleaned up existing products');
    
    // Get only valid products from original table
    const allProducts = await pool.query('SELECT * FROM products');
    console.log(`📋 Total products in original table: ${allProducts.rows.length}`);
    
    // Filter valid products
    const validProducts = [];
    for (const product of allProducts.rows) {
      const name = product.name?.trim() || '';
      // Skip corrupted names
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(name) || 
          name === '- -' || 
          name === '' ||
          name.length < 3 ||
          name.startsWith('5454') ||
          name.startsWith('Barcode') ||
          name.startsWith('MATIAR') ||
          name.startsWith('PIASSE') ||
          name.includes('STK-') ||
          name.includes('ece b')) {
        continue;
      }
      validProducts.push(product);
    }
    
    console.log(`✅ Valid products: ${validProducts.length}`);
    console.log(`❌ Corrupted products: ${allProducts.rows.length - validProducts.length}`);
    
    // Show sample valid products
    console.log('\n📋 Sample valid products:');
    validProducts.slice(0, 15).forEach((p, i) => {
      console.log(`${i + 1}. "${p.name}"`);
    });
    
    // Migrate only valid products
    console.log('\n🔄 Migrating valid products...');
    let migrated = 0;
    for (const product of validProducts) {
      const productId = product.id?.toString() || `STK-${Math.random().toString(36).substring(2, 12)}`;
      const userId = product.user_id || testUserId;
      
      await pool.query(`
        INSERT INTO inventory_products (id, user_id, name, sku, retail_type, pieces_per_carton, unit_price, stock_pieces, created_at, unit_kind, cost_price, expiry_date, low_stock_alert)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        productId,
        userId,
        product.name,
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
      if (migrated <= 20) {
        console.log(`Migrated: ${product.name}`);
      }
    }
    
    console.log(`\n✅ Successfully migrated ${migrated} valid products`);
    
    // Verify migration
    console.log('\n🔍 Verifying migration:');
    const verifyResult = await pool.query('SELECT name, sku, stock_pieces FROM inventory_products WHERE user_id = $1 ORDER BY name LIMIT 20', [testUserId]);
    verifyResult.rows.forEach((p, i) => {
      console.log(`${i + 1}. "${p.name}" (Stock: ${p.stock_pieces})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}
cleanMigrateValid();
