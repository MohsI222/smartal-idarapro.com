require('dotenv').config();
const { Pool } = require('pg');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const DATABASE_URL = process.env.DATABASE_URL?.includes('localhost') 
  ? process.env.DATABASE_URL 
  : process.env.DIRECT_URL;

const pool = new Pool({ 
  connectionString: DATABASE_URL,
});

async function checkUserProducts() {
  try {
    console.log('[Check] Connecting to database...');
    const client = await pool.connect();
    
    const targetUserId = 'c905d8d6-dcbd-4414-8214-7300ff6c7552';
    console.log(`[Check] Checking products for user: ${targetUserId}`);
    
    // Count products for this user
    const countResult = await client.query(
      'SELECT COUNT(*)::int as c FROM inventory_products WHERE user_id = $1',
      [targetUserId]
    );
    console.log(`[Check] Total products for user ${targetUserId}: ${countResult.rows[0].c}`);
    
    // Fetch all products for this user
    const productsResult = await client.query(
      'SELECT id, name, sku, created_at FROM inventory_products WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10',
      [targetUserId]
    );
    console.log(`[Check] Sample products (${productsResult.rows.length}):`);
    productsResult.rows.forEach(p => {
      console.log(`  - ID: ${p.id}, Name: ${p.name}, SKU: ${p.sku}, Created: ${p.created_at}`);
    });
    
    // Check if there are any products at all in the database
    const totalResult = await client.query('SELECT COUNT(*)::int as c FROM inventory_products');
    console.log(`[Check] Total products in database: ${totalResult.rows[0].c}`);
    
    await client.release();
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('[Check] Error:', error.message);
    process.exit(1);
  }
}

checkUserProducts();
