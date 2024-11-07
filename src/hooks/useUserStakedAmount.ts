import { useState, useEffect, useCallback, useRef } from 'react';
import { Connection } from '@solana/web3.js';
import { SolanaConnectionManager } from '../utils/solanaConnection';
import { getUserStakedAmount } from '../utils/solana';
import { SOLANA_CONSTANTS } from '../utils/constants';

export function useUserStakedAmount(walletAddress: string | null) {
  const [stakedAmount, setStakedAmount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef<boolean>(true);
  const lastFetchRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const fetchStakedAmount = useCallback(async (force = false) => {
    if (!walletAddress || !mountedRef.current) return;

    const now = Date.now();
    if (!force && now - lastFetchRef.current < SOLANA_CONSTANTS.REQUEST_INTERVAL) {
      return;
    }

    try {
      lastFetchRef.current = now;
      const connectionManager = SolanaConnectionManager.getInstance();
      
      const amount = await connectionManager.executeWithRetry(async (connection: Connection) => {
        return getUserStakedAmount(connection, walletAddress);
      });
      
      if (mountedRef.current) {
        setStakedAmount(amount);
        setError(null);
      }
    } catch (err: any) {
      if (mountedRef.current) {
        console.error('Staked amount fetch error:', err);
        setError('Failed to fetch staked amount');
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        
        // Schedule next update
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          fetchStakedAmount(true);
        }, SOLANA_CONSTANTS.REQUEST_INTERVAL);
      }
    }
  }, [walletAddress]);

  useEffect(() => {
    mountedRef.current = true;
    setIsLoading(true);
    fetchStakedAmount(true);

    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [fetchStakedAmount]);

  const refetch = useCallback(() => {
    setIsLoading(true);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    return fetchStakedAmount(true);
  }, [fetchStakedAmount]);

  return { stakedAmount, isLoading, error, refetch };
}