const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkTables() {
  try {
    // Check inventory_products
    const invResult = await pool.query('SELECT COUNT(*) as count FROM inventory_products');
    console.log('📦 inventory_products count:', invResult.rows[0].count);
    
    // Check if products table exists
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('products', 'stores', 'inventory_products')
    `);
    console.log('📋 Available tables:', tablesResult.rows.map(r => r.table_name));
    
    // Check stores table
    try {
      const storesResult = await pool.query('SELECT COUNT(*) as count FROM stores');
      console.log('🏪 stores count:', storesResult.rows[0].count);
    } catch (e) {
      console.log('🏪 stores table error:', e.message);
    }
    
    // Check products table
    try {
      const productsResult = await pool.query('SELECT COUNT(*) as count FROM products');
      console.log('🛒 products count:', productsResult.rows[0].count);
    } catch (e) {
      console.log('🛒 products table error:', e.message);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}
checkTables();
