import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Send, Paperclip, Phone, Mail, Loader2 } from 'lucide-react';
import { sendChatNotificationEmail } from '../../lib/emailService';
import ChatMessage from '../../components/ChatMessage';
import { showChatNotification } from '../../components/ChatNotification';
import { uploadFile, STORAGE_BUCKETS, generateFilePath, MAX_FILE_SIZE } from '../../lib/storage';
import toast from 'react-hot-toast';

interface Accountant {
  id: string;
  name: string;
  contact: {
    id: string;
    fullName: string;
    email: string;
    phoneNumber: string;
  };
  relationshipStatus: 'pending' | 'verified' | 'established';
  unreadCount: number;
}

interface Message {
  id: string;
  content: string;
  senderId: string;
  isRead: boolean;
  createdAt: string;
  documentUrl?: string;
  documentName?: string;
  liaisonId: string;
}

export default function ChatPage() {
  const location = useLocation();
  const [accountants, setAccountants] = useState<Accountant[]>([]);
  const [selectedAccountant, setSelectedAccountant] = useState<Accountant | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    fetchAccountants().then(() => {
      // After fetching accountants, check for selectedLiaisonId in location state
      const selectedLiaisonId = location.state?.selectedLiaisonId;
      if (selectedLiaisonId) {
        const accountant = accountants.find(acc => acc.contact.id === selectedLiaisonId);
        if (accountant) {
          setSelectedAccountant(accountant);
        }
      }
    });
  }, []);

  useEffect(() => {
    if (selectedAccountant) {
      fetchMessages(selectedAccountant.contact.id);

      const messageSubscription = supabase
        .channel(`messages:${selectedAccountant.contact.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: `liaison_id=eq.${selectedAccountant.contact.id}`
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              const newMessage = {
                id: payload.new.id,
                content: payload.new.content,
                senderId: payload.new.sender_id,
                isRead: payload.new.is_read,
                createdAt: payload.new.created_at,
                documentUrl: payload.new.document_url,
                documentName: payload.new.document_name,
                liaisonId: payload.new.liaison_id,
              };
              setMessages(prev => [...prev, newMessage]);
              scrollToBottom();

              if (payload.new.sender_id !== currentUserId) {
                showChatNotification({
                  senderName: selectedAccountant.name,
                  message: payload.new.content,
                });
              }
            } else if (payload.eventType === 'UPDATE') {
              setMessages(prev => prev.map(msg => 
                msg.id === payload.new.id 
                  ? { ...msg, isRead: payload.new.is_read }
                  : msg
              ));
            }
          }
        )
        .subscribe();

      return () => {
        messageSubscription.unsubscribe();
      };
    }
  }, [selectedAccountant, currentUserId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleMessageRead = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('id', messageId);

      if (error) throw error;

      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, isRead: true } : msg
      ));

      if (selectedAccountant) {
        setUnreadCounts(prev => ({
          ...prev,
          [selectedAccountant.contact.id]: Math.max(0, (prev[selectedAccountant.contact.id] || 0) - 1),
        }));
      }
    } catch (error) {
      console.error('Error updating message read status:', error);
    }
  };

  const fetchAccountants = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (userError) throw userError;

      const { data: relationships, error: relationshipsError } = await supabase
        .from('company_relationships')
        .select(`
          id,
          verification_status,
          accounting_firm:accounting_firm_id (
            id,
            name
          ),
          liaisons (
            id,
            accountant:accountant_id (
              id,
              full_name,
              email,
              phone_number
            )
          )
        `)
        .eq('client_firm_id', userData.company_id)
        .in('verification_status', ['verified', 'established']);

      if (relationshipsError) throw relationshipsError;

      if (!relationships || relationships.length === 0) {
        setAccountants([]);
        setLoading(false);
        return;
      }

      // Get unread counts for each liaison
      const unreadCountsPromises = relationships.map(async (rel: any) => {
        const { data: unreadMessages, error: countError } = await supabase
          .from('messages')
          .select('id', { count: 'exact' })
          .eq('liaison_id', rel.liaisons[0].id)
          .eq('is_read', false)
          .neq('sender_id', user.id);

        if (countError) throw countError;
        return { liaisonId: rel.liaisons[0].id, count: unreadMessages.length };
      });

      const unreadCountsResults = await Promise.all(unreadCountsPromises);
      const newUnreadCounts = unreadCountsResults.reduce((acc, { liaisonId, count }) => ({
        ...acc,
        [liaisonId]: count
      }), {});

      setUnreadCounts(newUnreadCounts);

      const formattedAccountants = relationships
        .map((rel: any) => ({
          id: rel.accounting_firm.id,
          name: rel.accounting_firm.name,
          contact: {
            id: rel.liaisons[0].id,
            fullName: rel.liaisons[0].accountant.full_name,
            email: rel.liaisons[0].accountant.email,
            phoneNumber: rel.liaisons[0].accountant.phone_number,
          },
          relationshipStatus: rel.verification_status,
          unreadCount: newUnreadCounts[rel.liaisons[0].id] || 0,
        }));

      setAccountants(formattedAccountants);

      // Auto-select the accountant if we have a selectedLiaisonId
      const selectedLiaisonId = location.state?.selectedLiaisonId;
      if (selectedLiaisonId) {
        const accountant = formattedAccountants.find(acc => acc.contact.id === selectedLiaisonId);
        if (accountant) {
          setSelectedAccountant(accountant);
        }
      } else if (formattedAccountants.length > 0 && !selectedAccountant) {
        setSelectedAccountant(formattedAccountants[0]);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching accountants:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch accountants');
      setLoading(false);
    }
  };

  const fetchMessages = async (liaisonId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('liaison_id', liaisonId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const formattedMessages = data.map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        senderId: msg.sender_id,
        isRead: msg.is_read,
        createdAt: msg.created_at,
        documentUrl: msg.document_url,
        documentName: msg.document_name,
        liaisonId: msg.liaison_id,
      }));

      setMessages(formattedMessages);

      // Update unread count
      const unreadCount = data.filter((msg: any) => 
        !msg.is_read && msg.sender_id !== currentUserId
      ).length;

      setUnreadCounts(prev => ({
        ...prev,
        [liaisonId]: unreadCount,
      }));
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedAccountant) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const messageData = {
        liaison_id: selectedAccountant.contact.id,
        sender_id: user.id,
        content: newMessage.trim(),
        is_read: false,
      };

      const { error } = await supabase
        .from('messages')
        .insert(messageData);

      if (error) throw error;

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedAccountant) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (file.size > MAX_FILE_SIZE) {
        throw new Error('File size exceeds maximum limit of 50MB');
      }

      const filePath = generateFilePath(user.id, file.name);

      const { url: fileUrl } = await uploadFile(
        STORAGE_BUCKETS.CHAT_DOCUMENTS,
        file,
        filePath
      );

      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          liaison_id: selectedAccountant.contact.id,
          sender_id: user.id,
          content: `Shared document: ${file.name}`,
          document_url: fileUrl,
          document_name: file.name,
          is_read: false,
        });

      if (messageError) throw messageError;
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload file');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (accountants.length === 0) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Active Connections</h2>
          <p className="text-gray-600">
            You'll be able to chat with your accountant once they verify the connection.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Accountant List Sidebar */}
      <div className="w-1/3 border-r border-gray-200 bg-white">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Your Accountants</h2>
        </div>
        <div className="overflow-y-auto h-[calc(100%-4rem)]">
          {accountants.map(accountant => (
            <button
              key={accountant.id}
              onClick={() => setSelectedAccountant(accountant)}
              className={`w-full p-4 text-left hover:bg-gray-50 transition-colors duration-200 ${
                selectedAccountant?.id === accountant.id ? 'bg-indigo-50' : ''
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium text-gray-900">{accountant.name}</h3>
                  <p className="text-sm text-gray-500">{accountant.contact.fullName}</p>
                </div>
                {unreadCounts[accountant.contact.id] > 0 && (
                  <span className="bg-indigo-600 text-white text-xs px-2 py-1 rounded-full">
                    {unreadCounts[accountant.contact.id]}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {selectedAccountant ? (
          <>
            {/* Accountant Info Banner */}
            <div className="bg-white border-b border-gray-200 p-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {selectedAccountant.name}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {selectedAccountant.contact.fullName}
                  </p>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => window.location.href = `mailto:${selectedAccountant.contact.email}`}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors duration-200"
                    title={selectedAccountant.contact.email}
                  >
                    <Mail className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => window.location.href = `tel:${selectedAccountant.contact.phoneNumber}`}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors duration-200"
                    title={selectedAccountant.contact.phoneNumber}
                  >
                    <Phone className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-4">
                {messages.map(message => (
                  <ChatMessage
                    key={message.id}
                    {...message}
                    currentUserId={currentUserId}
                    onMessageRead={() => handleMessageRead(message.id)}
                    liaisonId={selectedAccountant.contact.id}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Message Input */}
            <div className="bg-white border-t border-gray-200 p-4">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-shrink-0 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors duration-200"
                  title="Attach file"
                >
                  <Paperclip className="h-5 w-5" />
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  className="flex-shrink-0 p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            Select an accountant to start chatting
          </div>
        )}
      </div>
    </div>
  );
}