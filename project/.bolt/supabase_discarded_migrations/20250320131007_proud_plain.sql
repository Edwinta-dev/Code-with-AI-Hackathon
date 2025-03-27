-- Drop existing triggers
DROP TRIGGER IF EXISTS trg_transaction_status_change ON transactions;
DROP TRIGGER IF EXISTS trg_payment_plan_completion ON Payment_plan;
DROP TRIGGER IF EXISTS trg_payment_plan_transaction ON transactions;

-- Drop existing functions
DROP FUNCTION IF EXISTS fn_generate_next_transaction();
DROP FUNCTION IF EXISTS fn_validate_payment_plan_completion();
DROP FUNCTION IF EXISTS fn_update_payment_plan_transaction();

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view payment plans through liaisons" ON Payment_plan;
DROP POLICY IF EXISTS "Users can view transactions through payment plans" ON transactions;

-- Drop existing tables (order matters due to foreign key constraints)
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS Payment_plan;

-- Create Payment_plan table (note the capital P)
CREATE TABLE Payment_plan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  total_due numeric NOT NULL CHECK (total_due > 0),
  payment_rate integer NOT NULL CHECK (payment_rate > 0),
  liaison_id uuid NOT NULL REFERENCES liaisons(id),
  num_payment integer NOT NULL CHECK (num_payment > 0),
  next_transaction_id uuid,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create transactions table
CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount numeric NOT NULL CHECK (amount > 0),
  due_date date NOT NULL,
  status text NOT NULL CHECK (status IN ('PENDING', 'PAID', 'OVERDUE', 'RENEGO')),
  created_at timestamptz DEFAULT now(),
  payment_num integer NOT NULL CHECK (payment_num > 0),
  payment_plan uuid NOT NULL REFERENCES Payment_plan(id),
  CONSTRAINT unique_payment_num_per_plan UNIQUE (payment_plan, payment_num)
);

-- Add foreign key constraint for next_transaction_id
ALTER TABLE Payment_plan
ADD CONSTRAINT fk_next_transaction
FOREIGN KEY (next_transaction_id)
REFERENCES transactions(id);

-- Create indexes
CREATE INDEX idx_transactions_payment_plan ON transactions(payment_plan);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_Payment_plan_liaison ON Payment_plan(liaison_id);
CREATE INDEX idx_Payment_plan_completed ON Payment_plan(completed);

-- Function to generate the next transaction
CREATE OR REPLACE FUNCTION fn_generate_next_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_payment_plan RECORD;
  v_payment_num INTEGER;
  v_next_transaction_id UUID;
BEGIN
  -- Only proceed if status changed to 'PAID'
  IF NEW.status = 'PAID' THEN
    -- Get payment plan details
    SELECT * INTO v_payment_plan 
    FROM Payment_plan 
    WHERE id = NEW.payment_plan;
    
    -- Get current payment number
    SELECT COALESCE(MAX(payment_num), 0) INTO v_payment_num
    FROM transactions
    WHERE payment_plan = NEW.payment_plan;
    
    -- Only generate new transaction if we haven't reached total payments
    IF v_payment_num < v_payment_plan.num_payment THEN
      -- Insert new transaction
      INSERT INTO transactions (
        payment_plan,
        amount,
        due_date,
        status,
        payment_num
      ) VALUES (
        NEW.payment_plan,
        v_payment_plan.total_due / v_payment_plan.num_payment,
        NEW.due_date + (v_payment_plan.payment_rate || ' days')::interval,
        'PENDING',
        v_payment_num + 1
      ) RETURNING id INTO v_next_transaction_id;
      
      -- Update payment plan with new transaction ID
      UPDATE Payment_plan 
      SET next_transaction_id = v_next_transaction_id
      WHERE id = NEW.payment_plan;
    END IF;
  -- Handle RENEGO status
  ELSIF NEW.status = 'RENEGO' THEN
    -- Mark current payment plan as completed
    UPDATE Payment_plan 
    SET completed = true
    WHERE id = NEW.payment_plan;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to validate payment plan completion
CREATE OR REPLACE FUNCTION fn_validate_payment_plan_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Check for active transactions when trying to complete payment plan
  IF NEW.completed = true AND OLD.completed = false THEN
    IF EXISTS (
      SELECT 1 
      FROM transactions 
      WHERE payment_plan = NEW.id 
      AND status IN ('PENDING', 'OVERDUE')
    ) THEN
      RAISE EXCEPTION 'Cannot complete payment plan with active transactions';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update payment plan's next transaction
CREATE OR REPLACE FUNCTION fn_update_payment_plan_transaction()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the payment plan's next_transaction_id
  UPDATE Payment_plan 
  SET next_transaction_id = NEW.id
  WHERE id = NEW.payment_plan;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for transaction status changes
CREATE TRIGGER trg_transaction_status_change
AFTER UPDATE OF status ON transactions
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION fn_generate_next_transaction();

-- Trigger for payment plan completion validation
CREATE TRIGGER trg_payment_plan_completion
BEFORE UPDATE OF completed ON Payment_plan
FOR EACH ROW
EXECUTE FUNCTION fn_validate_payment_plan_completion();

-- Trigger for updating payment plan's next transaction
CREATE TRIGGER trg_payment_plan_transaction
AFTER INSERT ON transactions
FOR EACH ROW
EXECUTE FUNCTION fn_update_payment_plan_transaction();

-- Enable RLS
ALTER TABLE Payment_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view payment plans through liaisons"
ON Payment_plan
FOR SELECT
TO authenticated
USING (
  liaison_id IN (
    SELECT id FROM liaisons
    WHERE accountant_id = auth.uid() OR client_id = auth.uid()
  )
);

CREATE POLICY "Users can view transactions through payment plans"
ON transactions
FOR SELECT
TO authenticated
USING (
  payment_plan IN (
    SELECT id FROM Payment_plan
    WHERE liaison_id IN (
      SELECT id FROM liaisons
      WHERE accountant_id = auth.uid() OR client_id = auth.uid()
    )
  )
);