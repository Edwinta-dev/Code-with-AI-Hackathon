import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, Mail, Phone, User, Lock, AlertCircle } from 'lucide-react';
import { supabase, testDatabaseOperations, getUserRoleAndCompanyType } from '../../lib/supabase';
import AddClientModal from '../../components/AddClientModal';

type SignUpStep = 'initial' | 'existing_company' | 'new_company' | 'user_details';

interface CompanyData {
  name: string;
  domainEmail: string;
  type: 'accounting_firm' | 'client';
}

interface UserData {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  role: 'manager' | 'accountant' | 'client_user';
}

export default function SignUp() {
  const navigate = useNavigate();
  const [step, setStep] = useState<SignUpStep>('initial');
  const [isNewCompany, setIsNewCompany] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [showAddClientModal, setShowAddClientModal] = useState(false);

  const [companyData, setCompanyData] = useState<CompanyData>({
    name: '',
    domainEmail: '',
    type: 'client',
  });

  const [userData, setUserData] = useState<UserData>({
    fullName: '',
    email: '',
    phoneNumber: '',
    password: '',
    role: 'client_user',
  });

  useEffect(() => {
    testDatabaseOperations();
  }, []);

  const handleRedirect = async (userId: string) => {
    const userInfo = await getUserRoleAndCompanyType(userId);
    
    if (!userInfo) {
      setError('Error fetching user information');
      return;
    }

    setRegistrationSuccess(true);

    if (userInfo.companyType === 'client') {
      setShowAddClientModal(true);
    } else {
      navigate('/accounting');
    }
  };

  const handleInitialQuestion = (usingApp: boolean) => {
    setIsNewCompany(!usingApp);
    setStep(usingApp ? 'existing_company' : 'new_company');
  };

  const handleCompanyRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert([{
          name: companyData.name,
          domain_email: companyData.domainEmail,
          type: companyData.type,
        }])
        .select()
        .single();

      if (companyError) throw companyError;

      setCompanyId(company.id);
      setStep('user_details');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleUserRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('No user data returned');

      const { error: profileError } = await supabase
        .from('users')
        .insert([{
          id: authData.user.id,
          company_id: companyId,
          full_name: userData.fullName,
          email: userData.email,
          phone_number: userData.phoneNumber,
          role: userData.role,
        }]);

      if (profileError) throw profileError;

      await handleRedirect(authData.user.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleAddClientSuccess = () => {
    navigate('/client');
  };

  if (registrationSuccess && !showAddClientModal) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
          <h2 className="text-2xl font-semibold text-green-600 mb-4">Registration Successful!</h2>
          <p className="text-gray-600">Redirecting you to your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-blue-600">Yero</h1>
            <p className="text-gray-600 mt-2">Create your account</p>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
              <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {renderStep()}

          <p className="mt-6 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/signin" className="text-indigo-600 hover:text-indigo-500 font-medium">
              Sign in here
            </Link>
          </p>
        </div>
      </div>

      {showAddClientModal && (
        <AddClientModal
          isOpen={showAddClientModal}
          onClose={() => {
            setShowAddClientModal(false);
            navigate('/client');
          }}
          onSuccess={handleAddClientSuccess}
          title="Connect with Your Accountant"
          description="To get started, Does your Accountant use Yero?"
        />
      )}
    </>
  );

  function renderStep() {
    if (registrationSuccess) {
      return (
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-green-600 mb-4">Registration Successful!</h2>
          <p className="text-gray-600">Setting up your account...</p>
        </div>
      );
    }

    switch (step) {
      case 'initial':
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 text-center">
              Is your company currently using Yero?
            </h2>
            <div className="flex space-x-4">
              <button
                onClick={() => handleInitialQuestion(true)}
                className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors duration-200"
              >
                Yes
              </button>
              <button
                onClick={() => handleInitialQuestion(false)}
                className="flex-1 bg-white text-indigo-600 py-2 px-4 rounded-lg border border-indigo-600 hover:bg-indigo-50 transition-colors duration-200"
              >
                No
              </button>
            </div>
          </div>
        );

      case 'new_company':
        return (
          <form onSubmit={handleCompanyRegistration} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Name
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  value={companyData.name}
                  onChange={(e) => setCompanyData({ ...companyData, name: e.target.value })}
                  className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Enter company name"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Email Domain
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  value={companyData.domainEmail}
                  onChange={(e) => setCompanyData({ ...companyData, domainEmail: e.target.value })}
                  className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="@company.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Type
              </label>
              <select
                value={companyData.type}
                onChange={(e) => setCompanyData({ ...companyData, type: e.target.value as 'accounting_firm' | 'client' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                required
              >
                <option value="accounting_firm">Accounting Firm</option>
                <option value="client">Client Company</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating Company...' : 'Continue'}
            </button>
          </form>
        );

      case 'user_details':
        return (
          <form onSubmit={handleUserRegistration} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  value={userData.fullName}
                  onChange={(e) => setUserData({ ...userData, fullName: e.target.value })}
                  className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Enter your full name"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="email"
                  value={userData.email}
                  onChange={(e) => setUserData({ ...userData, email: e.target.value })}
                  className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="tel"
                  value={userData.phoneNumber}
                  onChange={(e) => setUserData({ ...userData, phoneNumber: e.target.value })}
                  className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Enter your phone number"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="password"
                  value={userData.password}
                  onChange={(e) => setUserData({ ...userData, password: e.target.value })}
                  className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Create a password"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role
              </label>
              <select
                value={userData.role}
                onChange={(e) => setUserData({ ...userData, role: e.target.value as UserData['role'] })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                required
              >
                <option value="manager">Manager</option>
                <option value="accountant">Accountant</option>
                <option value="client_user">Client User</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>
        );

      default:
        return null;
    }
  }
}