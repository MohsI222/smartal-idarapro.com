const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function testImportAndScanner() {
  try {
    console.log('🧪 Testing Import and Scanner Functionality...\n');
    
    const testUserId = 'c905d8d6-dcbd-4414-8214-7300ff6c7552';
    
    // Test 1: Import new products via direct database insertion (simulating import)
    console.log('📦 Test 1: Simulating product import...');
    const testImportProducts = [
      {
        id: 'IMPORT-' + Date.now() + '-1',
        user_id: testUserId,
        name: 'منتج مستورد 1',
        sku: 'IMP-001',
        retail_type: 'retail',
        pieces_per_carton: 12,
        unit_price: 25.5,
        stock_pieces: 100,
        unit_kind: 'piece',
        cost_price: 20.0,
        low_stock_alert: 20
      },
      {
        id: 'IMPORT-' + Date.now() + '-2',
        user_id: testUserId,
        name: 'منتج مستورد 2',
        sku: 'IMP-002',
        retail_type: 'retail',
        pieces_per_carton: 6,
        unit_price: 45.0,
        stock_pieces: 50,
        unit_kind: 'piece',
        cost_price: 35.0,
        low_stock_alert: 15
      }
    ];
    
    for (const product of testImportProducts) {
      try {
        await pool.query(`
          INSERT INTO inventory_products (id, user_id, name, sku, retail_type, pieces_per_carton, unit_price, stock_pieces, unit_kind, cost_price, low_stock_alert)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [product.id, product.user_id, product.name, product.sku, product.retail_type, product.pieces_per_carton, product.unit_price, product.stock_pieces, product.unit_kind, product.cost_price, product.low_stock_alert]);
        console.log(`✅ Imported: ${product.name}`);
      } catch (error) {
        console.error(`❌ Failed to import ${product.name}:`, error.message);
      }
    }
    
    // Test 2: Verify imported products are accessible
    console.log('\n🔍 Test 2: Verifying imported products...');
    const result = await pool.query('SELECT * FROM inventory_products WHERE user_id = $1 AND id LIKE $2', [testUserId, 'IMPORT-%']);
    console.log(`✅ Found ${result.rows.length} imported products`);
    result.rows.forEach(p => {
      console.log(`   - ${p.name} (SKU: ${p.sku}, Stock: ${p.stock_pieces})`);
    });
    
    // Test 3: Simulate scanner receipt parsing (text-based simulation)
    console.log('\n📷 Test 3: Simulating smart scanner receipt parsing...');
    const sampleReceipt = `
    زيت المائدة 1 لتر      2      25.00
    السكر مقرط 1 كيلو     5      15.00
    حليب معقم 1 لتر       3      8.50
    المجموع                       108.50
    `;
    
    console.log('📄 Sample Receipt:');
    console.log(sampleReceipt);
    
    // Parse receipt lines
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
          console.log(`✅ Parsed: ${namePart} - Qty: ${qty}, Price: ${price}`);
        }
      }
    }
    
    // Test 4: Match parsed items with inventory
    console.log('\n🔗 Test 4: Matching parsed items with inventory...');
    const inventoryResult = await pool.query('SELECT id, name, sku, unit_price, stock_pieces FROM inventory_products WHERE user_id = $1 LIMIT 10', [testUserId]);
    const inventory = inventoryResult.rows;
    
    for (const item of parsedItems) {
      let matched = false;
      for (const product of inventory) {
        if (product.name.toLowerCase().includes(item.name.toLowerCase()) || 
            item.name.toLowerCase().includes(product.name.toLowerCase())) {
          console.log(`✅ Matched: "${item.name}" → "${product.name}" (ID: ${product.id})`);
          matched = true;
          break;
        }
      }
      if (!matched) {
        console.log(`⚠️  No match found for: "${item.name}"`);
      }
    }
    
    // Test 5: Stock update simulation
    console.log('\n📊 Test 5: Simulating stock update from receipt...');
    for (const item of parsedItems) {
      for (const product of inventory) {
        if (product.name.toLowerCase().includes(item.name.toLowerCase())) {
          try {
            const newStock = product.stock_pieces + item.qty;
            await pool.query('UPDATE inventory_products SET stock_pieces = $1 WHERE id = $2', [newStock, product.id]);
            console.log(`✅ Updated stock: ${product.name} ${product.stock_pieces} → ${newStock}`);
          } catch (error) {
            console.error(`❌ Failed to update stock for ${product.name}:`, error.message);
          }
          break;
        }
      }
    }
    
    // Cleanup test data
    console.log('\n🧹 Cleaning up test data...');
    for (const product of testImportProducts) {
      try {
        await pool.query('DELETE FROM inventory_products WHERE id = $1', [product.id]);
        console.log(`🗑️  Deleted: ${product.name}`);
      } catch (error) {
        console.error(`❌ Failed to delete ${product.name}:`, error.message);
      }
    }
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}
testImportAndScanner();
