/*
  # Temporarily disable RLS for testing

  1. Changes
    - Temporarily disable RLS on companies table for testing
    - Add a note about re-enabling security later
    
  IMPORTANT: This is for development/testing only.
  Re-enable RLS before deploying to production!
*/

-- Temporarily disable RLS on companies table
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;

-- Drop existing policies (we'll recreate them later when re-enabling RLS)
DROP POLICY IF EXISTS "Users can view their own company" ON companies;