/*
  # Update messages table RLS policies

  1. Changes
    - Drop existing policies
    - Create new policies that allow both sender and recipient to see messages
    - Ensure proper access control for message operations

  2. Security
    - Messages are only visible to users involved in the liaison
    - Users can only send messages in their own liaisons
    - Read receipts can only be updated by the recipient
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read messages in their liaisons" ON messages;
DROP POLICY IF EXISTS "Users can send messages in their liaisons" ON messages;
DROP POLICY IF EXISTS "Recipients can update read status" ON messages;

-- Create new policies
-- Allow users to read messages in their liaisons (both sender and recipient)
CREATE POLICY "Users can read messages in their liaisons"
  ON messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM liaisons
      WHERE liaisons.id = messages.liaison_id
      AND (liaisons.accountant_id = auth.uid() OR liaisons.client_id = auth.uid())
    )
  );

-- Allow users to send messages in their liaisons
CREATE POLICY "Users can send messages in their liaisons"
  ON messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM liaisons
      WHERE liaisons.id = messages.liaison_id
      AND (liaisons.accountant_id = auth.uid() OR liaisons.client_id = auth.uid())
    )
    AND auth.uid() = sender_id
  );

-- Allow recipients to update read status
CREATE POLICY "Recipients can update read status"
  ON messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM liaisons
      WHERE liaisons.id = messages.liaison_id
      AND (
        (liaisons.accountant_id = auth.uid() AND sender_id = liaisons.client_id) OR
        (liaisons.client_id = auth.uid() AND sender_id = liaisons.accountant_id)
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