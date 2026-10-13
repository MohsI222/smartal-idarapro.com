import pg from 'pg';

const url = 'postgresql://postgres.ihteylplpdtxdpqxafrq:smartalidara2026@aws-1-eu-west-3.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=no-verify';

async function checkWorkers() {
  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
    const result = await client.query('SELECT COUNT(*) as count FROM tl_workers');
    console.log('📊 tl_workers count:', result.rows[0].count);
    
    if (parseInt(result.rows[0].count) === 0) {
      console.log('⚠️  tl_workers table is empty in Supabase');
      console.log('✅ You need to create workers manually or migrate from Neon');
    } else {
      const workers = await client.query('SELECT * FROM tl_workers LIMIT 5');
      console.log('👥 Sample workers:', workers.rows);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

checkWorkers();
