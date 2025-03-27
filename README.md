# Code-with-AI-Hackathon


Yero is an AI-powered accounting system designed for accounting firms and financial professionals. It streamlines invoice tracking, automated follow-ups, risk classification, and real-time client communication via chat and email.

 
 Features
- Invoice Tracking & Automation
– Track invoices, automate follow-ups, and manage client payments.
- AI-Powered Payment Risk Classifier
- Uses machine learning to assess client payment risks.
- Real-time Chat (Supabase & React Context)
- Supabase Integration
- Serverless PostgreSQL database with real-time updates

🛠️ Tech Stack

Technology


React (TypeScript): Frontend framework for modular UI development

Vite: Build tool for fast development & optimized production

Tailwind CSS: Utility-first CSS for rapid and responsive UI design

Supabase (PostgreSQL-based): Serverless database with authentication and real-time features

React Context API: State management for global application state

Framer Motion: Smooth UI animations

Lucide React: Icon set for consistent UI

Recharts: Data visualization for reports

Supabase Edge Functions: Serverless backend operations

Getting Started

1. Clone the Repository

git clone https://github.com/Edwinta-dev/Code-with-AI-Hackathon.git

2. Install Dependencies

npm install

3. Set Up Environment Variables

Create a .env.local file and add the following:

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Gmail API
GMAIL_CLIENT_ID=your_client_id
GMAIL_CLIENT_SECRET=your_client_secret
GMAIL_REFRESH_TOKEN=your_refresh_token
GMAIL_SENDER_EMAIL=your_dummy_email@gmail.com

4. Run the Development Server

npm run dev

Open http://localhost:3000 in your browser.
