/*
  # Update Storage Buckets and Policies

  1. Changes
    - Create buckets if they don't exist
    - Drop existing policies before recreating them
    - Add folder-based access control
    
  2. Security
    - Ensure proper bucket permissions
    - Set up user-specific folder access
*/

-- Create storage buckets if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM storage.buckets 
        WHERE id = 'chat-documents'
    ) THEN
        INSERT INTO storage.buckets (id, name, public)
        VALUES ('chat-documents', 'chat-documents', true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM storage.buckets 
        WHERE id = 'client-records'
    ) THEN
        INSERT INTO storage.buckets (id, name, public)
        VALUES ('client-records', 'client-records', true);
    END IF;
END $$;

-- Drop existing policies to avoid conflicts
DO $$
BEGIN
    DROP POLICY IF EXISTS "Authenticated users can upload chat documents" ON storage.objects;
    DROP POLICY IF EXISTS "Users can view chat documents" ON storage.objects;
    DROP POLICY IF EXISTS "Users can delete their own chat documents" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can upload client records" ON storage.objects;
    DROP POLICY IF EXISTS "Users can view client records" ON storage.objects;
    DROP POLICY IF EXISTS "Users can delete their own client records" ON storage.objects;
EXCEPTION
    WHEN undefined_object THEN
        -- Ignore errors if policies don't exist
        NULL;
END $$;

-- Set up security policies for chat-documents bucket
DO $$
BEGIN
    -- Upload policy for chat documents
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'Authenticated users can upload chat documents'
        AND tablename = 'objects'
        AND schemaname = 'storage'
    ) THEN
        CREATE POLICY "Authenticated users can upload chat documents"
        ON storage.objects
        FOR INSERT
        TO authenticated
        WITH CHECK (
            bucket_id = 'chat-documents' AND
            (storage.foldername(name))[1] = auth.uid()::text
        );
    END IF;

    -- View policy for chat documents
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'Users can view chat documents'
        AND tablename = 'objects'
        AND schemaname = 'storage'
    ) THEN
        CREATE POLICY "Users can view chat documents"
        ON storage.objects
        FOR SELECT
        TO authenticated
        USING (bucket_id = 'chat-documents');
    END IF;

    -- Delete policy for chat documents
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'Users can delete their own chat documents'
        AND tablename = 'objects'
        AND schemaname = 'storage'
    ) THEN
        CREATE POLICY "Users can delete their own chat documents"
        ON storage.objects
        FOR DELETE
        TO authenticated
        USING (
            bucket_id = 'chat-documents' AND
            (storage.foldername(name))[1] = auth.uid()::text
        );
    END IF;
END $$;

-- Set up security policies for client-records bucket
DO $$
BEGIN
    -- Upload policy for client records
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'Authenticated users can upload client records'
        AND tablename = 'objects'
        AND schemaname = 'storage'
    ) THEN
        CREATE POLICY "Authenticated users can upload client records"
        ON storage.objects
        FOR INSERT
        TO authenticated
        WITH CHECK (
            bucket_id = 'client-records' AND
            (storage.foldername(name))[1] = auth.uid()::text
        );
    END IF;

    -- View policy for client records
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'Users can view client records'
        AND tablename = 'objects'
        AND schemaname = 'storage'
    ) THEN
        CREATE POLICY "Users can view client records"
        ON storage.objects
        FOR SELECT
        TO authenticated
        USING (bucket_id = 'client-records');
    END IF;

    -- Delete policy for client records
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'Users can delete their own client records'
        AND tablename = 'objects'
        AND schemaname = 'storage'
    ) THEN
        CREATE POLICY "Users can delete their own client records"
        ON storage.objects
        FOR DELETE
        TO authenticated
        USING (
            bucket_id = 'client-records' AND
            (storage.foldername(name))[1] = auth.uid()::text
        );
    END IF;
END $$;