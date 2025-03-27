/*
  # Add Active Payment Plan Validation

  1. Changes
    - Update status check constraint to include all possible statuses
    - Handle existing duplicate active payment plans
    - Add unique constraint for active payment plans
    
  2. Notes
    - Keeps only the most recent active plan per liaison
    - Other plans are marked as cancelled
    - Ensures data integrity before adding unique constraint
*/

-- Update status check constraint to include completed and cancelled
ALTER TABLE "Payment_plan" 
DROP CONSTRAINT IF EXISTS "Payment_plan_status_check";

ALTER TABLE "Payment_plan" 
ADD CONSTRAINT "Payment_plan_status_check" 
CHECK (status IN ('pending', 'active', 'rejected', 'completed', 'cancelled'));

-- Handle existing duplicate active payment plans
WITH ranked_plans AS (
  SELECT 
    id,
    liaison_id,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY liaison_id 
      ORDER BY created_at DESC
    ) as rn
  FROM "Payment_plan"
  WHERE status = 'active'
)
UPDATE "Payment_plan"
SET status = 'cancelled'
WHERE id IN (
  SELECT id 
  FROM ranked_plans 
  WHERE rn > 1
);

-- Add unique constraint for active payment plans
CREATE UNIQUE INDEX IF NOT EXISTS "idx_active_payment_plan" 
ON "Payment_plan" (liaison_id) 
WHERE status = 'active';