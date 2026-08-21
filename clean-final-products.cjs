const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function cleanFinalProducts() {
  try {
    console.log('🧹 Final cleanup of product names...\n');
    
    // Get all products
    const allProducts = await pool.query('SELECT id, name FROM inventory_products');
    console.log(`📋 Total products: ${allProducts.rows.length}`);
    
    let cleaned = 0;
    let deleted = 0;
    
    for (const product of allProducts.rows) {
      const name = product.name.trim();
      
      // Delete corrupted products
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(name) || 
          name === '- -' || 
          name === '' ||
          name.length < 3 ||
          /^[a-z]{3,4}$/.test(name) ||
          name.includes('Google') ||
          name.includes('Gemini') ||
          name.includes('Suno') ||
          name.includes('ElevenLabs') ||
          name.includes('Avril') ||
          name.includes('Juillet') ||
          name.includes('Tanger') ||
          name.includes('Marié') ||
          name.includes('Téléphone')) {
        
        await pool.query('DELETE FROM inventory_products WHERE id = $1', [product.id]);
        console.log(`🗑️  Deleted: "${name}"`);
        deleted++;
      } else if (name.endsWith(' - -')) {
        // Clean products with "- -" suffix
        const cleanName = name.replace(' - -', '').trim();
        if (cleanName !== name && cleanName.length > 2) {
          await pool.query('UPDATE inventory_products SET name = $1 WHERE id = $2', [cleanName, product.id]);
          console.log(`✅ Cleaned: "${name}" → "${cleanName}"`);
          cleaned++;
        }
      }
    }
    
    console.log(`\n📊 Cleaned ${cleaned} product names`);
    console.log(`📊 Deleted ${deleted} corrupted products`);
    
    // Show final sample
    const sampleResult = await pool.query('SELECT name FROM inventory_products ORDER BY name LIMIT 15');
    console.log('\n📋 Final sample products:');
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
cleanFinalProducts();
