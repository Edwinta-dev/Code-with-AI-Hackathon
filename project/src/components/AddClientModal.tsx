import React, { useState, useEffect } from 'react';
import { X, Loader2, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import PaymentPlanCard from './PaymentPlanCard';
import { PaymentPlan } from '../types/paymentPlan';

interface AddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  description?: string;
}

interface ClientFormData {
  companyName: string;
  domainEmail: string;
  liaisonName: string;
  liaisonEmail: string;
  liaisonPhone: string;
}

const initialFormData: ClientFormData = {
  companyName: '',
  domainEmail: '',
  liaisonName: '',
  liaisonEmail: '',
  liaisonPhone: '',
};

const initialPaymentPlan: PaymentPlan = {
  type: 'installment',
  totalAmount: 0,
  paymentPeriod: 30,
  numberOfPayments: 1,
  reason: '',
};

export default function AddClientModal({ 
  isOpen, 
  onClose, 
  onSuccess,
  title = "Add New Client",
  description = "Add a new client to your account"
}: AddClientModalProps) {
  const [step, setStep] = useState<'verify' | 'company' | 'liaison' | 'payment'>('verify');
  const [isUsingSoftware, setIsUsingSoftware] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<ClientFormData>(initialFormData);
  const [isClient, setIsClient] = useState(false);
  const [paymentPlan, setPaymentPlan] = useState<PaymentPlan>(initialPaymentPlan);

  useEffect(() => {
    const checkUserType = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      setIsClient(userData?.role === 'client_user');
    };

    checkUserType();
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setFormData(initialFormData);
      setStep('verify');
      setError(null);
      setPaymentPlan(initialPaymentPlan);
    }
  }, [isOpen]);

  const handleVerifyStep = (usingSoftware: boolean) => {
    setIsUsingSoftware(usingSoftware);
    setStep('company');
  };

  const handleBack = () => {
    if (step === 'payment') {
      setStep('liaison');
    } else if (step === 'liaison') {
      setStep('company');
    } else if (step === 'company') {
      setStep('verify');
    }
  };

  const handleCompanyStep = async () => {
    setError(null);
    setLoading(true);

    try {
      const { data: existingCompany, error: companyError } = await supabase
        .from('companies')
        .select('id')
        .eq('name', formData.companyName)
        .maybeSingle();

      if (companyError) throw companyError;

      if (existingCompany && !isUsingSoftware) {
        throw new Error('Company already exists in our system');
      }

      if (!existingCompany && isUsingSoftware) {
        throw new Error('Company not found in our system');
      }

      setStep('liaison');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleLiaisonStep = () => {
    setStep('payment');
  };

  const handlePaymentPlanChange = (field: string, value: any) => {
    setPaymentPlan(prev => {
      const updated = { ...prev, [field]: value };
      
      if (field === 'totalAmount' || field === 'numberOfPayments') {
        updated.paymentAmount = updated.totalAmount / updated.numberOfPayments;
      }
      
      if (field === 'paymentAmount') {
        updated.totalAmount = value * updated.numberOfPayments;
      }
      
      return updated;
    });
  };

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get current user's company
      const { data: currentUser, error: userError } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (userError) throw userError;

      let accountingFirmId: string;
      let clientFirmId: string;

      if (isClient) {
        // Client initiating connection
        clientFirmId = currentUser.company_id;

        // Get or create accounting firm
        let accountingFirm;
        if (isUsingSoftware) {
          const { data, error } = await supabase
            .from('companies')
            .select('id')
            .eq('name', formData.companyName)
            .single();

          if (error) throw error;
          accountingFirm = data;
        } else {
          const { data, error } = await supabase
            .from('companies')
            .insert([{
              name: formData.companyName,
              domain_email: formData.domainEmail,
              type: 'accounting_firm',
              is_using_software: false
            }])
            .select()
            .single();

          if (error) throw error;
          accountingFirm = data;
        }
        accountingFirmId = accountingFirm.id;
      } else {
        // Accountant initiating connection
        accountingFirmId = currentUser.company_id;

        // Get or create client company
        let clientFirm;
        if (isUsingSoftware) {
          const { data, error } = await supabase
            .from('companies')
            .select('id')
            .eq('name', formData.companyName)
            .single();

          if (error) throw error;
          clientFirm = data;
        } else {
          const { data, error } = await supabase
            .from('companies')
            .insert([{
              name: formData.companyName,
              domain_email: formData.domainEmail,
              type: 'client',
              is_using_software: false
            }])
            .select()
            .single();

          if (error) throw error;
          clientFirm = data;
        }
        clientFirmId = clientFirm.id;
      }

      // Create or get liaison user
      let liaisonId: string;
      const { data: existingUser, error: userQueryError } = await supabase
        .from('users')
        .select('id')
        .eq('email', formData.liaisonEmail)
        .maybeSingle();

      if (userQueryError) throw userQueryError;

      if (existingUser) {
        liaisonId = existingUser.id;
      } else {
        const { data: authUser, error: authError } = await supabase.auth.signUp({
          email: formData.liaisonEmail,
          password: Math.random().toString(36).slice(-8),
        });

        if (authError) throw authError;
        if (!authUser.user) throw new Error('Failed to create user');

        const { error: userError } = await supabase
          .from('users')
          .insert([{
            id: authUser.user.id,
            company_id: isClient ? accountingFirmId : clientFirmId,
            email: formData.liaisonEmail,
            full_name: formData.liaisonName,
            phone_number: formData.liaisonPhone,
            role: isClient ? 'accountant' : 'client_user',
            is_using_software: false
          }]);

        if (userError) throw userError;
        liaisonId = authUser.user.id;
      }

      // Create company relationship
      const { data: relationship, error: relationshipError } = await supabase
        .from('company_relationships')
        .insert([{
          accounting_firm_id: accountingFirmId,
          client_firm_id: clientFirmId,
          verification_status: 'pending',
          initiated_by: isClient ? 'client' : 'accountant'
        }])
        .select()
        .single();

      if (relationshipError) throw relationshipError;

      // Create liaison
      const { data: liaison, error: liaisonError } = await supabase
        .from('liaisons')
        .insert([{
          company_relationship_id: relationship.id,
          accountant_id: isClient ? liaisonId : user.id,
          client_id: isClient ? user.id : liaisonId
        }])
        .select()
        .single();

      if (liaisonError) throw liaisonError;

      // Create initial payment plan
      const { error: paymentPlanError } = await supabase
        .from('Payment_plan')
        .insert([{
          total_due: paymentPlan.totalAmount,
          payment_rate: paymentPlan.paymentPeriod,
          num_payment: paymentPlan.numberOfPayments,
          liaison_id: liaison.id,
          status: 'pending',
          modified_by: user.id
        }]);

      if (paymentPlanError) throw paymentPlanError;

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1 },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <motion.div
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={modalVariants}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-xl max-w-md w-full p-6"
          >
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center">
                {step !== 'verify' && (
                  <button
                    onClick={handleBack}
                    className="mr-3 text-gray-500 hover:text-gray-700 transition-colors duration-200"
                    title="Go back"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                )}
                <h2 className="text-xl font-semibold">{title}</h2>
              </div>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 transition-colors duration-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"
              >
                {error}
              </motion.div>
            )}

            {step === 'verify' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                <p className="text-gray-600">{description}</p>
                <div className="flex space-x-3">
                  <button
                    onClick={() => handleVerifyStep(true)}
                    className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition-colors duration-200"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => handleVerifyStep(false)}
                    className="flex-1 border border-gray-300 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                  >
                    No
                  </button>
                </div>
              </motion.div>
            )}

            {step === 'company' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Enter company name"
                  />
                </div>
                {!isUsingSoftware && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Domain Email
                    </label>
                    <input
                      type="text"
                      value={formData.domainEmail}
                      onChange={(e) => setFormData({ ...formData, domainEmail: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="@company.com"
                    />
                  </div>
                )}
                <button
                  onClick={handleCompanyStep}
                  disabled={loading}
                  className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors duration-200"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                  ) : (
                    'Continue'
                  )}
                </button>
              </motion.div>
            )}

            {step === 'liaison' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Liaison Name
                  </label>
                  <input
                    type="text"
                    value={formData.liaisonName}
                    onChange={(e) => setFormData({ ...formData, liaisonName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Enter liaison's full name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Liaison Email
                  </label>
                  <input
                    type="email"
                    value={formData.liaisonEmail}
                    onChange={(e) => setFormData({ ...formData, liaisonEmail: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Enter liaison's email"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Liaison Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.liaisonPhone}
                    onChange={(e) => setFormData({ ...formData, liaisonPhone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Enter liaison's phone number"
                  />
                </div>
                <button
                  onClick={handleLiaisonStep}
                  disabled={loading}
                  className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors duration-200"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                  ) : (
                    'Continue'
                  )}
                </button>
              </motion.div>
            )}

            {step === 'payment' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                <PaymentPlanCard
                  {...paymentPlan}
                  isEditable={true}
                  onChange={handlePaymentPlanChange}
                />
                <button
                  onClick={handleSubmit}
                  disabled={loading || paymentPlan.totalAmount === 0}
                  className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors duration-200"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                  ) : (
                    'Connect'
                  )}
                </button>
              </motion.div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}