import pg from 'pg';

const url = 'postgresql://postgres.ihteylplpdtxdpqxafrq:smartalidara2026@aws-1-eu-west-3.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=no-verify';

async function checkTokenAndWorkers() {
  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
    
    // Check the latest token
    const tokenResult = await client.query(`
      SELECT id, user_id, is_active, expires_at, token
      FROM pos_agent_tokens
      ORDER BY created_at DESC
      LIMIT 1
    `);
    
    if (tokenResult.rows.length === 0) {
      console.log('⚠️  No tokens found in pos_agent_tokens');
      return;
    }
    
    const token = tokenResult.rows[0];
    console.log('🔑 Latest token:', {
      id: token.id,
      user_id: token.user_id,
      is_active: token.is_active,
      expires_at: token.expires_at,
      token: token.token.substring(0, 20) + '...'
    });
    
    // Check workers for this user_id
    const workersResult = await client.query(`
      SELECT id, full_name, employee_id, department
      FROM tl_workers
      WHERE user_id = $1
      ORDER BY full_name ASC
    `, [token.user_id]);
    
    console.log(`\n👥 Workers for user_id ${token.user_id}:`, workersResult.rows.length);
    console.log('Workers:', workersResult.rows.map(w => ({
      name: w.full_name,
      employee_id: w.employee_id,
      department: w.department
    })));
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

checkTokenAndWorkers();
