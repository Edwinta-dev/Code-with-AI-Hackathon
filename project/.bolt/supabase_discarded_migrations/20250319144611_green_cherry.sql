/*
  # Create Messages Table

  1. New Tables
    - `messages`
      - `id` (uuid, primary key)
      - `liaison_id` (uuid, foreign key to liaisons)
      - `sender_id` (uuid, foreign key to auth.users)
      - `content` (text)
      - `is_read` (boolean)
      - `document_url` (text, optional)
      - `document_name` (text, optional)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Constraints
    - Content must not be empty when no document is attached
    - Document URL and name must both be present or both be null
    - Foreign key constraints to liaisons and users tables

  3. Security
    - Enable RLS
    - Policies for reading and sending messages
    - Policy for updating read status
*/

-- Create messages table if it doesn't exist
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  liaison_id uuid NOT NULL REFERENCES liaisons(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  document_url text,
  document_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Add constraint to ensure content is not empty when no document is attached
  CONSTRAINT messages_content_not_empty CHECK (
    CASE 
      WHEN document_url IS NULL THEN char_length(trim(content)) > 0
      ELSE true
    END
  ),

  -- Add constraint to ensure document_url and document_name are either both null or both set
  CONSTRAINT messages_document_consistency CHECK (
    (document_url IS NULL AND document_name IS NULL) OR
    (document_url IS NOT NULL AND document_name IS NOT NULL)
  )
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_messages_liaison_id ON messages(liaison_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_liaison_created ON messages(liaison_id, created_at);

-- Add table comment
COMMENT ON TABLE messages IS 'Stores chat messages between users with support for file attachments and read receipts';

-- Enable Row Level Security
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can read messages in their liaisons" ON messages;
  DROP POLICY IF EXISTS "Users can send messages in their liaisons" ON messages;
  DROP POLICY IF EXISTS "Recipients can update read status" ON messages;
END
$$;

-- Create policies
CREATE POLICY "Users can read messages in their liaisons"
  ON messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM liaisons
      WHERE id = messages.liaison_id
      AND (accountant_id = auth.uid() OR client_id = auth.uid())
    )
  );

CREATE POLICY "Users can send messages in their liaisons"
  ON messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM liaisons
      WHERE id = messages.liaison_id
      AND (accountant_id = auth.uid() OR client_id = auth.uid())
    )
    AND auth.uid() = sender_id
  );

CREATE POLICY "Recipients can update read status"
  ON messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM liaisons
      WHERE id = messages.liaison_id
      AND (
        (accountant_id = auth.uid() AND sender_id = client_id) OR
        (client_id = auth.uid() AND sender_id = accountant_id)
      )
    )
  )
  WITH CHECK (
    -- Only allow updating is_read field
    (OLD.liaison_id = NEW.liaison_id) AND
    (OLD.sender_id = NEW.sender_id) AND
    (OLD.content = NEW.content) AND
    (OLD.document_url IS NOT DISTINCT FROM NEW.document_url) AND
    (OLD.document_name IS NOT DISTINCT FROM NEW.document_name) AND
    (OLD.created_at = NEW.created_at)
  );

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS update_messages_updated_at ON messages;
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();