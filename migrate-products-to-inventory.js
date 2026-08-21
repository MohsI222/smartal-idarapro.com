import { Pool } from 'pg';
import 'dotenv/config';

// Disable SSL warnings for this migration script
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrateProducts() {
  try {
    // First, check if products table has user_id column
    const columnsResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'products'
      AND column_name = 'user_id'
    `);
    
    if (columnsResult.rows.length === 0) {
      console.log('Adding user_id column to products table...');
      await pool.query('ALTER TABLE products ADD COLUMN user_id TEXT');
    }
    
    // Get all products from old table
    const productsResult = await pool.query('SELECT * FROM products');
    console.log('Found', productsResult.rows.length, 'products in old table');
    
    // Insert into inventory_products
    let migrated = 0;
    for (const product of productsResult.rows) {
      const productId = product.id?.toString() || `STK-${Math.random().toString(36).substring(2, 12)}`;
      const userId = product.user_id || 'c905d8d6-dcbd-4414-8214-7300ff6c7552';
      
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
      console.log('Migrated:', product.name);
    }
    
    console.log('Successfully migrated', migrated, 'products');
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

migrateProducts();
