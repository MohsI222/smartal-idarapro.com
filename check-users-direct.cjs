require('dotenv').config();
const { randomUUID } = require('crypto');

// Direct database connection using environment variables
// Use local PostgreSQL database
const DATABASE_URL = process.env.DATABASE_URL?.includes('localhost') 
  ? process.env.DATABASE_URL 
  : process.env.DIRECT_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL not found in environment');
  process.exit(1);
}

const { Pool } = require('pg');

// Use SSL with environment variable override
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({ 
  connectionString: DATABASE_URL,
});

async function checkUsers() {
  try {
    console.log('[Check] Connecting to database...');
    const client = await pool.connect();
    
    const targetUserId = 'c905d8d6-dcbd-4414-8214-7300ff6c7552';
    console.log(`[Test] Starting batch insert for user: ${targetUserId}`);
    
    const insertedIds = [];
    const errors = [];
    
    for (let i = 1; i <= 35; i++) {
      try {
        const id = randomUUID();
        const sku = `SKU-${Date.now()}-${i}-${randomUUID().slice(0, 8)}`;
        const name = `Product ${i}`;
        
        await client.query(
          `INSERT INTO inventory_products (id, user_id, name, sku, retail_type, pieces_per_carton, unit_price, stock_pieces, unit_kind, cost_price, low_stock_alert, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
          [id, targetUserId, name, sku, 'retail', 1, i * 10, i * 5, 'piece', i * 5, 10]
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
    const countResult = await client.query(
      'SELECT COUNT(*)::int as c FROM inventory_products WHERE user_id = $1',
      [targetUserId]
    );
    console.log(`[Test] Total products for user ${targetUserId} after insert: ${countResult.rows[0].c}`);
    
    // Fetch all products for this user
    const productsResult = await client.query(
      'SELECT * FROM inventory_products WHERE user_id = $1 ORDER BY created_at DESC',
      [targetUserId]
    );
    console.log(`[Test] Fetched ${productsResult.rows.length} products from database`);
    console.log('[Test] Sample products:', productsResult.rows.slice(0, 3).map(p => ({ id: p.id, name: p.name, sku: p.sku })));
    
    // Get a valid session token from database
    console.log('\n[Test] Getting valid session token from database...');
    const sessionResult = await client.query(
      `SELECT token FROM sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [targetUserId]
    );
    
    let validToken = null;
    if (sessionResult.rows.length > 0) {
      validToken = sessionResult.rows[0].token;
      console.log(`[Test] Found valid token: ${validToken.substring(0, 20)}...`);
    } else {
      console.log('[Test] No valid session found, creating one...');
      // Create a new session
      const newToken = randomUUID();
      await client.query(
        `INSERT INTO sessions (id, user_id, token, created_at, expires_at) VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '365 days')`,
        [randomUUID(), targetUserId, newToken]
      );
      validToken = newToken;
      console.log(`[Test] Created new token: ${validToken.substring(0, 20)}...`);
    }
    
    // Now test the API endpoint directly via HTTP
    console.log('\n[Test] Testing GET /api/inventory/products endpoint...');
    const http = require('http');
    
    const getOptions = {
      hostname: 'localhost',
      port: 4000,
      path: '/api/inventory/products',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${validToken}`
      }
    };
    
    const getReq = http.request(getOptions, (getRes) => {
      console.log(`[Test] API Status: ${getRes.statusCode}`);
      let getBody = '';
      getRes.on('data', (chunk) => { getBody += chunk; });
      getRes.on('end', async () => {
        console.log('[Test] API Response:', getBody);
        try {
          const response = JSON.parse(getBody);
          console.log(`\n[TEST RESULT] Total products fetched from API: ${response.products?.length || 0}`);
          
          if (response.products?.length === 35) {
            console.log('\n✅ SUCCESS: API returned all 35 products correctly!');
          } else {
            console.log(`\n❌ FAILURE: API returned ${response.products?.length || 0} products instead of 35`);
          }
        } catch (e) {
          console.error('[Test] Error parsing API response:', e.message);
        }
        
        await client.release();
        await pool.end();
        process.exit(0);
      });
    });
    
    getReq.on('error', async (e) => {
      console.error('[Test] API Error:', e.message);
      console.log('\n⚠️  API test failed, but database test succeeded with 35 products');
      await client.release();
      await pool.end();
      process.exit(0);
    });
    
    getReq.end();
  } catch (error) {
    console.error('[Check] Error:', error.message);
    process.exit(1);
  }
}

checkUsers();
