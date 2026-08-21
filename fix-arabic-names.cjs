const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixArabicNames() {
  try {
    console.log('🔧 Fixing Arabic product names in inventory_products...\n');
    
    const testUserId = 'c905d8d6-dcbd-4414-8214-7300ff6c7552';
    
    // Get original products with proper Arabic names
    const originalProducts = await pool.query('SELECT * FROM products');
    console.log(`📋 Found ${originalProducts.rows.length} products in original table`);
    
    // Update inventory_products with correct names from original products
    let fixedCount = 0;
    for (const product of originalProducts.rows) {
      const productId = product.id?.toString();
      if (!productId) continue;
      
      // Check if this product exists in inventory_products
      const existingResult = await pool.query('SELECT id, name FROM inventory_products WHERE id = $1', [productId]);
      if (existingResult.rows.length > 0) {
        const currentName = existingResult.rows[0].name;
        const originalName = product.name;
        
        // Only update if the name is corrupted
        if (currentName !== originalName && (currentName.includes('- -') || currentName.length < originalName.length)) {
          await pool.query('UPDATE inventory_products SET name = $1 WHERE id = $2', [originalName, productId]);
          console.log(`✅ Fixed: "${currentName}" → "${originalName}"`);
          fixedCount++;
        }
      }
    }
    
    console.log(`\n📊 Fixed ${fixedCount} product names`);
    
    // Verify the fixes
    console.log('\n🔍 Verifying fixed names:');
    const verifyResult = await pool.query('SELECT name FROM inventory_products WHERE user_id = $1 ORDER BY name LIMIT 15', [testUserId]);
    verifyResult.rows.forEach((p, i) => {
      console.log(`${i + 1}. "${p.name}"`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}
fixArabicNames();
