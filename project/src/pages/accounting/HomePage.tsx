import React, { useState, useEffect } from 'react';
import { Calendar, DollarSign, MessageSquare, AlertCircle, UserPlus } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import AddClientModal from '../../components/AddClientModal';
import ConnectButton from '../../components/ConnectButton';

interface Client {
  id: string;
  companyName: string;
  email: string;
  phone: string;
  relationshipId: string;
  verificationStatus: 'pending' | 'verified' | 'established';
  initiatedBy: 'client' | 'accountant';
  liaisonId?: string;
  crsScore: number;
  payment: {
    amount: number;
    dueDate: string;
    description: string;
    status: 'pending' | 'paid' | 'overdue';
  };
}

export default function HomePage() {
  const navigate = useNavigate();
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchClients();

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
          fetchClients();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error('Not authenticated');

      const { data: accountantData, error: accountantError } = await supabase
        .from('users')
        .select('company_id, role')
        .eq('id', user.id)
        .single();

      if (accountantError) throw accountantError;
      if (!accountantData?.company_id) throw new Error('No company associated with this account');

      const { data: relationships, error: relationshipsError } = await supabase
        .from('company_relationships')
        .select(`
          id,
          verification_status,
          initiated_by,
          client_firm:client_firm_id (
            id,
            name,
            domain_email,
            users (
              id,
              email,
              phone_number,
              full_name
            )
          ),
          liaisons (
            id,
            crs_score
          )
        `)
        .eq('accounting_firm_id', accountantData.company_id);

      if (relationshipsError) throw relationshipsError;

      if (!relationships || relationships.length === 0) {
        setClients([]);
        return;
      }

      const formattedClients = relationships.map((rel: any) => {
        const primaryContact = rel.client_firm?.users?.[0] || {};
        return {
          id: rel.client_firm?.id,
          companyName: rel.client_firm?.name || 'Unknown Company',
          email: primaryContact.email || rel.client_firm?.domain_email || 'No email provided',
          phone: primaryContact.phone_number || 'N/A',
          relationshipId: rel.id,
          verificationStatus: rel.verification_status || 'pending',
          initiatedBy: rel.initiated_by || 'accountant',
          liaisonId: rel.liaisons[0]?.id,
          crsScore: rel.liaisons[0]?.crs_score || 85,
          payment: {
            amount: Math.floor(Math.random() * 3000) + 1000,
            dueDate: new Date(Date.now() + Math.random() * 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            status: Math.random() > 0.3 ? 'pending' : 'overdue',
            description: 'Monthly Services',
          },
        };
      }).filter(client => client.id && client.companyName !== 'Unknown Company');

      setClients(formattedClients);
    } catch (err) {
      console.error('Error in fetchClients:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while fetching clients');
    } finally {
      setLoading(false);
    }
  };

  const handleAddClientSuccess = () => {
    fetchClients();
  };

  const handleSendReminder = (client: Client) => {
    if (client.liaisonId) {
      navigate('/accounting/chat', {
        state: {
          selectedLiaisonId: client.liaisonId,
          autoOpenChat: true
        }
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md w-full">
          <div className="flex items-center text-red-700 mb-4">
            <AlertCircle className="h-6 w-6 mr-2" />
            <h2 className="text-lg font-semibold">Error</h2>
          </div>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchClients}
            className="w-full px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors duration-200"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {clients.length > 0 ? 'Client Payments' : 'Welcome to AccountFlow'}
        </h1>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setIsAddClientModalOpen(true)}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-200 shadow-sm"
        >
          <UserPlus className="h-5 w-5 mr-2" />
          Add New Client
        </motion.button>
      </div>

      {clients.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center"
        >
          <UserPlus className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Clients Yet</h2>
          <p className="text-gray-600 mb-6">
            Get started by adding your first client using the button above.
          </p>
        </motion.div>
      ) : (
        <div className="grid gap-6">
          {clients.map((client) => (
            <motion.div
              key={client.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
            >
              <div className="grid grid-cols-2 gap-6">
                {/* Left Section - Chat/Communication */}
                <div className="border-r border-gray-200 pr-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-gray-900">
                      {client.companyName}
                    </h3>
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      client.crsScore >= 80 ? 'bg-green-100 text-green-800' :
                      client.crsScore >= 70 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      CRS: {client.crsScore}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      {client.email}
                    </div>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2" />
                      {client.phone}
                    </div>
                  </div>
                  <div className="mt-4">
                    <ConnectButton
                      relationshipId={client.relationshipId}
                      initialStatus={client.verificationStatus}
                      userType="accountant"
                      initiatedBy={client.initiatedBy}
                      onStatusChange={fetchClients}
                    />
                  </div>
                </div>

                {/* Right Section - Payment Details */}
                <div>
                  {client.verificationStatus === 'verified' || client.verificationStatus === 'established' ? (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-medium text-gray-900">Payment Details</h4>
                        <span className={`flex items-center ${
                          client.payment.status === 'overdue' ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {client.payment.status === 'overdue' && <AlertCircle className="h-4 w-4 mr-1" />}
                          {client.payment.status.charAt(0).toUpperCase() + client.payment.status.slice(1)}
                        </span>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center text-gray-600">
                          <DollarSign className="h-5 w-5 mr-2" />
                          <span className="text-lg font-medium">
                            ${client.payment.amount.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center text-gray-600">
                          <Calendar className="h-5 w-5 mr-2" />
                          <span>Due: {new Date(client.payment.dueDate).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="mt-4 flex space-x-3">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleSendReminder(client)}
                          className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-200"
                        >
                          Send Reminder
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                        >
                          View History
                        </motion.button>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center text-gray-500">
                        <p className="mb-2">Connection Pending</p>
                        <p className="text-sm">Payment details will be available once the connection is verified.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AddClientModal
        isOpen={isAddClientModalOpen}
        onClose={() => setIsAddClientModalOpen(false)}
        onSuccess={handleAddClientSuccess}
      />
    </div>
  );
}