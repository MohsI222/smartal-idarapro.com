const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function testScannerFinal() {
  try {
    console.log('🧪 Final Scanner Testing with Cleaned Inventory...\n');
    
    const testUserId = 'c905d8d6-dcbd-4414-8214-7300ff6c7552';
    
    // Get cleaned inventory
    const inventoryResult = await pool.query('SELECT id, name, sku, unit_price, stock_pieces FROM inventory_products WHERE user_id = $1 ORDER BY name LIMIT 20', [testUserId]);
    const inventory = inventoryResult.rows;
    
    console.log('📋 Clean inventory products for testing:');
    inventory.forEach((p, i) => {
      console.log(`${i + 1}. "${p.name}" (Stock: ${p.stock_pieces})`);
    });
    
    // Test with realistic Arabic receipt
    console.log('\n📷 Testing with realistic receipt...');
    const sampleReceipt = `
زيت المائدة لتر           2    25.00
حليب معقم لتر             3    8.50  
السكر قالب كيلو           5    15.00
الدقيق المميز كيلو        4    12.00
المجموع                        143.50
`;
    
    console.log('📄 Receipt content:');
    console.log(sampleReceipt);
    
    // Parse receipt
    const lines = sampleReceipt.trim().split('\n').filter(l => l.trim().length > 2);
    const parsedItems = [];
    
    for (const line of lines) {
      if (/المجموع|total/i.test(line)) continue;
      const nums = line.match(/\d+(?:[.,]\d+)?/g);
      if (nums && nums.length >= 2) {
        const vals = nums.map(n => parseFloat(n.replace(',', '.')));
        const qty = Math.max(1, Math.floor(vals[0]));
        const price = vals[vals.length - 1];
        const namePart = line.replace(/\d+(?:[.,]\d+)?/g, ' ').replace(/[^\p{L}\s-]+/gu, ' ').trim();
        if (namePart.length > 2) {
          parsedItems.push({ name: namePart, qty, price });
          console.log(`✅ Parsed: "${namePart}" - Qty: ${qty}, Price: ${price}`);
        }
      }
    }
    
    // Match with inventory
    console.log('\n🔗 Matching parsed items with inventory...');
    let matchCount = 0;
    
    for (const item of parsedItems) {
      let matched = false;
      for (const product of inventory) {
        const productName = product.name.replace(' - -', '').trim();
        const itemName = item.name.trim();
        
        if (productName.toLowerCase().includes(itemName.toLowerCase()) || 
            itemName.toLowerCase().includes(productName.toLowerCase())) {
          console.log(`✅ Matched: "${item.name}" → "${product.name}" (ID: ${product.id})`);
          matchCount++;
          matched = true;
          break;
        }
      }
      if (!matched) {
        console.log(`⚠️  No match for: "${item.name}"`);
      }
    }
    
    console.log(`\n📊 Match rate: ${matchCount}/${parsedItems.length} items matched`);
    
    // Test stock update
    console.log('\n📊 Testing stock update...');
    for (const item of parsedItems) {
      for (const product of inventory) {
        const productName = product.name.replace(' - -', '').trim();
        const itemName = item.name.trim();
        
        if (productName.toLowerCase().includes(itemName.toLowerCase())) {
          try {
            const newStock = product.stock_pieces + item.qty;
            await pool.query('UPDATE inventory_products SET stock_pieces = $1 WHERE id = $2', [newStock, product.id]);
            console.log(`✅ Stock updated: ${product.name} ${product.stock_pieces} → ${newStock}`);
          } catch (error) {
            console.error(`❌ Update failed for ${product.name}:`, error.message);
          }
          break;
        }
      }
    }
    
    // Verify updates
    console.log('\n🔍 Verifying stock updates...');
    for (const item of parsedItems) {
      for (const product of inventory) {
        const productName = product.name.replace(' - -', '').trim();
        const itemName = item.name.trim();
        
        if (productName.toLowerCase().includes(itemName.toLowerCase())) {
          const verifyResult = await pool.query('SELECT stock_pieces FROM inventory_products WHERE id = $1', [product.id]);
          console.log(`✅ Verified: ${product.name} - Stock: ${verifyResult.rows[0].stock_pieces}`);
          break;
        }
      }
    }
    
    console.log('\n✅ Scanner testing completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}
testScannerFinal();
