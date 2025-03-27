/*
  # Add Payment Plan Status and History

  1. Changes
    - Add status column to Payment_plan table
    - Add parent_plan_id to track plan history
    - Add modified_by to track who made changes
    
  2. Notes
    - Status can be 'pending', 'active', 'rejected'
    - parent_plan_id links to original plan for tracking history
    - modified_by links to users table
*/

ALTER TABLE "Payment_plan" 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending' 
  CHECK (status IN ('pending', 'active', 'rejected')),
ADD COLUMN IF NOT EXISTS parent_plan_id bigint REFERENCES "Payment_plan"(id),
ADD COLUMN IF NOT EXISTS modified_by uuid REFERENCES users(id);