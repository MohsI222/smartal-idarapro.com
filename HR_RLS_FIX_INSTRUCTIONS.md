# HR RLS Fix - Application Instructions

## Problem Fixed
- Users couldn't delete employees from HR module
- Permission denied error when saving absence records: `permission denied for table hr_absence_records`
- Conflicting RLS policies in Supabase

## Solution
A comprehensive migration has been created to clean up and fix all HR RLS policies:
- `supabase/migrations/20260828000000_fix_hr_comprehensive_rls.sql`

## How to Apply the Migration

### Option 1: Supabase Dashboard (Recommended - Safest)

1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Navigate to your project
3. Go to **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy the entire content from: `supabase/migrations/20260828000000_fix_hr_comprehensive_rls.sql`
6. Paste it into the SQL editor
7. Click **Run** (or press Cmd/Ctrl + Enter)
8. Wait for the migration to complete
9. Verify success by checking the "Success" message

### Option 2: Supabase CLI (If Installed)

```bash
supabase db push
```

This will automatically apply all pending migrations including the new HR fix.

## What This Migration Does

### For `hr_employees` table:
- ✅ Drops all conflicting policies
- ✅ Enables and forces RLS
- ✅ Creates clean policies allowing users to:
  - View their own employees
  - Insert their own employees
  - Update their own employees
  - Delete their own employees
- ✅ Removes anon access
- ✅ Grants proper authenticated access

### For `hr_absence_records` table:
- ✅ Drops all interfering policies
- ✅ Enables and forces RLS
- ✅ Creates clean policies allowing users to:
  - View their own absence records
  - Insert their own absence records
  - Update their own absence records
  - Delete their own absence records
- ✅ Removes anon access
- ✅ Grants proper authenticated access

## Verification

After applying the migration, test the HR module:

1. **Test Employee Deletion:**
   - Go to HR module
   - Try to delete an employee
   - Should work without errors

2. **Test Absence Record Creation:**
   - Go to HR module
   - Try to create an absence record
   - Should work without "permission denied" error

3. **Test User Isolation:**
   - Log in as different users
   - Each user should only see their own employees and absence records

## Important Notes

- ⚠️ This migration removes all anon access to HR tables for security
- ⚠️ Each user can only manage their own data (user_id isolation)
- ⚠️ If you need super admin access, additional policies may be needed
- ✅ The application code is already correct - only Supabase policies needed fixing

## Troubleshooting

If you encounter errors:

1. **"Policy already exists"**: This is normal, the migration uses `IF EXISTS`
2. **"Table does not exist"**: Ensure the HR tables are created first
3. **"Permission denied"**: Ensure you're using a service role key or have admin access

## Files Created

- `supabase/migrations/20260828000000_fix_hr_comprehensive_rls.sql` - The migration SQL
- `apply-hr-rls-fix.cjs` - Script attempt (may not work without exec_sql function)
- `apply-hr-rls-fix-v2.cjs` - Alternative script (may not work without REST SQL endpoint)
- `HR_RLS_FIX_INSTRUCTIONS.md` - This file

## Next Steps

1. Apply the migration using Option 1 (Supabase Dashboard)
2. Test the HR module functionality
3. Report any remaining issues
