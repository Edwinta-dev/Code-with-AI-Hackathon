/*
  # Create Storage Buckets

  1. New Storage Buckets
    - `chat-documents`: For storing chat attachments
    - `client-records`: For storing client invoices and verification documents

  2. Security
    - Enable RLS on buckets
    - Add policies for authenticated access
*/

-- Enable storage by creating buckets
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('chat-documents', 'chat-documents', true),
  ('client-records', 'client-records', true);

-- Set up security policies for chat-documents bucket
CREATE POLICY "Authenticated users can upload chat documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-documents' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Users can view chat documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'chat-documents');

-- Set up security policies for client-records bucket
CREATE POLICY "Authenticated users can upload client records"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'client-records' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Users can view client records"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'client-records');