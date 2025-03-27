/*
  # Add Payment Plan Indexes

  1. Changes
    - Add index for created_at timestamp
    - Add index for modified_by user reference
    
  2. Notes
    - Improves query performance for timestamp-based queries
    - Improves performance for user modification lookups
*/

-- Create additional helpful indexes
CREATE INDEX IF NOT EXISTS idx_payment_plan_created_at 
ON "Payment_plan" (created_at);

CREATE INDEX IF NOT EXISTS idx_payment_plan_modified_by 
ON "Payment_plan" (modified_by);