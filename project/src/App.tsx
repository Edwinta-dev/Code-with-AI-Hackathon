import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import SignIn from './pages/auth/SignIn';
import SignUp from './pages/auth/SignUp';
import ClientLayout from './components/ClientLayout';
import AccountingFirmLayout from './components/AccountingFirmLayout';
import ClientHomePage from './pages/client/HomePage';
import ClientChatPage from './pages/client/ChatPage';
import ClientRecordsPage from './pages/client/RecordsPage';
import CRSAnalysisPage from './pages/client/CRSAnalysisPage';
import PaymentRenegotiationPage from './pages/client/PaymentRenegotiationPage';
import AccountingHomePage from './pages/accounting/HomePage';
import AccountingChatPage from './pages/accounting/ChatPage';
import AccountingAnalyticsPage from './pages/accounting/AnalyticsPage';
import SettingsPage from './pages/settings/SettingsPage';
import TopNavigation from './components/TopNavigation';
import ChatNotificationProvider from './components/ChatNotification';
import { UnreadMessagesProvider } from './contexts/UnreadMessagesContext';
import { Toaster } from 'react-hot-toast';

const accountingNavItems = [
  { path: '/accounting', label: 'Home' },
  { path: '/accounting/chat', label: 'Chat' },
  { path: '/accounting/analytics', label: 'Analytics' },
  { path: '/settings', label: 'Settings' },
];

const clientNavItems = [
  { path: '/client', label: 'Home' },
  { path: '/client/chat', label: 'Chat' },
  { path: '/client/records', label: 'Records' },
  { path: '/client/crs', label: 'CRS Analysis' },
  { path: '/settings', label: 'Settings' },
];

// Redirect component to handle navigation from payment renegotiation
function PaymentChatRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    // Check if we're coming from the payment renegotiation page
    if (location.state?.fromPaymentRenegotiation) {
      // You can pass additional state here if needed
      navigate('/client/chat', { 
        state: { 
          autoOpenChat: true,
          ...location.state 
        }
      });
    }
  }, [navigate, location]);

  return null;
}

function App() {
  return (
    <BrowserRouter>
      <UnreadMessagesProvider>
        <ChatNotificationProvider />
        <Toaster position="top-right" />
        <AnimatePresence mode="wait">
          <Routes>
            {/* Auth Routes */}
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />

            {/* Client Routes */}
            <Route
              path="/client"
              element={
                <>
                  <TopNavigation items={clientNavItems} userType="client" />
                  <ClientLayout />
                </>
              }
            >
              <Route index element={<ClientHomePage />} />
              <Route path="chat" element={<ClientChatPage />} />
              <Route path="records" element={<ClientRecordsPage />} />
              <Route path="crs" element={<CRSAnalysisPage />} />
              <Route path="payment/renegotiate" element={<PaymentRenegotiationPage />} />
            </Route>

            {/* Accounting Routes */}
            <Route
              path="/accounting"
              element={
                <>
                  <TopNavigation items={accountingNavItems} userType="accounting" />
                  <AccountingFirmLayout />
                </>
              }
            >
              <Route index element={<AccountingHomePage />} />
              <Route path="chat" element={<AccountingChatPage />} />
              <Route path="analytics" element={<AccountingAnalyticsPage />} />
            </Route>

            {/* Settings Route (accessible from both client and accounting layouts) */}
            <Route
              path="/settings"
              element={
                <>
                  <TopNavigation
                    items={window.location.pathname.includes('/accounting')
                      ? accountingNavItems
                      : clientNavItems}
                    userType={window.location.pathname.includes('/accounting')
                      ? 'accounting'
                      : 'client'}
                  />
                  <SettingsPage />
                </>
              }
            />

            {/* Payment Chat Redirect */}
            <Route path="/payment-chat-redirect" element={<PaymentChatRedirect />} />

            {/* Redirect root to signin */}
            <Route path="/" element={<Navigate to="/signin" />} />
          </Routes>
        </AnimatePresence>
      </UnreadMessagesProvider>
    </BrowserRouter>
  );
}

export default App;