const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkOriginalData() {
  try {
    console.log('🔍 Checking original products table data quality...\n');
    
    // Get all products from original table
    const productsResult = await pool.query('SELECT id, name FROM products ORDER BY name');
    console.log(`📋 Total products: ${productsResult.rows.length}`);
    
    // Show first 20 products
    console.log('\n📋 First 20 products from original table:');
    productsResult.rows.slice(0, 20).forEach((p, i) => {
      console.log(`${i + 1}. ID: ${p.id?.substring(0, 8)}... Name: "${p.name}"`);
    });
    
    // Count corrupted vs valid names
    let corrupted = 0;
    let valid = 0;
    
    for (const product of productsResult.rows) {
      const name = product.name?.trim() || '';
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(name) || 
          name === '- -' || 
          name === '' ||
          name.length < 3) {
        corrupted++;
      } else {
        valid++;
      }
    }
    
    console.log(`\n📊 Data quality:`);
    console.log(`✅ Valid names: ${valid}`);
    console.log(`❌ Corrupted names: ${corrupted}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}
checkOriginalData();
