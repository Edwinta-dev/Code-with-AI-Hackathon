import { Database } from './supabase';

export interface PaymentPlan {
  type: 'installment' | 'lumpsum';
  totalAmount: number;
  paymentPeriod: number;
  numberOfPayments: number;
  paymentAmount?: number;
  reason?: string;
}

export interface PaymentPlanRequest {
  type: 'payment_plan_request';
  currentPlan: PaymentPlan;
  newPlan: PaymentPlan & {
    liaisonId: string;
  };
}

export interface PaymentPlanResponse {
  type: 'payment_plan_response';
  status: 'accepted' | 'rejected';
  planId?: string;
}

export interface PaymentPlanData {
  id: string;
  total_due: number;
  payment_rate: number;
  num_payment: number;
  liaison_id: string;
  status: 'pending' | 'active' | 'rejected';
  parent_plan_id?: string;
  modified_by?: string;
  created_at: string;
}