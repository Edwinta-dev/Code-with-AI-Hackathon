/*
  # Add Client Records Table

  1. New Tables
    - `client_records`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `invoice_file_url` (text)
      - `verification_file_url` (text, nullable)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on client_records table
    - Add policies for record access
*/

-- Create client_records table
CREATE TABLE IF NOT EXISTS client_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) NOT NULL,
  invoice_file_url text NOT NULL,
  verification_file_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_client_records_user_id ON client_records(user_id);
CREATE INDEX IF NOT EXISTS idx_client_records_created_at ON client_records(created_at);

-- Enable RLS
ALTER TABLE client_records ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own records"
  ON client_records
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own records"
  ON client_records
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());