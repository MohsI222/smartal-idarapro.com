const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  console.log('Applying super admin HR policies migration...');
  
  const fs = require('fs');
  const path = require('path');
  
  const migrationPath = path.join(__dirname, 'supabase/migrations/20260829000000_add_super_admin_hr_policies.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  
  // Split by semicolon and execute each statement
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  for (const statement of statements) {
    if (statement.trim().length === 0) continue;
    
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: statement });
      
      if (error) {
        console.error('Error executing statement:', error);
        console.error('Statement:', statement.substring(0, 100) + '...');
      } else {
        console.log('✓ Statement executed successfully');
      }
    } catch (err) {
      console.error('Exception executing statement:', err.message);
      console.error('Statement:', statement.substring(0, 100) + '...');
    }
  }
  
  console.log('Migration completed');
}

applyMigration().catch(console.error);
