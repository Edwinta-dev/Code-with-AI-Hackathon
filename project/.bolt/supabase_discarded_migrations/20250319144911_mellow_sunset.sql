/*
  # Insert test data

  1. Changes
    - Insert test companies with unique names
    - Create manager and accountant users for each company
    - Handle conflicts properly using name instead of domain_email
    - Set appropriate software usage flags

  2. Data
    - Companies: 5 client companies with varying software usage
    - Users: 2 users per company (manager and accountant)
*/

DO $$
DECLARE
  company_id uuid;
  company_record RECORD;
BEGIN
  -- Insert companies one by one
  FOR company_record IN (
    SELECT * FROM (VALUES
      ('TechCorp Solutions', 'techcorp.com', true),
      ('Global Innovations Ltd', 'globalinnovations.com', true),
      ('Startup Ventures', 'startupventures.com', false),
      ('Digital Dynamics', 'digitaldynamics.com', false),
      ('Future Systems Inc', 'futuresystems.com', true)
    ) AS t(name, domain_email, is_using_software)
  ) LOOP
    -- Try to insert the company
    INSERT INTO companies (name, domain_email, type, is_using_software)
    VALUES (
      company_record.name,
      company_record.domain_email,
      'client',
      company_record.is_using_software
    )
    ON CONFLICT (name) DO NOTHING
    RETURNING id INTO company_id;
    
    -- If company was inserted successfully, get its ID
    IF company_id IS NULL THEN
      SELECT id INTO company_id
      FROM companies
      WHERE name = company_record.name;
    END IF;

    -- Create users for the company
    IF company_id IS NOT NULL THEN
      -- Insert manager
      INSERT INTO users (
        company_id,
        email,
        phone_number,
        full_name,
        role,
        is_using_software
      )
      VALUES (
        company_id,
        'manager@' || replace(lower(company_record.domain_email), '.com', '') || '.com',
        '+1' || floor(random() * 1000000000 + 1000000000)::text,
        'Manager ' || company_record.name,
        'manager',
        company_record.is_using_software
      )
      ON CONFLICT (email) DO NOTHING;

      -- Insert accountant
      INSERT INTO users (
        company_id,
        email,
        phone_number,
        full_name,
        role,
        is_using_software
      )
      VALUES (
        company_id,
        'accountant@' || replace(lower(company_record.domain_email), '.com', '') || '.com',
        '+1' || floor(random() * 1000000000 + 1000000000)::text,
        'Accountant ' || company_record.name,
        'accountant',
        company_record.is_using_software
      )
      ON CONFLICT (email) DO NOTHING;
    END IF;
  END LOOP;
END;
$$;