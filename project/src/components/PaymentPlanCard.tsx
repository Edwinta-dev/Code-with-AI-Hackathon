import React from 'react';
import { Calendar, DollarSign } from 'lucide-react';

interface PaymentPlanCardProps {
  type: 'lumpsum' | 'installment';
  totalAmount: number;
  paymentPeriod?: number;
  numberOfPayments?: number;
  paymentAmount?: number;
  reason?: string;
  isEditable?: boolean;
  onChange?: (field: string, value: any) => void;
}

export default function PaymentPlanCard({
  type,
  totalAmount,
  paymentPeriod = 30,
  numberOfPayments = 1,
  paymentAmount,
  reason = '',
  isEditable = false,
  onChange,
}: PaymentPlanCardProps) {
  const handleChange = (field: string, value: any) => {
    if (onChange) {
      onChange(field, value);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Plan Type
          </label>
          <div className="flex space-x-4">
            <label className="inline-flex items-center">
              <input
                type="radio"
                checked={type === 'lumpsum'}
                onChange={() => isEditable && handleChange('type', 'lumpsum')}
                disabled={!isEditable}
                className="text-indigo-600"
              />
              <span className="ml-2 text-sm">Lump Sum</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                checked={type === 'installment'}
                onChange={() => isEditable && handleChange('type', 'installment')}
                disabled={!isEditable}
                className="text-indigo-600"
              />
              <span className="ml-2 text-sm">Installment</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Total Amount
          </label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="number"
              value={totalAmount}
              onChange={(e) => isEditable && handleChange('totalAmount', parseFloat(e.target.value))}
              disabled={!isEditable}
              className={`pl-8 w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md ${
                isEditable
                  ? 'focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500'
                  : 'bg-gray-50'
              }`}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Payment Period (Days)
          </label>
          <select
            value={paymentPeriod}
            onChange={(e) => isEditable && handleChange('paymentPeriod', parseInt(e.target.value))}
            disabled={!isEditable}
            className={`w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md ${
              isEditable
                ? 'focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500'
                : 'bg-gray-50'
            }`}
          >
            <option value={30}>30 Days</option>
            <option value={45}>45 Days</option>
            <option value={90}>90 Days</option>
          </select>
        </div>

        {type === 'installment' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Number of Payments
              </label>
              <input
                type="number"
                value={numberOfPayments}
                onChange={(e) => isEditable && handleChange('numberOfPayments', parseInt(e.target.value))}
                disabled={!isEditable}
                className={`w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md ${
                  isEditable
                    ? 'focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500'
                    : 'bg-gray-50'
                }`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Amount
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="number"
                  value={paymentAmount || totalAmount / numberOfPayments}
                  onChange={(e) => isEditable && handleChange('paymentAmount', parseFloat(e.target.value))}
                  disabled={!isEditable}
                  className={`pl-8 w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md ${
                    isEditable
                      ? 'focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500'
                      : 'bg-gray-50'
                  }`}
                />
              </div>
            </div>
          </>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Comments
          </label>
          <textarea
            value={reason}
            onChange={(e) => isEditable && handleChange('reason', e.target.value)}
            disabled={!isEditable}
            placeholder={isEditable ? "Any additional comments" : ''}
            rows={3}
            className={`w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md ${
              isEditable
                ? 'focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500'
                : 'bg-gray-50'
            }`}
          />
        </div>
      </div>
    </div>
  );
}