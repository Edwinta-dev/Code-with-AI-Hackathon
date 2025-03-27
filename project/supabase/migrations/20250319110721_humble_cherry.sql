/*
  # Disable RLS for all tables

  1. Changes
    - Disable RLS on all tables (users, companies, company_relationships, liaisons, transactions)
    - Drop existing policies for later recreation
    
  IMPORTANT: This is for development/testing only.
  Re-enable RLS before deploying to production!
*/

-- Disable RLS on all tables
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE company_relationships DISABLE ROW LEVEL SECURITY;
ALTER TABLE liaisons DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their company colleagues" ON users;
DROP POLICY IF EXISTS "Users can view their own company" ON companies;
DROP POLICY IF EXISTS "Companies can view their relationships" ON company_relationships;
DROP POLICY IF EXISTS "Users can view their liaisons" ON liaisons;
DROP POLICY IF EXISTS "Users can view transactions in their relationships" ON transactions;