import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { SmtpClient } from 'https://deno.land/x/smtp@v0.7.0/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const client = new SmtpClient();

    // Configure SMTP connection
    await client.connectTLS({
      hostname: 'smtp.gmail.com',
      port: 465,
      username: 'yeroccountingservice@gmail.com',
      password: 'qwerty12345' // Note: Use app-specific password in production
    });

    const { to, subject, senderCompany, senderName, message, senderEmail, senderPhone } = await req.json();

    // Validate required fields
    if (!to || !subject || !message) {
      throw new Error('Missing required fields');
    }

    // Create HTML email content
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">New Message from ${senderCompany}</h2>
        <p style="color: #374151; font-size: 16px; line-height: 1.5;">
          ${message}
        </p>
        <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #E5E7EB;">
          <h3 style="color: #111827; font-size: 18px;">Sender Details:</h3>
          <p style="color: #374151; margin: 8px 0;">
            <strong>Name:</strong> ${senderName}<br>
            <strong>Email:</strong> ${senderEmail}<br>
            <strong>Phone:</strong> ${senderPhone}<br>
            <strong>Company:</strong> ${senderCompany}
          </p>
        </div>
      </div>
    `;

    try {
      // Send email
      await client.send({
        from: 'yeroccountingservice@gmail.com',
        to: to,
        subject: subject,
        content: 'This is a HTML email.',
        html: htmlBody,
      });

      await client.close();

      return new Response(
        JSON.stringify({ message: 'Email sent successfully' }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      );
    } catch (emailError) {
      console.error('SMTP Error:', emailError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send email. SMTP error occurred.' 
        }),
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }
  } catch (error) {
    console.error('General Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to send email' 
      }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  }
});