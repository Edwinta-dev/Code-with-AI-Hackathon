import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface UnreadMessagesContextType {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
}

const UnreadMessagesContext = createContext<UnreadMessagesContextType | undefined>(undefined);

export function UnreadMessagesProvider({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get all liaisons where the current user is either the accountant or client
      const { data: liaisons, error: liaisonsError } = await supabase
        .from('liaisons')
        .select('id, accountant_id, client_id')
        .or(`accountant_id.eq.${user.id},client_id.eq.${user.id}`);

      if (liaisonsError) {
        console.error('Error fetching liaisons:', liaisonsError);
        return;
      }

      if (!liaisons?.length) {
        setUnreadCount(0);
        return;
      }

      // Get unread messages where the current user is the recipient
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('id, sender_id')
        .in('liaison_id', liaisons.map(l => l.id))
        .eq('is_read', false)
        .neq('sender_id', user.id);

      if (messagesError) {
        console.error('Error fetching unread messages:', messagesError);
        return;
      }

      // Filter messages to only count those where the current user is the intended recipient
      const validUnreadMessages = messages.filter(msg => {
        const liaison = liaisons.find(l => 
          (l.accountant_id === user.id && l.client_id === msg.sender_id) ||
          (l.client_id === user.id && l.accountant_id === msg.sender_id)
        );
        return liaison !== undefined;
      });

      setUnreadCount(validUnreadMessages.length);
    } catch (error) {
      console.error('Error in fetchUnreadCount:', error);
    }
  };

  useEffect(() => {
    fetchUnreadCount();

    // Subscribe to message changes
    const subscription = supabase
      .channel('message_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            await fetchUnreadCount();
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <UnreadMessagesContext.Provider value={{ unreadCount, refreshUnreadCount: fetchUnreadCount }}>
      {children}
    </UnreadMessagesContext.Provider>
  );
}

export function useUnreadMessages() {
  const context = useContext(UnreadMessagesContext);
  if (context === undefined) {
    throw new Error('useUnreadMessages must be used within an UnreadMessagesProvider');
  }
  return context;
}