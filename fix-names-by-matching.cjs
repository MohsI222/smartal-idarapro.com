const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixNamesByMatching() {
  try {
    console.log('🔧 Fixing Arabic names by matching product names...\n');
    
    const testUserId = 'c905d8d6-dcbd-4414-8214-7300ff6c7552';
    
    // Get original products with proper Arabic names
    const originalProducts = await pool.query('SELECT name FROM products WHERE name IS NOT NULL');
    console.log(`📋 Found ${originalProducts.rows.length} products in original table`);
    
    // Get inventory products that need fixing
    const inventoryProducts = await pool.query('SELECT id, name FROM inventory_products WHERE user_id = $1', [testUserId]);
    console.log(`📋 Found ${inventoryProducts.rows.length} products in inventory table`);
    
    let fixedCount = 0;
    
    // Match by name similarity
    for (const invProduct of inventoryProducts.rows) {
      const invName = invProduct.name.replace(' - -', '').trim().toLowerCase();
      
      // Skip if already looks good
      if (invName.length > 5 && !invName.startsWith('-') && !/^[0-9a-f]{8}-/.test(invName)) {
        continue;
      }
      
      // Find matching original product
      for (const origProduct of originalProducts.rows) {
        const origName = origProduct.name.trim().toLowerCase();
        
        // Check for similarity
        if (origName.includes(invName) || invName.includes(origName) || 
            (invName.length > 3 && origName.includes(invName.substring(0, 3)))) {
          
          // Update the inventory product name
          await pool.query('UPDATE inventory_products SET name = $1 WHERE id = $2', [origProduct.name, invProduct.id]);
          console.log(`✅ Fixed: "${invProduct.name}" → "${origProduct.name}"`);
          fixedCount++;
          break;
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
fixNamesByMatching();
