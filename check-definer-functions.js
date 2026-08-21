import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function checkDefinerFunctions() {
  try {
    console.log('🔍 Checking SECURITY DEFINER function permissions...\n');
    
    const definerFunctions = await pool.query(
      `SELECT p.proname, p.prosecdef
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE p.prosecdef = true
       AND n.nspname = 'public'`
    );
    
    for (const func of definerFunctions.rows) {
      console.log(`🔒 Function: ${func.proname} (SECURITY DEFINER)`);
      
      // Check execute permissions
      const perms = await pool.query(
        `SELECT grantee, privilege_type 
         FROM information_schema.routine_privileges 
         WHERE routine_name = $1 
         AND routine_schema = 'public'
         AND privilege_type = 'EXECUTE'`,
        [func.proname]
      );
      
      console.log(`   Execute permissions:`);
      perms.rows.forEach(p => {
        console.log(`     - ${p.grantee}: EXECUTE`);
      });
      
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkDefinerFunctions();
