import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { supabase } from '../../lib/supabase';
import { Loader2, TrendingUp, TrendingDown, AlertCircle, CheckCircle, Clock, HandshakeIcon } from 'lucide-react';

interface TransactionMetrics {
  totalTransactions: number;
  onTimePayments: number;
  averageDelay: number;
  currentStreak: number;
  riskLevel: 'low' | 'medium' | 'high';
  predictedScore: number;
  recommendations: string[];
  impactFactors: {
    factor: string;
    impact: number;
    description: string;
  }[];
}

// CRS Algorithm Constants
const CRS_CONSTANTS = {
  BASE_PENALTY: 10,
  PENALTY_MULTIPLIER: 1.5,
  RECOVERY_INCREMENT: 5,
  RECOVERY_BONUS: 10,
  MAX_SCORE: 100,
  MIN_SCORE: 0,
  RISK_THRESHOLDS: {
    HIGH: 60,
    MEDIUM: 75,
    LOW: 85
  }
};

export default function CRSAnalysisPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [crsScore, setCrsScore] = useState<number>(0);
  const [metrics, setMetrics] = useState<TransactionMetrics | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);

  useEffect(() => {
    fetchCRSData();
  }, []);

  const calculatePenalty = (consecutiveMisses: number): number => {
    return CRS_CONSTANTS.BASE_PENALTY * Math.pow(CRS_CONSTANTS.PENALTY_MULTIPLIER, consecutiveMisses - 1);
  };

  const calculateRecoveryBonus = (monthsOnTime: number): number => {
    const baseRecovery = CRS_CONSTANTS.RECOVERY_INCREMENT;
    const bonusPeriods = Math.floor(monthsOnTime / 6); // Bonus every 6 months
    return baseRecovery + (bonusPeriods * CRS_CONSTANTS.RECOVERY_BONUS);
  };

  const fetchCRSData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get liaison data
      const { data: liaison, error: liaisonError } = await supabase
        .from('liaisons')
        .select('id, crs_score')
        .eq('client_id', user.id)
        .single();

      if (liaisonError) throw liaisonError;
      
      const currentScore = liaison.crs_score || 85; // Default to 85 if no score
      setCrsScore(currentScore);

      // Get transaction history
      const { data: transactions, error: transactionError } = await supabase
        .from('transactions')
        .select(`
          amount,
          due_date,
          completion_date,
          status,
          impact_score,
          days_to_payment,
          payment_streak,
          payment_consistency_score,
          risk_level
        `)
        .order('due_date', { ascending: true });

      if (transactionError) throw transactionError;

      const hasTransactions = transactions && transactions.length > 0;

      // Calculate metrics
      const completedTransactions = transactions?.filter(t => t.status !== 'pending') || [];
      const onTimePayments = completedTransactions.filter(t => 
        t.completion_date && new Date(t.completion_date) <= new Date(t.due_date)
      ).length;

      const averageDelay = completedTransactions.length > 0
        ? completedTransactions
            .filter(t => t.days_to_payment)
            .reduce((sum, t) => sum + t.days_to_payment, 0) / completedTransactions.length
        : 0;

      const currentStreak = hasTransactions 
        ? transactions[transactions.length - 1]?.payment_streak || 0
        : 0;
      
      const riskLevel = hasTransactions
        ? transactions[transactions.length - 1]?.risk_level || 'medium'
        : currentScore >= 80 ? 'low' : currentScore >= 70 ? 'medium' : 'high';

      // Calculate predicted score
      let predictedScore = currentScore;
      
      if (hasTransactions) {
        const missedPayments = completedTransactions.length - onTimePayments;
        
        if (missedPayments > 0) {
          const penalty = calculatePenalty(missedPayments);
          predictedScore = Math.max(CRS_CONSTANTS.MIN_SCORE, predictedScore - penalty);
        } else if (currentStreak > 0) {
          const bonus = calculateRecoveryBonus(currentStreak);
          predictedScore = Math.min(CRS_CONSTANTS.MAX_SCORE, predictedScore + bonus);
        }
      } else {
        // No transaction history - predict based on current score
        predictedScore = currentScore;
      }

      // Generate impact factors
      const impactFactors = hasTransactions ? [
        {
          factor: 'Consecutive Payments',
          impact: currentStreak * CRS_CONSTANTS.RECOVERY_INCREMENT,
          description: `${currentStreak} consecutive on-time payments`
        },
        {
          factor: 'Payment Timing',
          impact: averageDelay <= 0 ? 5 : -calculatePenalty(Math.ceil(Math.abs(averageDelay) / 7)),
          description: averageDelay <= 0 
            ? 'Early payments boost your score'
            : `Late payments (avg. ${Math.abs(averageDelay).toFixed(1)} days) reduce score exponentially`
        },
        {
          factor: 'Recovery Potential',
          impact: currentStreak >= 6 ? CRS_CONSTANTS.RECOVERY_BONUS : CRS_CONSTANTS.RECOVERY_INCREMENT,
          description: currentStreak >= 6 
            ? 'Eligible for recovery bonus'
            : `${6 - (currentStreak % 6)} more on-time payments until bonus`
        }
      ] : [
        {
          factor: 'Initial Score',
          impact: 0,
          description: 'Your starting CRS score based on initial assessment'
        },
        {
          factor: 'Future Potential',
          impact: CRS_CONSTANTS.RECOVERY_INCREMENT,
          description: 'Make on-time payments to increase your score'
        },
        {
          factor: 'Bonus Opportunity',
          impact: CRS_CONSTANTS.RECOVERY_BONUS,
          description: 'Earn bonus points after 6 consecutive on-time payments'
        }
      ];

      // Generate recommendations
      const recommendations = hasTransactions ? [
        currentStreak < 3 && 'Build a streak of on-time payments to start score recovery',
        averageDelay > 0 && `Paying ${Math.abs(averageDelay).toFixed(1)} days late leads to exponential penalties`,
        currentStreak >= 5 && 'Maintain your payment streak for bonus points',
        completedTransactions.length - onTimePayments > 0 && 
          `Recent missed payments have a ${CRS_CONSTANTS.PENALTY_MULTIPLIER}x multiplier effect`,
        predictedScore > currentScore && 
          `Continue current behavior to gain ${(predictedScore - currentScore).toFixed(1)} points`,
      ].filter(Boolean) : [
        'Welcome to the CRS system! Your initial score is based on our assessment',
        'Make your first payment on time to start building your payment history',
        'Consistent on-time payments will improve your score',
        'You can earn bonus points after 6 consecutive on-time payments',
        'Early payments can boost your score faster'
      ];

      setMetrics({
        totalTransactions: completedTransactions.length,
        onTimePayments,
        averageDelay,
        currentStreak,
        riskLevel,
        predictedScore,
        recommendations,
        impactFactors
      });

      // Format payment history for chart
      const historyData = hasTransactions ? transactions.map(t => ({
        date: new Date(t.due_date).toLocaleDateString('default', { month: 'short', day: 'numeric' }),
        daysFromDue: t.days_to_payment || 0,
        status: t.status,
        consistency: t.payment_consistency_score
      })) : Array.from({ length: 6 }, (_, i) => ({
        date: new Date(Date.now() + (i * 30 * 24 * 60 * 60 * 1000))
          .toLocaleDateString('default', { month: 'short', day: 'numeric' }),
        daysFromDue: 0,
        status: 'pending',
        consistency: currentScore
      }));

      setPaymentHistory(historyData);
    } catch (error) {
      console.error('Error fetching CRS data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Current Score Card */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Client Reputation Score</h2>
                <div className="flex items-center space-x-2">
                  {metrics?.predictedScore !== undefined && (
                    <div className={`flex items-center ${
                      metrics.predictedScore > crsScore ? 'text-green-600' : 'text-red-600'
                    }`}>
                     </div>
                  )}
                </div>
              </div>

              <div className="relative w-full h-32">
                {/* Score Display */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className={`text-5xl font-bold mb-2 ${
                      crsScore >= CRS_CONSTANTS.RISK_THRESHOLDS.LOW ? 'text-green-600' :
                      crsScore >= CRS_CONSTANTS.RISK_THRESHOLDS.MEDIUM ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {crsScore}
                    </div>
                    <div className="text-gray-500">out of {CRS_CONSTANTS.MAX_SCORE}</div>
                  </div>
                </div>

                {/* Circular Progress */}
                <svg className="w-full h-full" viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#E5E7EB"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <path
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke={
                      crsScore >= CRS_CONSTANTS.RISK_THRESHOLDS.LOW ? '#059669' :
                      crsScore >= CRS_CONSTANTS.RISK_THRESHOLDS.MEDIUM ? '#D97706' :
                      '#DC2626'
                    }
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${(crsScore / CRS_CONSTANTS.MAX_SCORE) * 100}, 100`}
                  />
                </svg>
              </div>

              {/* Algorithm Explanation */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-medium text-gray-900 mb-2">How Your Score is Calculated</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>• Missed payments result in exponential penalties (base: -{CRS_CONSTANTS.BASE_PENALTY} points)</p>
                  <p>• Each consecutive miss multiplies the penalty by {CRS_CONSTANTS.PENALTY_MULTIPLIER}x</p>
                  <p>• Recovery occurs in +{CRS_CONSTANTS.RECOVERY_INCREMENT} point increments</p>
                  <p>• Bonus +{CRS_CONSTANTS.RECOVERY_BONUS} points every 6 months of consistent payments</p>
                </div>
              </div>
            </div>

            {/* Payment Timeline */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Payment Timeline</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={paymentHistory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis
                      label={{
                        value: 'Days from Due Date',
                        angle: -90,
                        position: 'insideLeft',
                        style: { textAnchor: 'middle' }
                      }}
                    />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="daysFromDue"
                      stroke="#6366f1"
                      strokeWidth={2}
                      dot={{ fill: '#6366f1' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Payment Renegotiation Card */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Need Payment Flexibility?</h3>
                  <p className="text-gray-600 mt-1">
                    Worried about missing a payment and impacting your CRS score? Negotiate a new payment plan with your accountant.
                  </p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('/client/payment/renegotiate')}
                  className="flex items-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-md"
                >
                  <HandshakeIcon className="h-5 w-5 mr-2" />
                  Negotiate Payment Plan
                </motion.button>
              </div>
            </div>
          </div>

          {/* Metrics and Recommendations */}
          <div className="space-y-8">
            {/* Quick Stats */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Performance</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                    <span className="text-gray-600">On-time Payments</span>
                  </div>
                  <span className="font-medium">
                    {metrics?.onTimePayments}/{metrics?.totalTransactions}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Clock className="h-5 w-5 text-blue-500 mr-2" />
                    <span className="text-gray-600">Average Delay</span>
                  </div>
                  <span className="font-medium">
                    {metrics?.averageDelay.toFixed(1)} days
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <TrendingUp className="h-5 w-5 text-indigo-500 mr-2" />
                    <span className="text-gray-600">Current Streak</span>
                  </div>
                  <span className="font-medium">
                    {metrics?.currentStreak} payments
                  </span>
                </div>
              </div>
            </div>

            {/* Impact Factors */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Score Impact Factors</h3>
              <div className="space-y-4">
                {metrics?.impactFactors.map((factor, index) => (
                  <div key={index} className="border-b border-gray-100 last:border-0 pb-4 last:pb-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">{factor.factor}</span>
                      <span className={`${
                        factor.impact > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {factor.impact > 0 ? '+' : ''}{factor.impact} points
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{factor.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommendations */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recommendations</h3>
              <div className="space-y-3">
                {metrics?.recommendations.map((recommendation, index) => (
                  <div
                    key={index}
                    className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700"
                  >
                    {recommendation}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}