import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Helper function to get user role and company type
export async function getUserRoleAndCompanyType(userId: string) {
  try {
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`
        role,
        companies (
          type
        )
      `)
      .eq('id', userId)
      .single();

    if (userError) throw userError;

    return {
      role: userData.role,
      companyType: userData.companies?.type
    };
  } catch (error) {
    console.error('Error fetching user role and company type:', error);
    return null;
  }
}

// Helper function to test database operations
export async function testDatabaseOperations() {
  try {
    // Test inserting a company
    const { data: insertedCompany, error: insertError } = await supabase
      .from('companies')
      .insert([
        {
          name: 'Test Company',
          domain_email: 'test@example.com',
          type: 'client'
        }
      ])
      .select()
      .single();

    if (insertError) {
      console.error('Company Insert Error:', insertError);
      return;
    }
    console.log('Inserted Company:', insertedCompany);

    // Test inserting a user
    const { data: insertedUser, error: userError } = await supabase
      .from('users')
      .insert([
        {
          company_id: insertedCompany.id,
          email: 'test@example.com',
          full_name: 'Test User',
          phone_number: '+1234567890',
          role: 'client_user'
        }
      ])
      .select()
      .single();

    if (userError) {
      console.error('User Insert Error:', userError);
      return;
    }
    console.log('Inserted User:', insertedUser);

    // Test fetching all companies
    const { data: companies, error: fetchCompaniesError } = await supabase
      .from('companies')
      .select('*');

    if (fetchCompaniesError) {
      console.error('Fetch Companies Error:', fetchCompaniesError);
      return;
    }
    console.log('All Companies:', companies);

    // Test fetching all users
    const { data: users, error: fetchUsersError } = await supabase
      .from('users')
      .select('*');

    if (fetchUsersError) {
      console.error('Fetch Users Error:', fetchUsersError);
      return;
    }
    console.log('All Users:', users);

  } catch (error) {
    console.error('Operation Error:', error);
  }
}