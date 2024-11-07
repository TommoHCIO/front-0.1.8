import React, { useState } from 'react';
import { Wallet } from 'lucide-react';
import { Button } from './Button';
import { WalletModal } from './WalletModal';
import { useWallet } from '../context/WalletContext';
import { USDTBalance } from './USDTBalance';

export const ConnectWallet = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { isConnected, disconnect, publicKey } = useWallet();

  const handleClick = () => {
    if (isConnected) {
      disconnect();
    } else {
      setIsModalOpen(true);
    }
  };

  return (
    <div className="flex flex-col items-end gap-4">
      <Button
        variant="primary"
        icon={Wallet}
        onClick={handleClick}
        className="shadow-lg shadow-accent/20 hover:shadow-accent/30"
      >
        {isConnected && publicKey
          ? `${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`
          : 'Connect Wallet'
        }
      </Button>

      {isConnected && publicKey && (
        <div className="w-full bg-[#1E2A37]/50 backdrop-blur-lg rounded-lg p-3">
          <USDTBalance />
        </div>
      )}

      <WalletModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};