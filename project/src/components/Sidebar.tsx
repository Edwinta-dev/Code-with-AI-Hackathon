import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home,
  MessageSquare,
  FileText,
  TrendingUp,
  Store,
  LayoutDashboard,
} from 'lucide-react';
import LogoutButton from './LogoutButton';

const navItems = [
  { icon: Home, label: 'Home', path: '/client' },
  { icon: MessageSquare, label: 'Chat', path: '/client/chat' },
  { icon: FileText, label: 'Records', path: '/client/records' },
  { icon: TrendingUp, label: 'CRS Analysis', path: '/client/crs' },
  { icon: Store, label: 'Marketplace', path: '/client/marketplace' },
  { icon: LayoutDashboard, label: 'Dashboard', path: '/client/dashboard' },
];

export default function Sidebar() {
  return (
    <div className="w-64 bg-white h-screen fixed left-0 top-0 border-r border-gray-200 flex flex-col">
      <div className="p-6">
        <h2 className="text-2xl font-bold text-indigo-600">AccountFlow</h2>
      </div>
      <nav className="flex-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center px-6 py-3 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors duration-200 ${
                isActive ? 'bg-indigo-50 text-indigo-600' : ''
              }`
            }
          >
            <item.icon className="h-5 w-5 mr-3" />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-gray-200 mt-auto">
        <LogoutButton />
      </div>
    </div>
  );
}