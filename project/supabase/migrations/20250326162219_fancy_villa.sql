/*
  # Update Client Profiles and Transaction Histories

  1. Changes
    - Update CRS scores for specific liaisons
    - Create transaction histories reflecting different payment behaviors
    - Set up contrasting scenarios for AI payment suggestions

  2. Profiles
    - Forgetful (Poor performance): Low CRS, late payments
    - Client3 (Good performance): High CRS, consistent payments
    - NotDoingWell (Excellent performance): Very high CRS, perfect payment history
*/

-- First, update CRS scores for the liaisons
UPDATE liaisons
SET crs_score = 55  -- Poor score
WHERE id IN (
  SELECT l.id
  FROM liaisons l
  JOIN users u ON u.id = l.client_id
  JOIN companies c ON c.id = u.company_id
  WHERE c.name = 'forgetful'
);

UPDATE liaisons
SET crs_score = 85  -- Good score
WHERE id IN (
  SELECT l.id
  FROM liaisons l
  JOIN users u ON u.id = l.client_id
  JOIN companies c ON c.id = u.company_id
  WHERE c.name = 'client3'
);

UPDATE liaisons
SET crs_score = 95  -- Excellent score
WHERE id IN (
  SELECT l.id
  FROM liaisons l
  JOIN users u ON u.id = l.client_id
  JOIN companies c ON c.id = u.company_id
  WHERE c.name = 'notdoingwell'
);

-- Clear existing transactions for these clients
DELETE FROM transactions
WHERE payment_plan_id IN (
  SELECT pp.id
  FROM "Payment_plan" pp
  JOIN liaisons l ON l.id = pp.liaison_id
  JOIN users u ON u.id = l.client_id
  JOIN companies c ON c.id = u.company_id
  WHERE c.name IN ('forgetful', 'client3', 'notdoingwell')
);

-- Insert historical transactions for 'forgetful' (poor performance)
INSERT INTO transactions (
  payment_plan_id,
  amount,
  due_date,
  completion_date,
  status,
  payment_type,
  payment_number,
  impact_score,
  payment_streak,
  payment_consistency_score,
  risk_level,
  description,
  days_to_payment
)
SELECT 
  pp.id,
  pp.total_due / pp.num_payment,
  CURRENT_DATE - (n || ' months')::interval,
  CASE 
    WHEN n % 3 = 0 THEN NULL -- Every 3rd payment is overdue
    ELSE CURRENT_DATE - (n || ' months')::interval + '10 days'::interval
  END,
  CASE 
    WHEN n % 3 = 0 THEN 'overdue'
    ELSE 'paid'
  END,
  'installment',
  6 - n,
  -5,
  0,
  45,
  'high',
  'Monthly Payment ' || (6 - n),
  CASE 
    WHEN n % 3 = 0 THEN NULL
    ELSE 10
  END
FROM generate_series(5, 0, -1) AS n
CROSS JOIN (
  SELECT pp.id, pp.total_due, pp.num_payment
  FROM "Payment_plan" pp
  JOIN liaisons l ON l.id = pp.liaison_id
  JOIN users u ON u.id = l.client_id
  JOIN companies c ON c.id = u.company_id
  WHERE c.name = 'forgetful'
  AND pp.status = 'active'
  LIMIT 1
) pp;

-- Insert historical transactions for 'client3' (good performance)
INSERT INTO transactions (
  payment_plan_id,
  amount,
  due_date,
  completion_date,
  status,
  payment_type,
  payment_number,
  impact_score,
  payment_streak,
  payment_consistency_score,
  risk_level,
  description,
  days_to_payment
)
SELECT 
  pp.id,
  pp.total_due / pp.num_payment,
  CURRENT_DATE - (n || ' months')::interval,
  CURRENT_DATE - (n || ' months')::interval - '2 days'::interval,
  'paid',
  'installment',
  6 - n,
  5,
  n + 1,
  80,
  'medium',
  'Monthly Payment ' || (6 - n),
  -2
FROM generate_series(5, 0, -1) AS n
CROSS JOIN (
  SELECT pp.id, pp.total_due, pp.num_payment
  FROM "Payment_plan" pp
  JOIN liaisons l ON l.id = pp.liaison_id
  JOIN users u ON u.id = l.client_id
  JOIN companies c ON c.id = u.company_id
  WHERE c.name = 'client3'
  AND pp.status = 'active'
  LIMIT 1
) pp;

-- Insert historical transactions for 'notdoingwell' (excellent performance)
INSERT INTO transactions (
  payment_plan_id,
  amount,
  due_date,
  completion_date,
  status,
  payment_type,
  payment_number,
  impact_score,
  payment_streak,
  payment_consistency_score,
  risk_level,
  description,
  days_to_payment
)
SELECT 
  pp.id,
  pp.total_due / pp.num_payment,
  CURRENT_DATE - (n || ' months')::interval,
  CURRENT_DATE - (n || ' months')::interval - '5 days'::interval,
  'paid',
  'installment',
  6 - n,
  8,
  n + 1,
  95,
  'low',
  'Monthly Payment ' || (6 - n),
  -5
FROM generate_series(5, 0, -1) AS n
CROSS JOIN (
  SELECT pp.id, pp.total_due, pp.num_payment
  FROM "Payment_plan" pp
  JOIN liaisons l ON l.id = pp.liaison_id
  JOIN users u ON u.id = l.client_id
  JOIN companies c ON c.id = u.company_id
  WHERE c.name = 'notdoingwell'
  AND pp.status = 'active'
  LIMIT 1
) pp;

-- Add pending transactions for current month
INSERT INTO transactions (
  payment_plan_id,
  amount,
  due_date,
  status,
  payment_type,
  payment_number,
  impact_score,
  payment_consistency_score,
  risk_level,
  description
)
SELECT 
  pp.id,
  pp.total_due / pp.num_payment,
  CURRENT_DATE + interval '5 days',
  'pending',
  'installment',
  (
    SELECT COUNT(*) + 1 
    FROM transactions t 
    WHERE t.payment_plan_id = pp.id
  ),
  0,
  CASE 
    WHEN c.name = 'forgetful' THEN 45
    WHEN c.name = 'client3' THEN 80
    ELSE 95
  END,
  CASE 
    WHEN c.name = 'forgetful' THEN 'high'
    WHEN c.name = 'client3' THEN 'medium'
    ELSE 'low'
  END,
  'Current Month Payment'
FROM "Payment_plan" pp
JOIN liaisons l ON l.id = pp.liaison_id
JOIN users u ON u.id = l.client_id
JOIN companies c ON c.id = u.company_id
WHERE c.name IN ('forgetful', 'client3', 'notdoingwell')
AND pp.status = 'active';