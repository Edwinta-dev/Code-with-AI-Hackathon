/*
  # Add initiated_by column and update verification status

  1. Changes
    - Add initiated_by column to company_relationships table
    - Update verification_status check constraint to include 'established' status
    - Set default value for initiated_by for existing relationships
    - Make initiated_by NOT NULL

  2. Security
    - Add check constraint for initiated_by values to ensure data integrity
    - Ensure verification_status values are valid
*/

DO $$ 
BEGIN
  -- Only add the column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'company_relationships' 
    AND column_name = 'initiated_by'
  ) THEN
    -- Add initiated_by column
    ALTER TABLE company_relationships 
    ADD COLUMN initiated_by text;

    -- Add check constraint for initiated_by
    ALTER TABLE company_relationships 
    ADD CONSTRAINT company_relationships_initiated_by_check 
    CHECK (initiated_by IN ('client', 'accountant'));
  END IF;

  -- Update verification_status check constraint
  ALTER TABLE company_relationships 
  DROP CONSTRAINT IF EXISTS company_relationships_verification_status_check;
  
  ALTER TABLE company_relationships 
  ADD CONSTRAINT company_relationships_verification_status_check 
  CHECK (verification_status IN ('pending', 'verified', 'established'));

  -- Set default value for initiated_by for existing relationships
  UPDATE company_relationships 
  SET initiated_by = 'accountant' 
  WHERE initiated_by IS NULL;

  -- Make initiated_by NOT NULL
  ALTER TABLE company_relationships 
  ALTER COLUMN initiated_by SET NOT NULL;
END $$;