/*
  # Add Payment Plan Table and Related Changes

  1. New Tables
    - `Payment_plan`
      - `id` (bigint, primary key)
      - `created_at` (timestamp)
      - `total_due` (bigint)
      - `payment_rate` (integer)
      - `num_payment` (integer)
      - `liaison_id` (uuid)
      - `status` (text)
      - `parent_plan_id` (bigint)
      - `modified_by` (uuid)

  2. Security
    - Enable RLS on Payment_plan table
    - Add policies for payment plan access
*/

-- Create Payment_plan table
CREATE TABLE IF NOT EXISTS "Payment_plan" (
  id bigint PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  total_due bigint,
  payment_rate integer,
  num_payment integer,
  liaison_id uuid REFERENCES liaisons(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected')),
  parent_plan_id bigint REFERENCES "Payment_plan"(id),
  modified_by uuid REFERENCES users(id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_payment_plan_liaison_id ON "Payment_plan"(liaison_id);
CREATE INDEX IF NOT EXISTS idx_payment_plan_status ON "Payment_plan"(status);

-- Enable RLS
ALTER TABLE "Payment_plan" ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view payment plans in their liaisons"
  ON "Payment_plan"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM liaisons
      WHERE liaisons.id = "Payment_plan".liaison_id
      AND (liaisons.accountant_id = auth.uid() OR liaisons.client_id = auth.uid())
    )
  );

CREATE POLICY "Users can insert payment plans in their liaisons"
  ON "Payment_plan"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM liaisons
      WHERE liaisons.id = "Payment_plan".liaison_id
      AND (liaisons.accountant_id = auth.uid() OR liaisons.client_id = auth.uid())
    )
  );

CREATE POLICY "Users can update payment plans in their liaisons"
  ON "Payment_plan"
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM liaisons
      WHERE liaisons.id = "Payment_plan".liaison_id
      AND (liaisons.accountant_id = auth.uid() OR liaisons.client_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM liaisons
      WHERE liaisons.id = "Payment_plan".liaison_id
      AND (liaisons.accountant_id = auth.uid() OR liaisons.client_id = auth.uid())
    )
  );