import React, { useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import { Paperclip } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useUnreadMessages } from '../contexts/UnreadMessagesContext';
import PaymentPlanMessage from './PaymentPlanMessage';
import { PaymentPlanRequest } from '../types/paymentPlan';

interface ChatMessageProps {
  id: string;
  content: string;
  senderId: string;
  currentUserId: string | null;
  isRead: boolean;
  createdAt: string;
  documentUrl?: string;
  documentName?: string;
  onMessageRead?: () => void;
  liaisonId: string;
}

export default function ChatMessage({
  id,
  content,
  senderId,
  currentUserId,
  isRead,
  createdAt,
  documentUrl,
  documentName,
  onMessageRead,
  liaisonId
}: ChatMessageProps) {
  const { refreshUnreadCount } = useUnreadMessages();
  const { ref, inView } = useInView({
    threshold: 0.5,
    triggerOnce: true,
    delay: 500,
  });

  useEffect(() => {
    const updateMessageStatus = async () => {
      if (inView && !isRead && senderId !== currentUserId && currentUserId) {
        try {
          const { error } = await supabase
            .from('messages')
            .update({ is_read: true })
            .eq('id', id)
            .select()
            .single();

          if (error) {
            console.error('Error updating message status:', error);
            return;
          }

          await refreshUnreadCount();

          if (onMessageRead) {
            onMessageRead();
          }
        } catch (error) {
          console.error('Error in updateMessageStatus:', error);
        }
      }
    };

    updateMessageStatus();
  }, [inView, isRead, senderId, currentUserId, id, onMessageRead, refreshUnreadCount]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isCurrentUser = senderId === currentUserId;

  const renderContent = () => {
    if (documentUrl) {
      return (
        <a
          href={documentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center space-x-2 hover:underline"
        >
          <Paperclip className="h-4 w-4" />
          <span>{documentName}</span>
        </a>
      );
    }

    try {
      const parsedContent = JSON.parse(content) as PaymentPlanRequest;
      if (parsedContent.type === 'payment_plan_request') {
        return (
          <PaymentPlanMessage
            currentPlan={parsedContent.currentPlan}
            newPlan={parsedContent.newPlan}
            messageId={id}
            liaisonId={parsedContent.newPlan.liaisonId}
            senderId={senderId}
            currentUserId={currentUserId}
          />
        );
      }
    } catch (e) {
      // If content is not JSON or not a payment plan request, render as regular text
      return <p>{content}</p>;
    }

    return <p>{content}</p>;
  };

  return (
    <div
      ref={ref}
      className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[70%] rounded-lg p-3 ${
          isCurrentUser
            ? 'bg-indigo-600 text-white'
            : 'bg-white text-gray-900'
        }`}
      >
        {renderContent()}
        <div
          className={`text-xs mt-1 ${
            isCurrentUser ? 'text-indigo-200' : 'text-gray-500'
          }`}
        >
          <span>{formatTime(createdAt)}</span>
          {isRead && isCurrentUser && (
            <span className="ml-1">• Read</span>
          )}
        </div>
      </div>
    </div>
  );
}