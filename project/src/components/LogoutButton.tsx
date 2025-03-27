import React from 'react';
import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function LogoutButton() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Clear any local storage or state if needed
      navigate('/signin');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <button
      onClick={handleLogout}
      className="flex items-center px-6 py-3 text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors duration-200"
    >
      <LogOut className="h-5 w-5 mr-3" />
      <span className="font-medium">Logout</span>
    </button>
  );
}