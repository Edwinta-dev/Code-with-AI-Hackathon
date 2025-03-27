/*
  # Add Messages Table and Related Changes

  1. New Tables
    - `messages`
      - `id` (uuid, primary key)
      - `liaison_id` (uuid, foreign key to liaisons)
      - `sender_id` (uuid, foreign key to users)
      - `content` (text)
      - `is_read` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
      - `document_url` (text, nullable)
      - `document_name` (text, nullable)

  2. Security
    - Enable RLS on messages table
    - Add policies for message access
*/

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  liaison_id uuid NOT NULL REFERENCES liaisons(id),
  sender_id uuid NOT NULL REFERENCES users(id),
  content text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  document_url text,
  document_name text,
  CONSTRAINT valid_document CHECK (
    (document_url IS NULL AND document_name IS NULL) OR
    (document_url IS NOT NULL AND document_name IS NOT NULL)
  )
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_messages_liaison_id ON messages(liaison_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can read messages in their liaisons"
  ON messages
  FOR SELECT
  TO authenticated
  USING (
    sender_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM liaisons
      WHERE liaisons.id = messages.liaison_id
      AND (liaisons.accountant_id = auth.uid() OR liaisons.client_id = auth.uid())
    )
  );

CREATE POLICY "Users can insert messages in their liaisons"
  ON messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM liaisons
      WHERE liaisons.id = messages.liaison_id
      AND (liaisons.accountant_id = auth.uid() OR liaisons.client_id = auth.uid())
    )
  );