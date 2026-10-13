import pg from 'pg';

const supabaseUrl = 'postgresql://postgres.ihteylplpdtxdpqxafrq:smartalidara2026@aws-1-eu-west-3.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=no-verify';
const schemaPath = '/Users/macbookair/smart-al-idara-pro/server/schema.sql';

async function initSupabase() {
  const client = new pg.Client({ connectionString: supabaseUrl });

  try {
    console.log('🔌 Connecting to Supabase...');
    await client.connect();
    console.log('✅ Connected to Supabase');

    console.log('📖 Reading schema.sql...');
    const fs = await import('fs');
    const schema = fs.default.readFileSync(schemaPath, 'utf8');

    console.log('🔄 Executing schema...');
    await client.query(schema);
    console.log('✅ Schema executed successfully');

    console.log('\n✅ Supabase database initialized!');
  } catch (error) {
    console.error('❌ Initialization failed:', error);
  } finally {
    await client.end();
  }
}

initSupabase();
