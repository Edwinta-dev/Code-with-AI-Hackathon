/*
  # Add software usage tracking

  1. New Columns
    - Add is_using_software column to companies table
    - Add is_using_software column to users table
    
  2. Changes
    - Set default value to false for both columns
    - Make columns non-nullable
*/

-- Add is_using_software column to companies table
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS is_using_software boolean NOT NULL DEFAULT false;

-- Add is_using_software column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_using_software boolean NOT NULL DEFAULT false;