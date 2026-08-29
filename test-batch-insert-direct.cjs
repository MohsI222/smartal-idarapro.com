const { randomUUID } = require('crypto');
const { db } = require('./server/db.ts');

async function testBatchInsert() {
  try {
    const userId = 'c905d8d6-dcbd-4414-8214-7300ff6c7552';
    console.log('[Test] Starting batch insert for user:', userId);
    
    const insertedIds = [];
    const errors = [];
    
    for (let i = 1; i <= 35; i++) {
      try {
        const id = randomUUID();
        const sku = `SKU-${Date.now()}-${i}-${randomUUID().slice(0, 8)}`;
        const name = `Product ${i}`;
        
        await db.prepare(
          `INSERT INTO inventory_products (id, user_id, name, sku, retail_type, pieces_per_carton, unit_price, stock_pieces, unit_kind, cost_price, low_stock_alert, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`
        ).run(
          id,
          userId,
          name,
          sku,
          'retail',
          1,
          i * 10,
          i * 5,
          'piece',
          i * 5,
          10
        );
        
        insertedIds.push(id);
        console.log(`[Test] Inserted product ${i}: ${id} - ${name} (${sku})`);
      } catch (err) {
        console.error(`[Test] Error inserting product ${i}:`, err.message);
        errors.push({ index: i, error: err.message });
      }
    }
    
    console.log(`[Test] Completed. Inserted: ${insertedIds.length}, Errors: ${errors.length}`);
    
    // Verify by counting products for this user
    const countResult = await db.prepare(`SELECT COUNT(*)::int as c FROM inventory_products WHERE user_id = ?`).get(userId);
    console.log(`[Test] Total products for user ${userId} after insert: ${countResult.c}`);
    
    // Fetch all products for this user
    const products = await db.prepare(`SELECT * FROM inventory_products WHERE user_id = ? ORDER BY created_at DESC`).all(userId);
    console.log(`[Test] Fetched ${products.length} products from database`);
    console.log('[Test] Sample products:', products.slice(0, 3).map(p => ({ id: p.id, name: p.name, sku: p.sku })));
    
    process.exit(0);
  } catch (error) {
    console.error('[Test] Fatal error:', error);
    process.exit(1);
  }
}

testBatchInsert();
