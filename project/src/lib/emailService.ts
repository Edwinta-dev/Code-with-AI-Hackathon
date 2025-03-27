import { supabase } from './supabase';

interface EmailData {
  recipientEmail: string;
  senderCompany: string;
  senderName: string;
  message: string;
  senderEmail: string;
  senderPhone: string;
}

export const sendChatNotificationEmail = async ({
  recipientEmail,
  senderCompany,
  senderName,
  message,
  senderEmail,
  senderPhone
}: EmailData) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }

    const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`;
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        to: recipientEmail,
        subject: `New message from ${senderCompany}`,
        senderCompany,
        senderName,
        message,
        senderEmail,
        senderPhone
      })
    });

    if (!response.ok) {
      // For now, just log the error but don't block the message from being sent
      console.error('Failed to send email notification:', await response.text());
      return;
    }

    return await response.json();
  } catch (error) {
    // Log the error but don't block the message from being sent
    console.error('Error sending email notification:', error);
    return;
  }
};