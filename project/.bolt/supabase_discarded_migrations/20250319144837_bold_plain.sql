/*
  # Add initiated_by column to company_relationships table

  1. Changes
    - Add initiated_by column to track who initiated the relationship
    - Update verification_status check constraint
    - Set default value for existing relationships
    - Make initiated_by NOT NULL

  2. Constraints
    - initiated_by must be either 'client' or 'accountant'
    - verification_status must be 'pending', 'verified', or 'established'
*/

-- Add initiated_by column to company_relationships table
ALTER TABLE company_relationships ADD COLUMN IF NOT EXISTS initiated_by text CHECK (initiated_by IN ('client', 'accountant'));

-- Update verification_status check constraint
ALTER TABLE company_relationships DROP CONSTRAINT IF EXISTS company_relationships_verification_status_check;
ALTER TABLE company_relationships ADD CONSTRAINT company_relationships_verification_status_check 
  CHECK (verification_status IN ('pending', 'verified', 'established'));

-- Set default value for initiated_by for existing relationships
UPDATE company_relationships SET initiated_by = 'accountant' WHERE initiated_by IS NULL;

-- Make initiated_by NOT NULL
ALTER TABLE company_relationships ALTER COLUMN initiated_by SET NOT NULL;