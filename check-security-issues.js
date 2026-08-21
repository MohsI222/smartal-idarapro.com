import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function checkSecurityIssues() {
  try {
    console.log('🔍 Checking security issues...\n');
    
    // Check 1: Tables without RLS
    console.log('1️⃣ Tables without RLS:');
    const noRlsTables = await pool.query(
      `SELECT t.tablename 
       FROM pg_tables t
       JOIN pg_class c ON c.relname = t.tablename
       WHERE t.schemaname = 'public'
       AND c.relrowsecurity = false
       ORDER BY t.tablename`
    );
    
    if (noRlsTables.rows.length > 0) {
      noRlsTables.rows.forEach(t => {
        console.log(`   ❌ ${t.tablename}: NO RLS`);
      });
    } else {
      console.log('   ✅ All tables have RLS enabled');
    }
    
    // Check 2: Tables with RLS but no policies
    console.log('\n2️⃣ Tables with RLS enabled but no policies:');
    const noPoliciesTables = await pool.query(
      `SELECT t.tablename 
       FROM pg_tables t
       JOIN pg_class c ON c.relname = t.tablename
       LEFT JOIN pg_policies p ON p.tablename = t.tablename AND p.schemaname = t.schemaname
       WHERE t.schemaname = 'public'
       AND c.relrowsecurity = true
       AND p.policyname IS NULL
       ORDER BY t.tablename`
    );
    
    if (noPoliciesTables.rows.length > 0) {
      noPoliciesTables.rows.forEach(t => {
        console.log(`   ❌ ${t.tablename}: RLS enabled but no policies`);
      });
    } else {
      console.log('   ✅ All tables with RLS have policies');
    }
    
    // Check 3: SECURITY DEFINER functions
    console.log('\n3️⃣ SECURITY DEFINER functions:');
    const definerFunctions = await pool.query(
      `SELECT p.proname, p.prosecdef
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE p.prosecdef = true
       AND n.nspname = 'public'`
    );
    
    if (definerFunctions.rows.length > 0) {
      definerFunctions.rows.forEach(f => {
        console.log(`   🔒 ${f.proname}: SECURITY DEFINER`);
      });
    } else {
      console.log('   ✅ No SECURITY DEFINER functions');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkSecurityIssues();
