import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Loader2, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import PaymentPlanCard from '../../components/PaymentPlanCard';
import { PaymentPlan } from '../../types/paymentPlan';

export default function PaymentRenegotiationPage() {
  const navigate = useNavigate();
  const [currentPlan, setCurrentPlan] = useState<PaymentPlan>({
    type: 'lumpsum',
    totalAmount: 0,
    paymentPeriod: 30,
    numberOfPayments: 1,
  });

  const [newPlan, setNewPlan] = useState<PaymentPlan>({
    type: 'lumpsum',
    totalAmount: 0,
    paymentPeriod: 30,
    numberOfPayments: 1,
    reason: '',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liaisonId, setLiaisonId] = useState<string | null>(null);

  useEffect(() => {
    fetchCurrentPlan();
  }, []);

  const fetchCurrentPlan = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Step 1: Retrieve liaison_id using user.id
      const { data: liaisonEntry, error: liaisonError } = await supabase
        .from('liaisons')
        .select('id')
        .eq('client_id', user.id)
        .maybeSingle();

      if (liaisonError) throw liaisonError;
      if (!liaisonEntry) throw new Error('Liaison not found for this user');

      const liaisonId = liaisonEntry.id;
      setLiaisonId(liaisonId);

      // Step 2: Fetch the active payment plan using liaison_id
      const { data: plan, error: planError } = await supabase
        .from('Payment_plan')
        .select(`
          id,
          total_due,
          payment_rate,
          num_payment
        `)
        .eq('liaison_id', liaisonId)
        .eq('status', 'active')
        .maybeSingle();

      if (planError) throw planError;
      if (!plan) {
        setError('No active payment plan found');
        return;
      }

      const formattedPlan: PaymentPlan = {
        type: plan.num_payment > 1 ? 'installment' : 'lumpsum',
        totalAmount: plan.total_due,
        paymentPeriod: plan.payment_rate,
        numberOfPayments: plan.num_payment,
        paymentAmount: plan.total_due / plan.num_payment,
      };

      setCurrentPlan(formattedPlan);
      setNewPlan({
        ...formattedPlan,
        reason: '',
      });

    } catch (err) {
      console.error('Error fetching payment plan:', err);
      setError(err instanceof Error ? err.message : 'Failed to load payment plan');
    } finally {
      setLoading(false);
    }
  };

  const handleNewPlanChange = (field: string, value: any) => {
    setNewPlan(prev => {
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
    if (!liaisonId) {
      setError('No liaison ID found');
      return;
    }

    if (newPlan.totalAmount <= 0) {
      setError('Total amount must be greater than 0');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Send the payment plan as a message
      const messageContent = {
        type: 'payment_plan_request',
        currentPlan,
        newPlan: {
          ...newPlan,
          liaisonId,
        },
      };

      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          liaison_id: liaisonId,
          sender_id: user.id,
          content: JSON.stringify(messageContent),
          is_read: false,
        });

      if (messageError) throw messageError;

      // Navigate to chat with state
      navigate('/client/chat', { 
        state: { 
          fromPaymentRenegotiation: true,
          liaisonId
        }
      });
    } catch (err) {
      console.error('Error submitting payment plan:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit payment plan');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Renegotiate Payment Plan</h1>

        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
            <AlertCircle className="h-5 w-5 mr-2" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-8">
          {/* Current Plan */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Current Payment Plan</h2>
            <PaymentPlanCard {...currentPlan} />
          </div>

          {/* New Plan */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">New Payment Plan</h2>
            <PaymentPlanCard
              {...newPlan}
              isEditable={true}
              onChange={handleNewPlanChange}
            />
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSubmit}
            disabled={saving || !newPlan.reason}
            className="flex items-center bg-indigo-600 text-white py-2 px-6 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Send className="h-5 w-5 mr-2" />
                Send Request
              </>
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
}