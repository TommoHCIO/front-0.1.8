import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { SOLANA_CONSTANTS } from './constants';

interface CacheEntry {
  amount: number;
  timestamp: number;
}

const stakedAmountCache = new Map<string, CacheEntry>();

export async function getUserStakedAmount(connection: Connection, walletAddress: string): Promise<number> {
  const now = Date.now();
  
  // Clean up old cache entries
  for (const [key, entry] of stakedAmountCache.entries()) {
    if (now - entry.timestamp > SOLANA_CONSTANTS.CACHE_DURATION) {
      stakedAmountCache.delete(key);
    }
  }

  // Check cache first
  const cached = stakedAmountCache.get(walletAddress);
  if (cached && (now - cached.timestamp) < SOLANA_CONSTANTS.CACHE_DURATION) {
    return cached.amount;
  }

  try {
    const walletPubkey = new PublicKey(walletAddress);
    
    // Get user's USDT token account
    const userTokenAccount = await getAssociatedTokenAddress(
      SOLANA_CONSTANTS.USDT_MINT,
      walletPubkey
    );

    // Get incubator's USDT token account
    const incubatorTokenAccount = await getAssociatedTokenAddress(
      SOLANA_CONSTANTS.USDT_MINT,
      SOLANA_CONSTANTS.INCUBATOR_WALLET
    );

    // Get recent signatures for the incubator's token account
    const signatures = await connection.getSignaturesForAddress(
      incubatorTokenAccount,
      { limit: 1000 },
      'confirmed'
    );

    let total = 0;
    const processedTxs = new Set<string>();

    // Process in smaller batches
    const batchSize = 10;
    for (let i = 0; i < signatures.length; i += batchSize) {
      const batch = signatures.slice(i, i + batchSize);
      
      const transactions = await Promise.all(
        batch.map(({ signature }) =>
          connection.getParsedTransaction(signature, {
            maxSupportedTransactionVersion: 0,
            commitment: 'confirmed'
          })
        )
      );

      for (const tx of transactions) {
        if (!tx?.meta || processedTxs.has(tx.signature)) continue;
        processedTxs.add(tx.signature);

        // Look for transfers from user's token account to incubator's token account
        const preBalances = tx.meta.preTokenBalances || [];
        const postBalances = tx.meta.postTokenBalances || [];

        const preIncubatorBalance = preBalances.find(
          b => b.owner === SOLANA_CONSTANTS.INCUBATOR_WALLET.toString() &&
               b.mint === SOLANA_CONSTANTS.USDT_MINT.toString()
        )?.uiTokenAmount.uiAmount || 0;

        const postIncubatorBalance = postBalances.find(
          b => b.owner === SOLANA_CONSTANTS.INCUBATOR_WALLET.toString() &&
               b.mint === SOLANA_CONSTANTS.USDT_MINT.toString()
        )?.uiTokenAmount.uiAmount || 0;

        // Check if this transaction involves a transfer from the user
        const isFromUser = tx.transaction.message.accountKeys.some(
          key => key.pubkey.toString() === userTokenAccount.toString()
        );

        if (isFromUser && postIncubatorBalance > preIncubatorBalance) {
          total += (postIncubatorBalance - preIncubatorBalance);
        }
      }

      // Add delay between batches to respect rate limits
      if (i + batchSize < signatures.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Cache the result
    stakedAmountCache.set(walletAddress, {
      amount: total,
      timestamp: now
    });

    return total;
  } catch (error) {
    console.error('Failed to fetch staked amount:', error);
    
    // Return cached value if available, even if expired
    const cached = stakedAmountCache.get(walletAddress);
    if (cached) {
      return cached.amount;
    }
    
    throw error;
  }
}