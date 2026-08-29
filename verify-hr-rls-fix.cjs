#!/usr/bin/env node

/**
 * Verify HR RLS Fix Migration
 * This script verifies that the HR RLS policies were applied correctly
 */

const { Pool } = require('pg');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('Error: DATABASE_URL must be set in .env.local');
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

async function verifyPolicies() {
  const client = await pool.connect();
  
  console.log('='.repeat(60));
  console.log('Verifying HR RLS Policies');
  console.log('='.repeat(60));
  
  try {
    // Check hr_employees policies
    console.log('\n--- hr_employees Policies ---');
    const employeesPolicies = await client.query(`
      SELECT policyname, cmd, roles, qual, with_check
      FROM pg_policies 
      WHERE tablename = 'hr_employees' 
      AND schemaname = 'public'
      ORDER BY policyname
    `);
    
    if (employeesPolicies.rows.length === 0) {
      console.log('❌ No policies found on hr_employees');
    } else {
      console.log(`✅ Found ${employeesPolicies.rows.length} policies on hr_employees:`);
      employeesPolicies.rows.forEach(row => {
        console.log(`   - ${row.policyname} (${row.cmd}) for ${row.roles}`);
      });
    }
    
    // Check hr_absence_records policies
    console.log('\n--- hr_absence_records Policies ---');
    const absencePolicies = await client.query(`
      SELECT policyname, cmd, roles, qual, with_check
      FROM pg_policies 
      WHERE tablename = 'hr_absence_records' 
      AND schemaname = 'public'
      ORDER BY policyname
    `);
    
    if (absencePolicies.rows.length === 0) {
      console.log('❌ No policies found on hr_absence_records');
    } else {
      console.log(`✅ Found ${absencePolicies.rows.length} policies on hr_absence_records:`);
      absencePolicies.rows.forEach(row => {
        console.log(`   - ${row.policyname} (${row.cmd}) for ${row.roles}`);
      });
    }
    
    // Check table grants
    console.log('\n--- Table Grants ---');
    const grants = await client.query(`
      SELECT table_name, grantee, privilege_type 
      FROM information_schema.role_table_grants 
      WHERE table_name IN ('hr_employees', 'hr_absence_records') 
      AND table_schema = 'public'
      ORDER BY table_name, grantee, privilege_type
    `);
    
    if (grants.rows.length === 0) {
      console.log('❌ No grants found');
    } else {
      console.log(`✅ Found ${grants.rows.length} grants:`);
      grants.rows.forEach(row => {
        console.log(`   - ${row.table_name}: ${row.grantee} can ${row.privilege_type}`);
      });
    }
    
    // Check RLS status
    console.log('\n--- RLS Status ---');
    const rlsStatus = await client.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN ('hr_employees', 'hr_absence_records')
    `);
    
    rlsStatus.rows.forEach(row => {
      const status = row.rowsecurity ? '✅ ENABLED' : '❌ DISABLED';
      console.log(`   ${row.tablename}: ${status}`);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('Verification Complete');
    console.log('='.repeat(60));
    
    // Check if we have the expected policies
    const expectedEmployeePolicies = [
      'Users can view own hr_employees',
      'Users can insert own hr_employees',
      'Users can update own hr_employees',
      'Users can delete own hr_employees'
    ];
    
    const expectedAbsencePolicies = [
      'Users can view own hr_absence_records',
      'Users can insert own hr_absence_records',
      'Users can update own hr_absence_records',
      'Users can delete own hr_absence_records'
    ];
    
    const employeePolicyNames = employeesPolicies.rows.map(r => r.policyname);
    const absencePolicyNames = absencePolicies.rows.map(r => r.policyname);
    
    const missingEmployeePolicies = expectedEmployeePolicies.filter(p => !employeePolicyNames.includes(p));
    const missingAbsencePolicies = expectedAbsencePolicies.filter(p => !absencePolicyNames.includes(p));
    
    if (missingEmployeePolicies.length === 0 && missingAbsencePolicies.length === 0) {
      console.log('✅ All expected policies are in place!');
      console.log('✅ HR RLS fix was applied successfully!');
    } else {
      if (missingEmployeePolicies.length > 0) {
        console.log('❌ Missing hr_employees policies:', missingEmployeePolicies);
      }
      if (missingAbsencePolicies.length > 0) {
        console.log('❌ Missing hr_absence_records policies:', missingAbsencePolicies);
      }
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

verifyPolicies().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
