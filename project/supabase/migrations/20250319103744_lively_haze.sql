/*
  # Initial Schema Setup for Accounting App

  1. New Tables
    - `companies`
      - Core company information for both accounting firms and clients
      - Includes type designation and contact details
    
    - `users`
      - User accounts associated with companies
      - Includes role-based access control
    
    - `company_relationships`
      - Manages connections between accounting firms and clients
      - Tracks verification status
    
    - `liaisons`
      - Links specific accountants with client contacts
      - Enables direct communication channels
    
    - `transactions`
      - Records financial transactions and payment status
      - Links to company relationships

  2. Security
    - RLS enabled on all tables
    - Policies for:
      - Company access based on user association
      - Relationship visibility for connected parties
      - Transaction access for relevant parties

  3. Constraints
    - Foreign key relationships ensure data integrity
    - Check constraints validate data entries
    - Default values for critical fields
*/

-- Create companies table
CREATE TABLE companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  domain_email text NOT NULL,
  type text NOT NULL CHECK (type IN ('accounting_firm', 'client')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create users table
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) NOT NULL,
  email text UNIQUE NOT NULL,
  phone_number text,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('manager', 'accountant', 'client_user')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create company relationships table
CREATE TABLE company_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accounting_firm_id uuid REFERENCES companies(id) NOT NULL,
  client_firm_id uuid REFERENCES companies(id) NOT NULL,
  verification_status text NOT NULL DEFAULT 'pending' 
    CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(accounting_firm_id, client_firm_id)
);

-- Create liaisons table
CREATE TABLE liaisons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_relationship_id uuid REFERENCES company_relationships(id) NOT NULL,
  accountant_id uuid REFERENCES users(id) NOT NULL,
  client_id uuid REFERENCES users(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_relationship_id, accountant_id, client_id)
);

-- Create transactions table
CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_relationship_id uuid REFERENCES company_relationships(id) NOT NULL,
  amount decimal NOT NULL CHECK (amount > 0),
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'paid', 'overdue')),
  description text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE liaisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Companies Policies
CREATE POLICY "Users can view their own company"
  ON companies
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT company_id 
      FROM users 
      WHERE users.id = auth.uid()
    )
  );

-- Users Policies
CREATE POLICY "Users can view their company colleagues"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM users 
      WHERE users.id = auth.uid()
    )
  );

-- Company Relationships Policies
CREATE POLICY "Companies can view their relationships"
  ON company_relationships
  FOR SELECT
  TO authenticated
  USING (
    accounting_firm_id IN (
      SELECT company_id 
      FROM users 
      WHERE users.id = auth.uid()
    ) 
    OR 
    client_firm_id IN (
      SELECT company_id 
      FROM users 
      WHERE users.id = auth.uid()
    )
  );

-- Liaisons Policies
CREATE POLICY "Users can view their liaisons"
  ON liaisons
  FOR SELECT
  TO authenticated
  USING (
    accountant_id = auth.uid() 
    OR 
    client_id = auth.uid()
  );

-- Transactions Policies
CREATE POLICY "Users can view transactions in their relationships"
  ON transactions
  FOR SELECT
  TO authenticated
  USING (
    company_relationship_id IN (
      SELECT cr.id 
      FROM company_relationships cr
      JOIN users u ON 
        u.company_id = cr.accounting_firm_id 
        OR 
        u.company_id = cr.client_firm_id
      WHERE u.id = auth.uid()
    )
  );

-- Create indexes for better query performance
CREATE INDEX idx_users_company_id ON users(company_id);
CREATE INDEX idx_company_relationships_firms ON company_relationships(accounting_firm_id, client_firm_id);
CREATE INDEX idx_liaisons_relationship ON liaisons(company_relationship_id);
CREATE INDEX idx_transactions_relationship ON transactions(company_relationship_id);
CREATE INDEX idx_transactions_due_date ON transactions(due_date);