/*
  # Clear Test Data

  1. Changes
    - Remove all test data from the database
    - Clear messages, liaisons, company_relationships, users, and companies tables
    - Maintain referential integrity by deleting in correct order

  2. Notes
    - This migration removes ALL data from these tables
    - Use with caution in production environments
*/

-- Delete all messages first (they reference liaisons)
DELETE FROM messages;

-- Delete all liaisons (they reference company_relationships and users)
DELETE FROM liaisons;

-- Delete all company relationships (they reference companies)
DELETE FROM company_relationships;

-- Delete all users (they reference companies)
DELETE FROM users;

-- Delete all companies
DELETE FROM companies;