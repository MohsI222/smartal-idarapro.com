/**
 * Apply migrations directly to PostgreSQL database
 */

// Disable SSL verification for development
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

require('dotenv').config({ path: '.env' });
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL not found in .env file');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL + '?sslmode=disable',
});

async function applyMigration(sql, name) {
  console.log(`\nApplying migration: ${name}...`);
  
  const client = await pool.connect();
  try {
    // Execute the entire SQL as a single block
    await client.query(sql);
    
    console.log(`✓ Successfully applied: ${name}`);
    return true;
  } catch (err) {
    console.error(`Error applying ${name}:`, err.message);
    console.error('Full error:', err);
    return false;
  } finally {
    client.release();
  }
}

async function main() {
  console.log('Starting database migrations for LocalStorage fix...\n');
  
  const fs = require('fs');
  
  const migrations = [
    {
      name: 'inventory_activity_logs',
      file: './supabase/migrations/20260820000001_inventory_activity_logs.sql'
    },
    {
      name: 'exported_documents',
      file: './supabase/migrations/20260820000002_exported_documents.sql'
    }
  ];
  
  let successCount = 0;
  
  for (const migration of migrations) {
    try {
      const sql = fs.readFileSync(migration.file, 'utf8');
      const success = await applyMigration(sql, migration.name);
      if (success) successCount++;
    } catch (err) {
      console.error(`Failed to read migration file ${migration.file}:`, err);
    }
  }
  
  console.log(`\n=== Migration Summary ===`);
  console.log(`${successCount}/${migrations.length} applied successfully`);
  
  if (successCount === migrations.length) {
    console.log('\n✓ All migrations applied successfully!');
    console.log('\nNext steps:');
    console.log('1. The API endpoints are now ready in server/index.ts');
    console.log('2. Frontend components have been updated to use the API');
    console.log('3. Test the application to ensure data isolation works correctly');
  } else {
    console.log('\n⚠ Some migrations failed. Please check the errors above.');
  }
  
  await pool.end();
}

main().catch(console.error);
