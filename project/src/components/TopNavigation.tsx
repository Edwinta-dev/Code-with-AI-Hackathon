import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useUnreadMessages } from '../contexts/UnreadMessagesContext';

interface NavItem {
  path: string;
  label: string;
}

interface TopNavigationProps {
  items: NavItem[];
  userType: 'client' | 'accounting';
}

export default function TopNavigation({ items, userType }: TopNavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { unreadCount } = useUnreadMessages();

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate('/signin');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-50"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14">
            <div className="flex items-center">
              <motion.h1
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-2xl font-bold text-indigo-600"
              >
                Yero
              </motion.h1>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              {items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `relative px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                      isActive ? 'text-indigo-600' : 'text-gray-600 hover:text-indigo-600'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <div className="relative inline-flex items-center">
                      {item.label === 'Settings' ? (
                        <Settings className="h-5 w-5" />
                      ) : (
                        item.label
                      )}
                      {item.label === 'Chat' && unreadCount > 0 && (
                        <span className="absolute -top-2 -right-6 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
                          {unreadCount}
                        </span>
                      )}
                      {isActive && (
                        <motion.div
                          layoutId="underline"
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600"
                        />
                      )}
                    </div>
                  )}
                </NavLink>
              ))}
              <button
                onClick={handleLogout}
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-red-600 transition-colors duration-200"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </button>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="text-gray-600 hover:text-gray-900 focus:outline-none"
              >
                {isOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed inset-0 z-40 md:hidden"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" onClick={() => setIsOpen(false)} />
            <motion.nav
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween' }}
              className="fixed top-14 right-0 bottom-0 w-64 bg-white shadow-xl"
            >
              <div className="flex flex-col h-full py-6">
                {items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsOpen(false)}
                    className={({ isActive }) =>
                      `px-6 py-3 text-base font-medium transition-colors duration-200 ${
                        isActive
                          ? 'text-indigo-600 bg-indigo-50'
                          : 'text-gray-600 hover:text-indigo-600 hover:bg-gray-50'
                      }`
                    }
                  >
                    <div className="relative inline-flex items-center">
                      {item.label === 'Settings' ? (
                        <>
                          <Settings className="h-5 w-5 mr-2" />
                          {item.label}
                        </>
                      ) : (
                        item.label
                      )}
                      {item.label === 'Chat' && unreadCount > 0 && (
                        <span className="absolute -top-2 -right-6 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                  </NavLink>
                ))}
                <button
                  onClick={handleLogout}
                  className="mt-auto mx-6 flex items-center px-3 py-2 text-base font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                >
                  <LogOut className="h-5 w-5 mr-2" />
                  Logout
                </button>
              </div>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spacer to prevent content from going under the fixed navbar */}
      <div className="h-14" />
    </>
  );
}