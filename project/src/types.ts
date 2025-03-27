export type UserRole = 'client' | 'accounting_firm';

export interface User {
  companyName: string;
  email: string;
  role: UserRole;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

export interface Payment {
  id: string;
  amount: number;
  dueDate: string;
  status: 'pending' | 'paid' | 'overdue';
  description: string;
}

export interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: string;
  isRead: boolean;
}

export interface CreditScore {
  score: number;
  paymentHistory: number;
  communicationScore: number;
  lastUpdated: string;
}

export interface AccountingFirm {
  id: string;
  name: string;
  specialization: string;
  size: 'small' | 'medium' | 'large';
  rating: number;
}

export interface Client {
  id: string;
  companyName: string;
  email: string;
  phone: string;
  creditScore: number;
  totalOutstanding: number;
  lastPayment: string;
  status: 'active' | 'inactive';
}