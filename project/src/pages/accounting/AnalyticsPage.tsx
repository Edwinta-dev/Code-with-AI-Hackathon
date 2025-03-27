import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Loader2, AlertCircle, DollarSign, Calendar, TrendingUp, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Client {
  id: string;
  name: string;
  liaison: {
    id: string;
    fullName: string;
    crsScore: number;
  };
  analytics: {
    paymentHistory: {
      month: string;
      daysFromDue: number;
    }[];
    paymentDistribution: {
      status: string;
      count: number;
    }[];
    recentActivity: {
      date: string;
      type: string;
      description: string;
    }[];
  };
}

export default function AnalyticsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: liaisons, error: liaisonsError } = await supabase
        .from('liaisons')
        .select(`
          id,
          crs_score,
          company_relationship:company_relationships(
            client_firm:client_firm_id(id, name),
            verification_status
          ),
          client:client_id(id, full_name)
        `)
        .eq('accountant_id', user.id);

      if (liaisonsError) throw liaisonsError;

      // Format client data
      const formattedClients = liaisons
        .filter((liaison: any) => 
          liaison.company_relationship?.verification_status === 'verified' || 
          liaison.company_relationship?.verification_status === 'established'
        )
        .map((liaison: any) => ({
          id: liaison.company_relationship.client_firm.id,
          name: liaison.company_relationship.client_firm.name,
          liaison: {
            id: liaison.id,
            fullName: liaison.client.full_name,
            crsScore: liaison.crs_score
          },
          analytics: {
            paymentHistory: Array.from({ length: 12 }, (_, i) => ({
              month: new Date(2024, i, 1).toLocaleString('default', { month: 'short' }),
              daysFromDue: Math.floor(Math.random() * 7) - 3,
            })),
            paymentDistribution: [
              { status: 'On Time', count: Math.floor(Math.random() * 20) + 30 },
              { status: 'Late', count: Math.floor(Math.random() * 10) + 5 },
              { status: 'Very Late', count: Math.floor(Math.random() * 5) },
            ],
            recentActivity: Array.from({ length: 5 }, (_, i) => ({
              date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toLocaleDateString(),
              type: ['Payment', 'Message', 'Document', 'Plan Change'][Math.floor(Math.random() * 4)],
              description: [
                'Payment received',
                'New message sent',
                'Document uploaded',
                'Payment plan updated'
              ][Math.floor(Math.random() * 4)],
            })),
          },
        }));

      setClients(formattedClients);
      if (formattedClients.length > 0 && !selectedClient) {
        setSelectedClient(formattedClients[0]);
      }
    } catch (err) {
      console.error('Error fetching clients:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch clients');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <AlertCircle className="h-5 w-5 mb-2" />
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Client List Sidebar */}
      <div className="w-1/4 border-r border-gray-200 bg-white">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Clients</h2>
        </div>
        <div className="overflow-y-auto h-[calc(100%-4rem)]">
          {clients.map(client => (
            <button
              key={client.id}
              onClick={() => setSelectedClient(client)}
              className={`w-full p-4 text-left hover:bg-gray-50 transition-colors duration-200 ${
                selectedClient?.id === client.id ? 'bg-indigo-50' : ''
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium text-gray-900">{client.name}</h3>
                  <p className="text-sm text-gray-500">{client.liaison.fullName}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-sm ${
                  client.liaison.crsScore >= 80 ? 'bg-green-100 text-green-800' :
                  client.liaison.crsScore >= 70 ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  CRS: {client.liaison.crsScore}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Analytics Area */}
      <div className="flex-1 bg-gray-50 overflow-y-auto">
        {selectedClient ? (
          <div className="p-6">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">{selectedClient.name}</h1>
              <p className="text-gray-600">Analytics Dashboard</p>
            </div>

            {/* CRS Score Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl shadow-sm p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">CRS Score</h3>
                  <TrendingUp className="h-5 w-5 text-gray-400" />
                </div>
                <div className={`text-3xl font-bold ${
                  selectedClient.liaison.crsScore >= 80 ? 'text-green-600' :
                  selectedClient.liaison.crsScore >= 70 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {selectedClient.liaison.crsScore}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-xl shadow-sm p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">On-Time Payments</h3>
                  <DollarSign className="h-5 w-5 text-gray-400" />
                </div>
                <div className="text-3xl font-bold text-indigo-600">
                  {selectedClient.analytics.paymentDistribution[0].count}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-xl shadow-sm p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Late Payments</h3>
                  <Calendar className="h-5 w-5 text-gray-400" />
                </div>
                <div className="text-3xl font-bold text-yellow-600">
                  {selectedClient.analytics.paymentDistribution[1].count}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white rounded-xl shadow-sm p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Very Late</h3>
                  <Clock className="h-5 w-5 text-gray-400" />
                </div>
                <div className="text-3xl font-bold text-red-600">
                  {selectedClient.analytics.paymentDistribution[2].count}
                </div>
              </motion.div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Payment Timeline */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white rounded-xl shadow-sm p-6"
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Payment Timeline</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={selectedClient.analytics.paymentHistory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis
                        label={{
                          value: 'Days from Due Date',
                          angle: -90,
                          position: 'insideLeft',
                          style: { textAnchor: 'middle' }
                        }}
                      />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="daysFromDue"
                        stroke="#6366f1"
                        strokeWidth={2}
                        dot={{ fill: '#6366f1' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>

              {/* Payment Distribution */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white rounded-xl shadow-sm p-6"
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Payment Distribution</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={selectedClient.analytics.paymentDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="status" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#6366f1" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            </div>

            {/* Recent Activity */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl shadow-sm p-6"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Recent Activity</h3>
              <div className="space-y-4">
                {selectedClient.analytics.recentActivity.map((activity, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{activity.description}</p>
                      <p className="text-sm text-gray-500">{activity.type}</p>
                    </div>
                    <span className="text-sm text-gray-500">{activity.date}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            Select a client to view analytics
          </div>
        )}
      </div>
    </div>
  );
}