import pg from 'pg';

const url = 'postgresql://postgres.ihteylplpdtxdpqxafrq:smartalidara2026@aws-1-eu-west-3.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=no-verify';

async function checkToken() {
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
      token: token.token.substring(0, 30) + '...'
    });
    
    // Check if expired
    if (new Date(token.expires_at) < new Date()) {
      console.log('❌ Token is EXPIRED!');
    } else {
      console.log('✅ Token is still valid');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

checkToken();
