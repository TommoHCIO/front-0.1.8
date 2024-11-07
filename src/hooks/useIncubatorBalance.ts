import { useState, useEffect, useCallback, useRef } from 'react';
import { Connection } from '@solana/web3.js';
import { SolanaConnectionManager } from '../utils/solanaConnection';
import { SOLANA_CONSTANTS } from '../utils/constants';
import { getUSDTBalance } from '../services/balanceService';

export function useIncubatorBalance() {
  const [balance, setBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const mountedRef = useRef<boolean>(true);
  const lastFetchRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const fetchBalance = useCallback(async (force = false) => {
    if (!mountedRef.current) return;

    const now = Date.now();
    if (!force && now - lastFetchRef.current < SOLANA_CONSTANTS.REQUEST_INTERVAL) {
      return;
    }

    try {
      lastFetchRef.current = now;
      const connectionManager = SolanaConnectionManager.getInstance();
      
      const balance = await connectionManager.executeWithRetry(async (connection: Connection) => {
        return getUSDTBalance(connection, SOLANA_CONSTANTS.INCUBATOR_WALLET.toString());
      });
      
      if (mountedRef.current) {
        setBalance(balance);
        setLastUpdated(new Date());
        setError(null);
      }
    } catch (err: any) {
      if (mountedRef.current) {
        console.error('Incubator balance fetch error:', err);
        setError('Failed to fetch incubator balance');
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        
        // Schedule next update
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          fetchBalance(true);
        }, SOLANA_CONSTANTS.REQUEST_INTERVAL);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    setIsLoading(true);
    fetchBalance(true);

    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [fetchBalance]);

  const refetch = useCallback(() => {
    setIsLoading(true);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    return fetchBalance(true);
  }, [fetchBalance]);

  return { balance, isLoading, error, refetch, lastUpdated };
}