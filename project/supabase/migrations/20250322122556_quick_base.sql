/*
  # Add Pending Transactions for Clients

  1. Changes
    - Add one pending transaction for each client with an active payment plan
    - Set due dates in the near future
    - Calculate amounts based on payment plan details
    
  2. Notes
    - Only creates transactions for clients with active payment plans
    - Uses realistic payment amounts and due dates
*/

-- Insert pending transactions for each client with an active payment plan
INSERT INTO transactions (
  amount,
  due_date,
  status,
  payment_type,
  payment_number,
  payment_plan_id,
  impact_score,
  payment_consistency_score,
  risk_level,
  description
)
SELECT 
  -- Calculate payment amount from payment plan
  CASE 
    WHEN pp.num_payment > 0 
    THEN pp.total_due / pp.num_payment 
    ELSE pp.total_due 
  END as amount,
  
  -- Set due date to 2 weeks from now
  CURRENT_DATE + interval '14 days' as due_date,
  
  'pending' as status,
  
  -- Set payment type based on number of payments
  CASE 
    WHEN pp.num_payment > 1 THEN 'installment'
    ELSE 'lumpsum'
  END as payment_type,
  
  -- For installment plans, this is the first payment
  1 as payment_number,
  
  pp.id as payment_plan_id,
  
  -- Set neutral impact score for pending payments
  0 as impact_score,
  
  -- Use liaison's CRS score as initial payment consistency score
  l.crs_score as payment_consistency_score,
  
  -- Set risk level based on CRS score
  CASE 
    WHEN l.crs_score >= 80 THEN 'low'
    WHEN l.crs_score >= 70 THEN 'medium'
    ELSE 'high'
  END as risk_level,
  
  -- Create descriptive message
  CASE 
    WHEN pp.num_payment > 1 
    THEN 'Installment Payment 1 of ' || pp.num_payment
    ELSE 'Full Payment'
  END as description
  
FROM "Payment_plan" pp
JOIN liaisons l ON l.id = pp.liaison_id
JOIN users u ON u.id = l.accountant_id
WHERE pp.status = 'active'
AND u.email = 'a1@a.com'
AND NOT EXISTS (
  -- Ensure we don't create duplicate pending transactions
  SELECT 1 FROM transactions t 
  WHERE t.payment_plan_id = pp.id 
  AND t.status = 'pending'
);