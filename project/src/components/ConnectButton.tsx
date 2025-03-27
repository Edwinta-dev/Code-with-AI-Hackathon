import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ConnectButtonProps {
  relationshipId: string;
  initialStatus: 'pending' | 'verified' | 'established';
  userType: 'client' | 'accountant';
  initiatedBy: 'client' | 'accountant';
  onStatusChange?: () => void;
}

export default function ConnectButton({
  relationshipId,
  initialStatus,
  userType,
  initiatedBy,
  onStatusChange,
}: ConnectButtonProps) {
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const subscription = supabase
      .channel(`relationship:${relationshipId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'company_relationships',
          filter: `id=eq.${relationshipId}`,
        },
        (payload: any) => {
          const newStatus = payload.new.verification_status;
          setStatus(newStatus);
          if (onStatusChange) onStatusChange();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [relationshipId, onStatusChange]);

  const handleConnect = async () => {
    if (loading || status === 'established') return;

    setLoading(true);
    setError(null);

    try {
      // Get the liaison ID for this relationship
      const { data: liaison, error: liaisonError } = await supabase
        .from('liaisons')
        .select('id')
        .eq('company_relationship_id', relationshipId)
        .single();

      if (liaisonError) throw liaisonError;

      // Update the payment plan status to active
      const { error: paymentPlanError } = await supabase
        .from('Payment_plan')
        .update({ status: 'active' })
        .eq('liaison_id', liaison.id)
        .eq('status', 'pending');

      if (paymentPlanError) throw paymentPlanError;

      // Update relationship status
      const { error: updateError } = await supabase
        .from('company_relationships')
        .update({ verification_status: 'verified' })
        .eq('id', relationshipId);

      if (updateError) throw updateError;

      setStatus('verified');
      if (onStatusChange) onStatusChange();
    } catch (err) {
      console.error('Error updating connection status:', err);
      setError(err instanceof Error ? err.message : 'Failed to update connection status');
    } finally {
      setLoading(false);
    }
  };

  // Show different button states based on status and user type
  const renderButton = () => {
    // If the user initiated the connection, they should wait for the other party
    if (userType === initiatedBy) {
      return (
        <div className="w-full px-4 py-2 bg-gray-100 text-gray-500 rounded-lg font-medium text-center">
          {status === 'pending' ? 'Waiting for Response' : 
           status === 'verified' ? 'Connection Verified' : 
           'Connection Established'}
        </div>
      );
    }

    // If the user didn't initiate and status is pending, show accept button
    if (status === 'pending') {
      return (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleConnect}
          disabled={loading}
          className={`
            w-full px-4 py-2 rounded-lg font-medium
            ${loading ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'}
            text-white transition-colors duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
            flex items-center justify-center
          `}
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            'Accept Connection'
          )}
        </motion.button>
      );
    }

    // For verified or established status
    return (
      <div className="w-full px-4 py-2 bg-green-100 text-green-700 rounded-lg font-medium text-center flex items-center justify-center">
        <CheckCircle2 className="h-5 w-5 mr-2" />
        {status === 'verified' ? 'Connection Verified' : 'Connection Established'}
      </div>
    );
  };

  return (
    <div>
      {renderButton()}

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 flex items-center text-sm text-red-600"
        >
          <AlertCircle className="h-4 w-4 mr-1" />
          {error}
        </motion.div>
      )}
    </div>
  );
}