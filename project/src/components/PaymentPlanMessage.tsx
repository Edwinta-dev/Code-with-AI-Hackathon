import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, Calendar, ArrowRight, Check, X, Edit2, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import PaymentPlanCard from './PaymentPlanCard';
import toast from 'react-hot-toast';
import { PaymentPlan } from '../types/paymentPlan';

interface PaymentPlanMessageProps {
  currentPlan: PaymentPlan;
  newPlan: PaymentPlan;
  messageId: string;
  liaisonId: string;
  senderId: string;
  currentUserId: string | null;
}

export default function PaymentPlanMessage({ 
  currentPlan, 
  newPlan, 
  messageId,
  liaisonId,
  senderId,
  currentUserId
}: PaymentPlanMessageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedPlan, setEditedPlan] = useState(newPlan);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'pending' | 'accepted' | 'rejected'>('pending');
  const [generatingSuggestion, setGeneratingSuggestion] = useState(false);

  const isRecipient = currentUserId !== senderId;

  const handlePlanChange = (field: string, value: any) => {
    setEditedPlan(prev => {
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

  const generateSuggestedPlan = async () => {
    try {
      setGeneratingSuggestion(true);

      // Get liaison's CRS score and payment history
      const { data: liaison, error: liaisonError } = await supabase
        .from('liaisons')
        .select('crs_score')
        .eq('id', liaisonId)
        .single();

      if (liaisonError) throw liaisonError;

      const crsScore = liaison.crs_score;

      // Get transaction history for this liaison
      const { data: transactions, error: transactionError } = await supabase
        .from('transactions')
        .select(`
          amount,
          due_date,
          completion_date,
          status,
          impact_score,
          days_to_payment,
          payment_streak,
          payment_consistency_score,
          risk_level
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (transactionError) throw transactionError;

      // Calculate metrics from transaction history
      const paymentHistory = transactions || [];
      const onTimePayments = paymentHistory.filter(t => 
        t.completion_date && new Date(t.completion_date) <= new Date(t.due_date)
      ).length;
      const totalPayments = paymentHistory.length || 1;
      const paymentReliability = (onTimePayments / totalPayments) * 100;

      // Get average payment amount and delay
      const avgAmount = paymentHistory.reduce((sum, t) => sum + Number(t.amount), 0) / totalPayments;
      const avgDelay = paymentHistory
        .filter(t => t.days_to_payment)
        .reduce((sum, t) => sum + t.days_to_payment, 0) / totalPayments;

      // Calculate risk level based on payment consistency
      const riskLevel = paymentHistory.length > 0 
        ? paymentHistory[0].risk_level 
        : 'medium';

      // Generate suggested plan
      let suggestedPlan = { ...newPlan };

      // Adjust number of payments based on CRS score and payment history
      if (crsScore >= 90 && paymentReliability >= 95) {
        // Excellent history - very flexible terms
        suggestedPlan.numberOfPayments = Math.min(12, newPlan.numberOfPayments + 2);
        suggestedPlan.paymentPeriod = 90;
      } else if (crsScore >= 80 && paymentReliability >= 85) {
        // Good history - flexible terms
        suggestedPlan.numberOfPayments = Math.min(8, newPlan.numberOfPayments + 1);
        suggestedPlan.paymentPeriod = 60;
      } else if (crsScore >= 70 && paymentReliability >= 75) {
        // Fair history - moderate terms
        suggestedPlan.numberOfPayments = Math.min(6, newPlan.numberOfPayments);
        suggestedPlan.paymentPeriod = 45;
      } else {
        // Poor history - conservative terms
        suggestedPlan.numberOfPayments = Math.max(3, newPlan.numberOfPayments - 1);
        suggestedPlan.paymentPeriod = 30;
      }

      // Adjust payment amount based on history
      if (avgAmount > 0 && riskLevel !== 'high') {
        const suggestedAmount = (avgAmount + newPlan.totalAmount) / 2;
        suggestedPlan.totalAmount = Math.round(suggestedAmount);
      }

      // Calculate payment amount
      suggestedPlan.paymentAmount = suggestedPlan.totalAmount / suggestedPlan.numberOfPayments;

      // Generate explanation
      suggestedPlan.reason = `AI-Generated Payment Plan Suggestion

Based on analysis of:
- CRS Score: ${crsScore} (${crsScore >= 80 ? 'Excellent' : crsScore >= 70 ? 'Good' : 'Needs Improvement'})
- Payment Reliability: ${paymentReliability.toFixed(1)}%
- Average Payment Timing: ${avgDelay > 0 ? avgDelay.toFixed(1) + ' days late' : 'On time'}
- Risk Level: ${riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)}

Recommendation Rationale:
${crsScore >= 80 
  ? '✓ Strong credit score allows for flexible payment terms'
  : '⚠ Credit score suggests conservative payment terms'}
${paymentReliability >= 85
  ? '✓ Consistent payment history supports extended payment period'
  : '⚠ Payment history indicates need for shorter payment intervals'}
${riskLevel === 'low'
  ? '✓ Low risk profile enables more favorable terms'
  : riskLevel === 'medium'
    ? '⚠ Medium risk profile suggests balanced approach'
    : '⚠ High risk profile requires conservative terms'}

This plan balances payment flexibility with risk management based on historical performance.`;

      setEditedPlan(suggestedPlan);
      setIsEditing(true);
    } catch (error) {
      console.error('Error generating suggestion:', error);
      toast.error('Failed to generate payment plan suggestion');
    } finally {
      setGeneratingSuggestion(false);
    }
  };

  const handleAccept = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check for existing active payment plan
      const { data: existingPlan, error: checkError } = await supabase
        .from('Payment_plan')
        .select('id')
        .eq('liaison_id', liaisonId)
        .eq('status', 'active')
        .maybeSingle();

      if (checkError) throw checkError;

      // If there's an existing active plan, cancel it
      if (existingPlan) {
        const { error: updateError } = await supabase
          .from('Payment_plan')
          .update({ status: 'cancelled' })
          .eq('id', existingPlan.id);

        if (updateError) throw updateError;
      }

      // Create new payment plan entry
      const { data: newPaymentPlan, error: planError } = await supabase
        .from('Payment_plan')
        .insert({
          total_due: newPlan.totalAmount,
          payment_rate: newPlan.paymentPeriod,
          num_payment: newPlan.numberOfPayments,
          liaison_id: liaisonId,
          status: 'active',
          modified_by: user.id
        })
        .select()
        .single();

      if (planError) throw planError;

      // Send confirmation message
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          liaison_id: liaisonId,
          sender_id: user.id,
          content: "Payment plan accepted! The new payment schedule is now active.",
          is_read: false
        });

      if (messageError) throw messageError;

      setStatus('accepted');
    } catch (error) {
      console.error('Error accepting payment plan:', error);
      toast.error('Failed to accept payment plan');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Send rejection message
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          liaison_id: liaisonId,
          sender_id: user.id,
          content: "Payment plan rejected. The current payment schedule remains in effect.",
          is_read: false
        });

      if (messageError) throw messageError;

      setStatus('rejected');
    } catch (error) {
      console.error('Error rejecting payment plan:', error);
      toast.error('Failed to reject payment plan');
    } finally {
      setLoading(false);
    }
  };

  const handleCounterOffer = async () => {
    if (editedPlan.totalAmount <= 0) {
      toast.error('Total amount must be greater than 0');
      return;
    }

    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Send counter offer message
      const counterOfferMessage = {
        type: 'payment_plan_request',
        currentPlan: newPlan,
        newPlan: {
          ...editedPlan,
          liaisonId,
        },
      };

      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          liaison_id: liaisonId,
          sender_id: user.id,
          content: JSON.stringify(counterOfferMessage),
          is_read: false
        });

      if (messageError) throw messageError;

      setIsEditing(false);
      toast.success('Counter offer sent');
    } catch (error) {
      console.error('Error sending counter offer:', error);
      toast.error('Failed to send counter offer');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedPlan(newPlan);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 bg-indigo-50 border-b border-indigo-100">
        <h3 className="text-lg font-semibold text-indigo-900">
          Payment Plan Details
        </h3>
      </div>

      <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200">
        {/* Current Plan */}
        <div className="p-4">
          <h4 className="text-sm font-medium text-gray-500 mb-3">Current Plan</h4>
          <div className="space-y-3">
            <div className="flex items-center text-gray-600">
              <DollarSign className="h-5 w-5 mr-2 text-gray-400" />
              <div>
                <p className="text-sm">Total Amount</p>
                <p className="font-medium text-gray-900">
                  {formatCurrency(currentPlan.totalAmount)}
                </p>
              </div>
            </div>
            <div className="flex items-center text-gray-600">
              <Calendar className="h-5 w-5 mr-2 text-gray-400" />
              <div>
                <p className="text-sm">Payment Schedule</p>
                <p className="font-medium text-gray-900">
                  {currentPlan.numberOfPayments} payments of{' '}
                  {formatCurrency(currentPlan.paymentAmount || 0)}
                  <span className="text-sm text-gray-500">
                    {' '}every {currentPlan.paymentPeriod} days
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* New Plan */}
        <div className="p-4">
          {isEditing ? (
            <PaymentPlanCard
              {...editedPlan}
              isEditable={true}
              onChange={handlePlanChange}
            />
          ) : (
            <>
              <h4 className="text-sm font-medium text-gray-500 mb-3">New Plan</h4>
              <div className="space-y-3">
                <div className="flex items-center text-gray-600">
                  <DollarSign className="h-5 w-5 mr-2 text-gray-400" />
                  <div>
                    <p className="text-sm">Total Amount</p>
                    <p className="font-medium text-gray-900">
                      {formatCurrency(newPlan.totalAmount)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center text-gray-600">
                  <Calendar className="h-5 w-5 mr-2 text-gray-400" />
                  <div>
                    <p className="text-sm">Payment Schedule</p>
                    <p className="font-medium text-gray-900">
                      {newPlan.numberOfPayments} payments of{' '}
                      {formatCurrency(newPlan.paymentAmount || 0)}
                      <span className="text-sm text-gray-500">
                        {' '}every {newPlan.paymentPeriod} days
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Comments */}
      {(newPlan.reason || editedPlan.reason) && (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <h4 className="text-sm font-medium text-gray-500 mb-2">Comments</h4>
          <p className="text-gray-700 whitespace-pre-wrap">{isEditing ? editedPlan.reason : newPlan.reason}</p>
        </div>
      )}

      {/* Actions */}
      {status === 'pending' && isRecipient && (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="space-y-4">
            {/* Primary Actions Row */}
            <div className="flex justify-end space-x-3">
              {isEditing ? (
                <>
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 text-gray-600 hover:text-gray-900"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCounterOffer}
                    disabled={loading}
                    className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <ArrowRight className="h-5 w-5 mr-2" />
                        Send Counter Offer
                      </>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    <Edit2 className="h-5 w-5 mr-2" />
                    Counter Offer
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={loading}
                    className="flex items-center px-4 py-2 text-red-600 hover:text-red-700 border border-red-200 rounded-lg hover:bg-red-50"
                  >
                    <X className="h-5 w-5 mr-2" />
                    Reject
                  </button>
                  <button
                    onClick={handleAccept}
                    disabled={loading}
                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <Check className="h-5 w-5 mr-2" />
                        Accept
                      </>
                    )}
                  </button>
                </>
              )}
            </div>

            {/* AI Suggestion Button */}
            {!isEditing && (
              <button
                onClick={generateSuggestedPlan}
                disabled={generatingSuggestion}
                className="w-full flex items-center justify-center px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-blue-600 text-white rounded-lg hover:from-indigo-600 hover:to-blue-700 disabled:opacity-50 shadow-sm transition-all duration-200 group"
              >
                {generatingSuggestion ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="h-5 w-5 mr-2 group-hover:animate-pulse" />
                    Generate AI-Powered Counter Offer
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}