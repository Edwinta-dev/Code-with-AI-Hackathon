import React, { useState, useEffect } from 'react';
import { Calendar, DollarSign, MessageSquare, AlertCircle, UserPlus, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import AddClientModal from '../../components/AddClientModal';
import ConnectButton from '../../components/ConnectButton';

interface AccountingFirm {
  id: string;
  name: string;
  relationshipId: string;
  verificationStatus: 'pending' | 'verified' | 'established';
  initiatedBy: 'client' | 'accountant';
  liaisonId?: string;
  crsScore: number;
}

interface Payment {
  id: string;
  amount: number;
  dueDate: string;
  description: string;
  status: 'pending' | 'paid' | 'overdue';
}

export default function HomePage() {
  const navigate = useNavigate();
  const [accountingFirms, setAccountingFirms] = useState<AccountingFirm[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);

  useEffect(() => {
    fetchData();

    const subscription = supabase
      .channel('company_relationships_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'company_relationships'
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error('Not authenticated');

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (userError) throw userError;

      const { data: relationships, error: relationshipError } = await supabase
        .from('company_relationships')
        .select(`
          id,
          verification_status,
          initiated_by,
          accounting_firm:accounting_firm_id (
            id,
            name
          ),
          liaisons (
            id,
            crs_score
          )
        `)
        .eq('client_firm_id', userData.company_id);

      if (relationshipError) throw relationshipError;

      if (relationships) {
        const firms = relationships.map(rel => ({
          id: rel.accounting_firm.id,
          name: rel.accounting_firm.name,
          relationshipId: rel.id,
          verificationStatus: rel.verification_status,
          initiatedBy: rel.initiated_by,
          liaisonId: rel.liaisons[0]?.id,
          crsScore: rel.liaisons[0]?.crs_score || 85,
        }));
        setAccountingFirms(firms);
      }

      setPayments([
        {
          id: '1',
          amount: 1500,
          dueDate: '2024-03-25',
          description: 'Monthly Accounting Services',
          status: 'pending',
        },
        {
          id: '2',
          amount: 800,
          dueDate: '2024-04-01',
          description: 'Tax Preparation',
          status: 'pending',
        },
      ]);

      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  const handleSendReminder = (firm: AccountingFirm) => {
    if (firm.liaisonId) {
      navigate('/client/chat', { 
        state: { 
          selectedLiaisonId: firm.liaisonId,
          autoOpenChat: true 
        }
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (accountingFirms.length === 0) {
    return (
      <div className="py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center"
          >
            <UserPlus className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Welcome to Yero</h2>
            <p className="text-gray-600 mb-6">
              To get started, connect with your accountant or invite them to join Yero.
            </p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsAddClientModalOpen(true)}
              className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-200"
            >
              <UserPlus className="h-5 w-5 mr-2" />
              Connect with Accountant
            </motion.button>
          </motion.div>
        </div>

        <AddClientModal
          isOpen={isAddClientModalOpen}
          onClose={() => setIsAddClientModalOpen(false)}
          onSuccess={fetchData}
          title="Connect with Your Accountant"
          description="To get started, please connect with your accountant or invite them to join Yero."
        />
      </div>
    );
  }

  const pendingFirms = accountingFirms.filter(firm => firm.verificationStatus === 'pending');
  const activeFirms = accountingFirms.filter(firm => 
    firm.verificationStatus === 'verified' || firm.verificationStatus === 'established'
  );

  return (
    <div className="py-8">
      {pendingFirms.length > 0 && (
        <div className="mb-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Pending Connections</h2>
            <div className="space-y-4">
              {pendingFirms.map(firm => (
                <motion.div
                  key={firm.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {firm.name}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Accounting Firm Connection Request
                      </p>
                    </div>
                    <div className="w-48">
                      <ConnectButton
                        relationshipId={firm.relationshipId}
                        initialStatus={firm.verificationStatus}
                        userType="client"
                        initiatedBy={firm.initiatedBy}
                        onStatusChange={fetchData}
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeFirms.map((firm) => (
        <div key={firm.id} className="mb-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {firm.name}
                  </h2>
                  <div className="flex items-center mt-1">
                    <p className="text-sm text-gray-600">Your Accounting Firm</p>
                  </div>
                </div>
                <div className="w-48">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setIsAddClientModalOpen(true)}
                    className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-200 shadow-sm"
                  >
                    <UserPlus className="h-5 w-5 mr-2" />
                    Change Accountant
                  </motion.button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* CRS Score Card */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-700">Your Client Reputation Score</h3>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      onClick={() => navigate('/client/crs')}
                      className="text-indigo-600 hover:text-indigo-700"
                    >
                      <TrendingUp className="h-5 w-5" />
                    </motion.button>
                  </div>
                  <div className="flex items-center">
                    <div className={`text-2xl font-bold ${
                      firm.crsScore >= 80 ? 'text-green-600' :
                      firm.crsScore >= 70 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {firm.crsScore}
                    </div>
                    <div className="ml-2 text-sm text-gray-500">
                      / 100
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {firm.crsScore >= 80 ? 'Excellent payment history' :
                     firm.crsScore >= 70 ? 'Good standing' :
                     'Needs improvement'}
                  </p>
                </div>

                {/* Payment Summary */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Payment Summary</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Next Payment</span>
                      <span className="font-medium">${payments[0]?.amount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Due Date</span>
                      <span className="font-medium">
                        {new Date(payments[0]?.dueDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Details */}
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Payments</h3>
                <div className="space-y-4">
                  {payments.map((payment) => (
                    <motion.div
                      key={payment.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-gray-50 rounded-lg p-4"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-base font-medium text-gray-900">
                            {payment.description}
                          </h4>
                          <div className="mt-2 flex items-center text-gray-600">
                            <Calendar className="h-4 w-4 mr-2" />
                            <span>Due: {new Date(payment.dueDate).toLocaleDateString()}</span>
                          </div>
                          <div className="mt-1 flex items-center text-gray-600">
                            <DollarSign className="h-4 w-4 mr-2" />
                            <span>${payment.amount.toLocaleString()}</span>
                          </div>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleSendReminder(firm)}
                          className="flex items-center px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors duration-200"
                        >
                          <MessageSquare className="h-4 w-4 mr-1" />
                          Contact
                        </motion.button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}

      <AddClientModal
        isOpen={isAddClientModalOpen}
        onClose={() => setIsAddClientModalOpen(false)}
        onSuccess={fetchData}
        title="Change Your Accountant"
        description="Connect with a different accounting firm."
      />
    </div>
  );
}