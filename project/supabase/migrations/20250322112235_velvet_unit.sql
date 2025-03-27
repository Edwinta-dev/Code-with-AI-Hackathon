/*
  # Add CRS Column to Liaisons Table

  1. Changes
    - Add crs_score column to liaisons table
    - Add constraint to ensure valid score range (0-100)
    - Populate existing rows with random scores
    - Add index for performance
    
  2. Notes
    - CRS scores range from 0 to 100
    - Higher scores indicate better client reputation
    - Default scores are randomly generated between 70-95
*/

-- Add CRS score column with constraint
ALTER TABLE liaisons
ADD COLUMN IF NOT EXISTS crs_score integer NOT NULL DEFAULT 85
CHECK (crs_score >= 0 AND crs_score <= 100);

-- Create index for CRS score queries
CREATE INDEX IF NOT EXISTS idx_liaisons_crs_score 
ON liaisons (crs_score);

-- Update existing rows with random scores between 70 and 95
UPDATE liaisons
SET crs_score = floor(random() * (95-70+1) + 70)
WHERE crs_score = 85;