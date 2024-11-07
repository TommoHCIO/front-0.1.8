import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Wallet, AlertCircle, History } from 'lucide-react';
import { Button } from './Button';
import { useWallet } from '../context/WalletContext';
import { createUSDTTransferTransaction, sendAndConfirmTransaction } from '../services/transactions';
import { useIncubatorBalance } from '../hooks/useIncubatorBalance';
import { useUserStakedAmount } from '../hooks/useUserStakedAmount';
import { ProgressBar } from './ProgressBar';

const GOAL_AMOUNT = 33000;
const MAX_CTE_SUPPLY = 1000000;
const CTE_ALLOCATION_PERCENTAGE = 30; // 30% of total supply for incubator
const CTE_ALLOCATION = MAX_CTE_SUPPLY * (CTE_ALLOCATION_PERCENTAGE / 100);

export const Incubator = () => {
  const { wallet, publicKey } = useWallet();
  const { 
    balance: incubatorBalance, 
    isLoading: isLoadingBalance,
    error: balanceError,
    refetch 
  } = useIncubatorBalance();

  const {
    stakedAmount,
    isLoading: isLoadingStaked,
    error: stakedError
  } = useUserStakedAmount(publicKey);
  
  const [amount, setAmount] = useState<string>('');
  const [isDepositing, setIsDepositing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Calculate expected rewards
  const expectedRewards = useMemo(() => {
    const depositAmount = parseFloat(amount);
    if (isNaN(depositAmount) || depositAmount <= 0) return 0;

    // Calculate rewards based on deposit amount relative to goal
    const rewardRatio = depositAmount / GOAL_AMOUNT;
    const rewards = CTE_ALLOCATION * rewardRatio;
    
    return rewards;
  }, [amount]);

  const handleDeposit = async () => {
    if (!wallet || !publicKey) {
      setError('Please connect your wallet first');
      return;
    }

    const depositAmount = parseFloat(amount);
    if (isNaN(depositAmount) || depositAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setIsDepositing(true);
    setError(null);
    setSuccess(null);

    try {
      const transaction = await createUSDTTransferTransaction(wallet, depositAmount);
      const signature = await sendAndConfirmTransaction(wallet, transaction);
      
      setSuccess(`Successfully deposited ${depositAmount} USDT`);
      setAmount('');
      refetch();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsDepositing(false);
    }
  };

  return (
    <div className="bg-[#1E2A37]/50 backdrop-blur-lg rounded-3xl p-8 text-white relative overflow-hidden border border-white/5">
      <div className="relative">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-[#2D9CDB] mb-2">CTE Incubator</h2>
          <p className="text-gray-400">Participate in the initial token distribution</p>
        </div>

        <div className="space-y-6 mb-8">
          {publicKey && (
            <div className="bg-[#1E2A37] rounded-xl p-6 border border-white/5">
              <div className="text-sm text-gray-400 mb-2">My Staked USDT</div>
              <div className="text-2xl font-bold text-[#2D9CDB]">
                {isLoadingStaked ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-[#2D9CDB] border-t-transparent rounded-full animate-spin" />
                    <span className="text-gray-400">Loading...</span>
                  </div>
                ) : stakedError ? (
                  <div className="text-sm text-red-400">Unable to fetch staked amount</div>
                ) : (
                  `${stakedAmount.toLocaleString()} USDT`
                )}
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#1E2A37] rounded-xl p-6 border border-white/5">
              <div className="text-sm text-gray-400 mb-2">Total USDT Deposited</div>
              <div className="text-2xl font-bold text-[#2D9CDB]">
                {isLoadingBalance ? (
                  <div className="animate-pulse">Loading...</div>
                ) : balanceError ? (
                  <div className="text-red-400 text-sm">Unable to fetch balance</div>
                ) : (
                  `${incubatorBalance.toLocaleString()} USDT`
                )}
              </div>
            </div>
            <div className="bg-[#1E2A37] rounded-xl p-6 border border-white/5">
              <div className="text-sm text-gray-400 mb-2">Goal Amount</div>
              <div className="text-2xl font-bold text-[#2D9CDB]">{GOAL_AMOUNT.toLocaleString()} USDT</div>
            </div>
          </div>
        </div>

        <div className="bg-[#1E2A37] rounded-xl p-6 border border-white/5 mb-6">
          <ProgressBar 
            current={incubatorBalance} 
            goal={GOAL_AMOUNT} 
            className="mb-6"
          />

          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm text-gray-400 mb-2">
                Deposit Amount
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full bg-[#141F2A] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#2D9CDB]/50"
                  disabled={isDepositing}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                  USDT
                </span>
              </div>
            </div>
            <div className="text-sm text-gray-400">
              Expected Rewards: <span className="text-[#2D9CDB]">{expectedRewards.toLocaleString(undefined, { maximumFractionDigits: 2 })} $CTE</span>
            </div>
            <Button
              variant="primary"
              icon={Wallet}
              onClick={handleDeposit}
              disabled={isDepositing || !amount}
              className="bg-[#2D9CDB] hover:bg-[#2D9CDB]/90 whitespace-nowrap"
            >
              {isDepositing ? 'Processing...' : 'Deposit'}
            </Button>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg p-3 mt-4"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </motion.div>
          )}

          {success && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm"
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                {success}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};