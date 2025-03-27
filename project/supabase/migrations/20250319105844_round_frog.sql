/*
  # Disable RLS for Testing

  1. Changes
    - Temporarily disable RLS on users table
    - Temporarily disable RLS on companies table
    - Drop existing policies for later recreation
    
  IMPORTANT: This is for development/testing only.
  Re-enable RLS before deploying to production!
*/

-- Disable RLS on both tables
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;

-- Drop existing policies (we'll recreate them later when re-enabling RLS)
DROP POLICY IF EXISTS "Users can view their company colleagues" ON users;
DROP POLICY IF EXISTS "Users can view their own company" ON companies;