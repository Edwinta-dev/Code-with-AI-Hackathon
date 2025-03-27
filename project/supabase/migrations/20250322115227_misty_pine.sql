/*
  # Create Transactions Table for AI Payment Suggestion Engine

  1. New Tables
    - `transactions`
      - Core transaction data (amount, dates, status)
      - Payment plan tracking (type, number, plan reference)
      - Performance metrics (impact score, completion timing)
      - Historical analysis data

  2. Indexes
    - Optimize queries for payment analysis
    - Support efficient date-based lookups
    - Enable quick access to payment plan data

  3. Functions
    - Helper function for date generation
    - Data population for testing
*/

-- Drop existing table if it exists
DROP TABLE IF EXISTS transactions;

-- Create transactions table
CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now() NOT NULL,
  
  -- Core payment data
  amount numeric NOT NULL CHECK (amount > 0),
  due_date date NOT NULL,
  completion_date timestamptz,
  status text NOT NULL CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  description text NOT NULL,
  
  -- Payment plan tracking
  payment_plan_id bigint REFERENCES "Payment_plan"(id),
  payment_type text NOT NULL CHECK (payment_type IN ('installment', 'lumpsum')),
  payment_number smallint DEFAULT 0,
  
  -- Performance metrics
  impact_score integer CHECK (impact_score BETWEEN -10 AND 10),
  days_to_payment integer, -- Negative for early, positive for late
  payment_streak integer DEFAULT 0, -- Consecutive on-time payments
  
  -- Historical analysis
  average_payment_delay interval, -- Rolling average of payment timing
  payment_consistency_score numeric CHECK (payment_consistency_score BETWEEN 0 AND 100),
  risk_level text CHECK (risk_level IN ('low', 'medium', 'high')),
  
  -- Timestamps
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_transactions_payment_plan ON transactions(payment_plan_id);
CREATE INDEX idx_transactions_dates ON transactions(due_date, completion_date);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_metrics ON transactions(impact_score, payment_consistency_score);
CREATE INDEX idx_transactions_risk ON transactions(risk_level);

-- Helper function for random date generation
CREATE OR REPLACE FUNCTION random_date(start_date timestamptz, end_date timestamptz)
RETURNS timestamptz AS $$
BEGIN
  RETURN start_date + random() * (end_date - start_date);
END;
$$ LANGUAGE plpgsql;

-- Function to calculate payment consistency score
CREATE OR REPLACE FUNCTION calculate_payment_consistency(
  completion_date timestamptz,
  due_date date,
  payment_streak integer
) RETURNS numeric AS $$
DECLARE
  base_score numeric;
  streak_bonus numeric;
BEGIN
  -- Base score calculation
  IF completion_date IS NULL THEN
    RETURN 0;
  ELSIF completion_date <= (due_date::timestamptz) THEN
    base_score := 80 + (random() * 10);
  ELSE
    base_score := 50 + (random() * 30);
  END IF;
  
  -- Add streak bonus (up to 10 points)
  streak_bonus := LEAST(payment_streak * 2, 10);
  
  RETURN LEAST(base_score + streak_bonus, 100);
END;
$$ LANGUAGE plpgsql;

-- Insert test data
DO $$ 
DECLARE
  liaison_record RECORD;
  payment_plan_record RECORD;
  payment_amount numeric;
  due_date date;
  completion_date timestamptz;
  payment_status text;
  impact_score integer;
  payment_streak integer;
  consistency_score numeric;
  days_late integer;
  i integer;
BEGIN
  -- For each liaison
  FOR liaison_record IN SELECT id FROM liaisons LOOP
    -- Get active payment plan
    FOR payment_plan_record IN 
      SELECT id, total_due, num_payment 
      FROM "Payment_plan" 
      WHERE liaison_id = liaison_record.id 
      AND status = 'active' 
    LOOP
      payment_amount := payment_plan_record.total_due / payment_plan_record.num_payment;
      payment_streak := 0;
      
      -- Generate transaction history
      FOR i IN 1..payment_plan_record.num_payment LOOP
        -- Set due date (monthly intervals)
        due_date := CURRENT_DATE - interval '1 month' * (payment_plan_record.num_payment - i);
        
        -- Randomize completion date and status
        IF random() < 0.7 THEN -- 70% chance of being paid
          completion_date := random_date(
            (due_date - interval '5 days')::timestamptz,
            (due_date + interval '3 days')::timestamptz
          );
          payment_status := 'paid';
          payment_streak := payment_streak + 1;
          
          -- Calculate impact score based on payment timing
          IF completion_date <= (due_date::timestamptz) THEN
            impact_score := floor(random() * 5 + 6); -- 6 to 10
            days_late := -1 * floor(random() * 5 + 1); -- Early payment
          ELSE
            impact_score := floor(random() * 5 + 1); -- 1 to 5
            days_late := floor(random() * 3 + 1); -- Slightly late
          END IF;
        ELSE -- 30% chance of being overdue
          completion_date := NULL;
          payment_status := 'overdue';
          impact_score := floor(random() * 10 - 10); -- -10 to -1
          days_late := floor(random() * 30 + 5); -- 5-35 days late
          payment_streak := 0;
        END IF;

        -- Calculate consistency score
        consistency_score := calculate_payment_consistency(completion_date, due_date, payment_streak);

        -- Insert transaction record
        INSERT INTO transactions (
          amount,
          due_date,
          completion_date,
          status,
          payment_type,
          payment_number,
          payment_plan_id,
          impact_score,
          days_to_payment,
          payment_streak,
          payment_consistency_score,
          risk_level,
          description,
          average_payment_delay
        ) VALUES (
          payment_amount,
          due_date,
          completion_date,
          payment_status,
          'installment',
          i,
          payment_plan_record.id,
          impact_score,
          days_late,
          payment_streak,
          consistency_score,
          CASE 
            WHEN consistency_score >= 80 THEN 'low'
            WHEN consistency_score >= 60 THEN 'medium'
            ELSE 'high'
          END,
          'Monthly Payment ' || i || ' of ' || payment_plan_record.num_payment,
          CASE 
            WHEN completion_date IS NOT NULL 
            THEN (completion_date - due_date::timestamptz)
            ELSE interval '30 days'
          END
        );
      END LOOP;
    END LOOP;
  END LOOP;
END $$;