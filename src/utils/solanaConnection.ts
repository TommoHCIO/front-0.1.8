import { Connection } from '@solana/web3.js';
import { SOLANA_CONSTANTS } from './constants';

interface EndpointHealth {
  endpoint: string;
  lastSuccess: number;
  failures: number;
  lastAttempt: number;
}

export class SolanaConnectionManager {
  private static instance: SolanaConnectionManager;
  private connection: Connection | null;
  private healthStats: Map<string, EndpointHealth>;
  private lastRequestTime: number;
  private lastEndpointSwitch: number;

  private constructor() {
    this.connection = null;
    this.healthStats = new Map();
    this.lastRequestTime = 0;
    this.lastEndpointSwitch = 0;
    this.initializeConnection();
  }

  private initializeConnection(): void {
    this.connection = new Connection(
      SOLANA_CONSTANTS.RPC_ENDPOINTS[0],
      {
        ...SOLANA_CONSTANTS.CONNECTION_CONFIG,
        wsEndpoint: SOLANA_CONSTANTS.WSS_ENDPOINT,
        fetch: (url, options) => {
          return fetch(url, {
            ...options,
            cache: 'no-store',
          });
        }
      }
    );

    SOLANA_CONSTANTS.RPC_ENDPOINTS.forEach(endpoint => {
      this.healthStats.set(endpoint, {
        endpoint,
        lastSuccess: 0,
        failures: 0,
        lastAttempt: 0
      });
    });
  }

  public static getInstance(): SolanaConnectionManager {
    if (!SolanaConnectionManager.instance) {
      SolanaConnectionManager.instance = new SolanaConnectionManager();
    }
    return SolanaConnectionManager.instance;
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < SOLANA_CONSTANTS.REQUEST_INTERVAL) {
      const waitTime = SOLANA_CONSTANTS.REQUEST_INTERVAL - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  private async verifyConnection(): Promise<Connection> {
    if (!this.connection) {
      this.initializeConnection();
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SOLANA_CONSTANTS.REQUEST_TIMEOUT);

      await this.connection!.getSlot({ signal: controller.signal });
      clearTimeout(timeoutId);

      return this.connection!;
    } catch (error) {
      const now = Date.now();
      if (now - this.lastEndpointSwitch < SOLANA_CONSTANTS.MIN_ENDPOINT_SWITCH_INTERVAL) {
        throw error;
      }

      console.warn('Primary endpoint failed, switching to fallback');
      this.lastEndpointSwitch = now;
      this.connection = new Connection(
        SOLANA_CONSTANTS.RPC_ENDPOINTS[1],
        SOLANA_CONSTANTS.CONNECTION_CONFIG
      );
      return this.connection;
    }
  }

  public async executeWithRetry<T>(
    operation: (connection: Connection) => Promise<T>,
    maxRetries = SOLANA_CONSTANTS.MAX_RETRIES
  ): Promise<T> {
    await this.waitForRateLimit();

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const connection = await this.verifyConnection();
        return await operation(connection);
      } catch (error: any) {
        lastError = error;

        if (error.message.includes('Invalid') || 
            error.message.includes('insufficient') ||
            error.message.includes('cancelled')) {
          throw error;
        }

        if (attempt < maxRetries - 1) {
          await new Promise(resolve => 
            setTimeout(resolve, SOLANA_CONSTANTS.RETRY_DELAY * Math.pow(2, attempt))
          );
        }
      }
    }

    throw lastError || new Error('Operation failed after retries');
  }

  public resetConnection(): void {
    this.connection = null;
    this.lastRequestTime = 0;
    this.lastEndpointSwitch = 0;
    this.initializeConnection();
  }
}