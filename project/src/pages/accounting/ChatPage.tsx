import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Send, Paperclip, Phone, Mail, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { sendChatNotificationEmail } from '../../lib/emailService';
import ChatMessage from '../../components/ChatMessage';
import { showChatNotification } from '../../components/ChatNotification';
import { uploadFile, STORAGE_BUCKETS, generateFilePath, MAX_FILE_SIZE } from '../../lib/storage';
import toast from 'react-hot-toast';

interface Client {
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

interface ReminderLevel {
  id: 'friendly' | 'approaching' | 'overdue' | 'urgent';
  title: string;
  description: string;
  color: string;
  icon: string;
  daysBeforeDue: number;
  crsThreshold: number;
}

const REMINDER_LEVELS: ReminderLevel[] = [
  {
    id: 'friendly',
    title: 'Friendly Reminder',
    description: 'For high CRS clients, sent well in advance',
    color: 'green',
    icon: '✓',
    daysBeforeDue: 7,
    crsThreshold: 85
  },
  {
    id: 'approaching',
    title: 'Payment Approaching',
    description: 'Standard reminder for good standing clients',
    color: 'blue',
    icon: '📅',
    daysBeforeDue: 5,
    crsThreshold: 75
  },
  {
    id: 'overdue',
    title: 'Payment Overdue',
    description: 'For missed payments, professional tone',
    color: 'orange',
    icon: '⚠️',
    daysBeforeDue: 0,
    crsThreshold: 65
  },
  {
    id: 'urgent',
    title: 'Urgent Action Required',
    description: 'For significantly overdue payments',
    color: 'red',
    icon: '❗',
    daysBeforeDue: -7,
    crsThreshold: 0
  }
];

export default function ChatPage() {
  const location = useLocation();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [isReminderOpen, setIsReminderOpen] = useState(false);
  const [generatingReminder, setGeneratingReminder] = useState(false);

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
    fetchClients().then(() => {
      const selectedLiaisonId = location.state?.selectedLiaisonId;
      if (selectedLiaisonId) {
        const client = clients.find(c => c.contact.id === selectedLiaisonId);
        if (client) {
          setSelectedClient(client);
        }
      }
    });
  }, []);

  useEffect(() => {
    if (selectedClient) {
      fetchMessages(selectedClient.contact.id);

      const messageSubscription = supabase
        .channel(`messages:${selectedClient.contact.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: `liaison_id=eq.${selectedClient.contact.id}`
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
                  senderName: selectedClient.name,
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
  }, [selectedClient, currentUserId]);

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

      if (selectedClient) {
        setUnreadCounts(prev => ({
          ...prev,
          [selectedClient.contact.id]: Math.max(0, (prev[selectedClient.contact.id] || 0) - 1),
        }));
      }
    } catch (error) {
      console.error('Error updating message read status:', error);
    }
  };

  const fetchClients = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: liaisons, error: liaisonsError } = await supabase
        .from('liaisons')
        .select(`
          id,
          company_relationship:company_relationships(
            client_firm:client_firm_id(id, name),
            verification_status
          ),
          client:client_id(id, full_name, email, phone_number)
        `)
        .eq('accountant_id', user.id);

      if (liaisonsError) throw liaisonsError;

      const unreadCountsPromises = liaisons.map(async (liaison: any) => {
        const { data: unreadMessages, error: countError } = await supabase
          .from('messages')
          .select('id', { count: 'exact' })
          .eq('liaison_id', liaison.id)
          .eq('is_read', false)
          .neq('sender_id', user.id);

        if (countError) throw countError;
        return { liaisonId: liaison.id, count: unreadMessages.length };
      });

      const unreadCountsResults = await Promise.all(unreadCountsPromises);
      const newUnreadCounts = unreadCountsResults.reduce((acc, { liaisonId, count }) => ({
        ...acc,
        [liaisonId]: count
      }), {});

      setUnreadCounts(newUnreadCounts);

      const formattedClients = liaisons
        .filter((liaison: any) => 
          liaison.company_relationship?.verification_status === 'verified' || 
          liaison.company_relationship?.verification_status === 'established'
        )
        .map((liaison: any) => ({
          id: liaison.company_relationship.client_firm.id,
          name: liaison.company_relationship.client_firm.name,
          contact: {
            id: liaison.id,
            fullName: liaison.client.full_name,
            email: liaison.client.email,
            phoneNumber: liaison.client.phone_number,
          },
          unreadCount: newUnreadCounts[liaison.id] || 0,
        }));

      setClients(formattedClients);

      const selectedLiaisonId = location.state?.selectedLiaisonId;
      if (selectedLiaisonId) {
        const client = formattedClients.find(c => c.contact.id === selectedLiaisonId);
        if (client) {
          setSelectedClient(client);
        }
      } else if (formattedClients.length > 0 && !selectedClient) {
        setSelectedClient(formattedClients[0]);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching clients:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch clients');
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
    if (!newMessage.trim() || !selectedClient) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const messageData = {
        liaison_id: selectedClient.contact.id,
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
    if (!file || !selectedClient) return;

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
          liaison_id: selectedClient.contact.id,
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

  const generateAIReminder = async (client: Client) => {
    try {
      setGeneratingReminder(true);

      // Get client's payment data
      const { data: transactions, error: transactionError } = await supabase
        .from('transactions')
        .select(`
          amount,
          due_date,
          status,
          payment_type,
          payment_number,
          payment_consistency_score,
          risk_level
        `)
        .eq('status', 'pending')
        .order('due_date', { ascending: true })
        .limit(1);

      if (transactionError) throw transactionError;

      // Get client's CRS score
      const { data: liaison, error: liaisonError } = await supabase
        .from('liaisons')
        .select('crs_score')
        .eq('id', client.contact.id)
        .single();

      if (liaisonError) throw liaisonError;

      const crsScore = liaison.crs_score;
      const transaction = transactions?.[0];

      if (!transaction) {
        toast.error('No pending payments found');
        return;
      }

      // Determine reminder level based on CRS score and due date
      const daysUntilDue = Math.ceil(
        (new Date(transaction.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );

      let reminderLevel: ReminderLevel;
      if (daysUntilDue > 5 && crsScore >= 85) {
        reminderLevel = REMINDER_LEVELS[0]; // Friendly
      } else if (daysUntilDue > 0 && crsScore >= 75) {
        reminderLevel = REMINDER_LEVELS[1]; // Approaching
      } else if (daysUntilDue > -7) {
        reminderLevel = REMINDER_LEVELS[2]; // Overdue
      } else {
        reminderLevel = REMINDER_LEVELS[3]; // Urgent
      }

      // Generate personalized message
      const message = generatePersonalizedMessage(
        client.contact.fullName,
        transaction,
        reminderLevel,
        crsScore
      );

      setNewMessage(message);
      setIsReminderOpen(false);
    } catch (error) {
      console.error('Error generating reminder:', error);
      toast.error('Failed to generate reminder');
    } finally {
      setGeneratingReminder(false);
    }
  };

  const generatePersonalizedMessage = (
    clientName: string,
    transaction: any,
    level: ReminderLevel,
    crsScore: number
  ): string => {
    const dueDate = new Date(transaction.due_date).toLocaleDateString();
    const amount = transaction.amount.toLocaleString();
    const isOverdue = new Date(transaction.due_date) < new Date();

    const greetings = [
      'Hi',
      'Hello',
      'Good day',
      'Greetings'
    ];

    const greeting = greetings[Math.floor(Math.random() * greetings.length)];
    const firstName = clientName.split(' ')[0];

    switch (level.id) {
      case 'friendly':
        return `${greeting} ${firstName},

I hope this message finds you well! Just a friendly reminder about the upcoming payment of $${amount} due on ${dueDate}. 

Your excellent payment history is greatly appreciated, and we're happy to continue providing our services to valued clients like you.

Best regards`;

      case 'approaching':
        return `${greeting} ${firstName},

This is a courtesy reminder that a payment of $${amount} is due on ${dueDate}.

Please ensure the payment is processed before the due date to maintain your good standing. If you have any questions, don't hesitate to reach out.

Thank you for your attention to this matter.

Best regards`;

      case 'overdue':
        return `${greeting} ${firstName},

I'm writing to bring to your attention that the payment of $${amount} was due on ${dueDate}. 

Please process this payment as soon as possible to avoid any impact on your credit score. If you're experiencing any difficulties, we're happy to discuss payment arrangements.

Thank you for your prompt attention to this matter.

Regards`;

      case 'urgent':
        return `Dear ${clientName},

This is an urgent notice regarding the overdue payment of $${amount} from ${dueDate}.

Immediate action is required to process this payment and prevent any further impact on your account standing. If you're facing any challenges, please contact us immediately to discuss payment options.

Your immediate attention to this matter is greatly appreciated.

Regards`;

      default:
        return `${greeting} ${firstName},

This is a reminder about the payment of $${amount} due on ${dueDate}.

Please ensure timely payment to maintain your account in good standing.

Thank you for your attention to this matter.

Best regards`;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Active Connections</h2>
          <p className="text-gray-600">
            You'll be able to chat with your clients once they verify the connection.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Client List Sidebar */}
      <div className="w-1/3 border-r border-gray-200 bg-white">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Your Clients</h2>
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
                  <p className="text-sm text-gray-500">{client.contact.fullName}</p>
                </div>
                {unreadCounts[client.contact.id] > 0 && (
                  <span className="bg-indigo-600 text-white text-xs px-2 py-1 rounded-full">
                    {unreadCounts[client.contact.id]}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {selectedClient ? (
          <>
            {/* Client Info Banner */}
            <div className="bg-white border-b border-gray-200 p-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {selectedClient.name}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {selectedClient.contact.fullName}
                  </p>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => window.location.href = `mailto:${selectedClient.contact.email}`}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors duration-200"
                    title={selectedClient.contact.email}
                  >
                    <Mail className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => window.location.href = `tel:${selectedClient.contact.phoneNumber}`}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors duration-200"
                    title={selectedClient.contact.phoneNumber}
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
                    liaisonId={selectedClient.contact.id}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Message Input */}
            <div className="bg-white border-t border-gray-200 p-4">
              <div className="space-y-4">
                {/* AI Reminder Button */}
                {selectedClient && (
                  <button
                    onClick={() => generateAIReminder(selectedClient)}
                    disabled={generatingReminder}
                    className="w-full flex items-center justify-center px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-blue-600 text-white rounded-lg hover:from-indigo-600 hover:to-blue-700 disabled:opacity-50 shadow-sm transition-all duration-200 group"
                  >
                    {generatingReminder ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="h-5 w-5 mr-2 group-hover:animate-pulse" />
                        Generate AI Payment Reminder
                      </>
                    )}
                  </button>
                )}

                {/* Message Input */}
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
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            Select a client to start chatting
          </div>
        )}
      </div>
    </div>
  );
}