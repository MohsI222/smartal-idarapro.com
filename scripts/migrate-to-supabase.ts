import pg from 'pg';

const neonUrl = 'postgresql://neondb_owner:npg_pbU9hWLnXD5M@ep-hidden-rice-b1ny0oau-pooler.c-5.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
const supabaseUrl = 'postgresql://postgres.ihteylplpdtxdpqxafrq:smartalidara2026@aws-1-eu-west-3.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require';

async function migrateTables() {
  const neonClient = new pg.Client({ connectionString: neonUrl });
  const supabaseClient = new pg.Client({ connectionString: supabaseUrl });

  try {
    console.log('🔌 Connecting to Neon...');
    await neonClient.connect();
    console.log('✅ Connected to Neon');

    console.log('🔌 Connecting to Supabase...');
    await supabaseClient.connect();
    console.log('✅ Connected to Supabase');

    // Get all tables
    const tablesResult = await neonClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log(`📊 Found ${tablesResult.rows.length} tables`);

    for (const row of tablesResult.rows) {
      const tableName = row.table_name;
      console.log(`\n🔄 Migrating table: ${tableName}`);

      try {
        // Get table structure
        const structureResult = await neonClient.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_name = $1 AND table_schema = 'public'
          ORDER BY ordinal_position
        `, [tableName]);

        // Create table in Supabase
        let createTableSQL = `CREATE TABLE IF NOT EXISTS ${tableName} (`;
        const columns = structureResult.rows.map(col => {
          let sql = `${col.column_name} ${col.data_type}`;
          if (col.is_nullable === 'NO') sql += ' NOT NULL';
          if (col.column_default) sql += ` DEFAULT ${col.column_default}`;
          return sql;
        });
        createTableSQL += columns.join(', ');
        createTableSQL += ')';

        await supabaseClient.query(createTableSQL);
        console.log(`  ✅ Created table structure for ${tableName}`);

        // Get data
        const dataResult = await neonClient.query(`SELECT * FROM ${tableName}`);
        if (dataResult.rows.length > 0) {
          const columns = Object.keys(dataResult.rows[0]);
          const values = dataResult.rows.map(row => {
            return `(${columns.map(col => {
              const val = row[col];
              if (val === null) return 'NULL';
              if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
              if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
              return val;
            }).join(', ')})`;
          }).join(', ');

          const insertSQL = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${values}`;
          await supabaseClient.query(insertSQL);
          console.log(`  ✅ Inserted ${dataResult.rows.length} rows into ${tableName}`);
        } else {
          console.log(`  ℹ️  No data in ${tableName}`);
        }
      } catch (error) {
        console.error(`  ❌ Error migrating ${tableName}:`, error);
      }
    }

    console.log('\n✅ Migration completed!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await neonClient.end();
    await supabaseClient.end();
  }
}

migrateTables();
