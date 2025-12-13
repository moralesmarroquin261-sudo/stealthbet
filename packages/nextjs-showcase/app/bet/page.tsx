'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { BrowserProvider, ethers } from 'ethers';
import { getWalletProvider } from '@/utils/wallet';
import Link from 'next/link';

// FHEVM v0.9 Configuration (7 required parameters)
const FHEVM_CONFIG = {
  chainId: 11155111,  // Sepolia
  aclContractAddress: '0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D',
  kmsContractAddress: '0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A',
  inputVerifierContractAddress: '0xBBC1fFCdc7C316aAAd72E807D9b0272BE8F84DA0',
  verifyingContractAddressDecryption: '0x5D8BD78e2ea6bbE41f26dFe9fdaEAa349e077478',
  verifyingContractAddressInputVerification: '0x483b9dE06E4E4C7D35CCf5837A1668487406D955',
  gatewayChainId: 10901,
  relayerUrl: 'https://relayer.testnet.zama.org',
};

// Contract ABI (minimal - only functions we need)
const CONTRACT_ABI = [
  'function placeBet(bytes32 encryptedAmount, bytes calldata proof) external',
  'function getMyBet() external view returns (bytes32)',
  'function getMyBetTimestamp() external view returns (uint256)',
  'function hasUserBet(address user) external view returns (bool)',
];

// Contract address - will be set after deployment
const CONTRACT_ADDRESS = '0x45df352eEA46c3C8c201C44cB67A3c28CB141E2f';

// Disable static generation
export const dynamic = 'force-dynamic';

export default function BetPage() {
  const { isConnected, address } = useAccount();
  const { data: walletClient } = useWalletClient();

  // FHEVM instance
  const [fhevmInstance, setFhevmInstance] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const isInitializingRef = useRef(false);

  // Simplified state machine: idle -> encrypting -> encrypted -> decrypting -> decrypted -> idle
  type AppState = 'idle' | 'encrypting' | 'encrypted' | 'decrypting' | 'decrypted';
  const [appState, setAppState] = useState<AppState>('idle');
  const [betAmount, setBetAmount] = useState<string>('');
  const [decryptedAmount, setDecryptedAmount] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize FHEVM
  useEffect(() => {
    if (!isConnected || !address || !walletClient || isInitializingRef.current || fhevmInstance) {
      return;
    }

    const initFhevm = async () => {
      isInitializingRef.current = true;
      setIsInitializing(true);
      setInitError(null);

      try {
        // Wait for relayer SDK to load
        if (!(window as any).relayerSDK) {
          throw new Error('Relayer SDK not loaded');
        }

        // Initialize SDK first (CRITICAL!)
        await (window as any).relayerSDK.initSDK();

        // Get provider with multiple fallbacks
        let provider = getWalletProvider();
        
        if (!provider) {
          provider = walletClient as any;
        }

        if (!provider) {
          throw new Error('No wallet provider found');
        }

        // Create FHEVM instance
        const instance = await (window as any).relayerSDK.createInstance({
          ...FHEVM_CONFIG,
          network: provider,
        });

        setFhevmInstance(instance);
        console.log('✅ FHEVM initialized successfully');
      } catch (e: any) {
        setInitError(e.message);
        console.error('❌ FHEVM init failed:', e);
        isInitializingRef.current = false;
      } finally {
        setIsInitializing(false);
      }
    };

    initFhevm();
  }, [isConnected, address, walletClient, fhevmInstance]);

  // Unified action handler based on state
  const handleAction = async () => {
    if (!fhevmInstance || !walletClient) return;

    setErrorMessage(null);

    // State: idle -> encrypting (submit bet)
    if (appState === 'idle') {
      if (!betAmount) {
        setErrorMessage('Please enter a bet amount');
        return;
      }

      setAppState('encrypting');

      try {
        const amount = parseInt(betAmount);
        if (isNaN(amount) || amount <= 0) {
          throw new Error('Please enter a valid amount');
        }

        console.log('🔐 Encrypting bet amount:', amount);

        const input = fhevmInstance.createEncryptedInput(CONTRACT_ADDRESS, address);
        input.add32(amount);
        const encryptedInput = await input.encrypt();

        console.log('✅ Encryption complete');

        const provider = new BrowserProvider(walletClient as any);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

        console.log('📤 Submitting bet to contract...');
        const tx = await contract.placeBet(
          encryptedInput.handles[0],
          encryptedInput.inputProof,
          { gasLimit: 500000 }
        );

        console.log('⏳ Waiting for confirmation...');
        await tx.wait();

        console.log('✅ Bet submitted successfully!');
        setAppState('encrypted');
      } catch (e: any) {
        setErrorMessage(e.message || 'Failed to submit bet');
        console.error('❌ Submit error:', e);
        setAppState('idle');
      }
    }
    // State: encrypted -> decrypting (decrypt bet)
    else if (appState === 'encrypted') {
      setAppState('decrypting');

      try {
        console.log('🔓 Starting decryption...');

        const provider = new BrowserProvider(walletClient as any);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

        const encryptedHandle = await contract.getMyBet();
        console.log('📦 Retrieved encrypted handle');

        const keypair = fhevmInstance.generateKeypair();

        const handleContractPairs = [
          { handle: encryptedHandle, contractAddress: CONTRACT_ADDRESS }
        ];
        const startTimeStamp = Math.floor(Date.now() / 1000).toString();
        const durationDays = "10";
        const contractAddresses = [CONTRACT_ADDRESS];

        const eip712 = fhevmInstance.createEIP712(
          keypair.publicKey,
          contractAddresses,
          startTimeStamp,
          durationDays
        );

        const typesWithoutDomain = { ...eip712.types };
        delete typesWithoutDomain.EIP712Domain;

        console.log('✍️ Requesting signature...');
        const signature = await signer.signTypedData(
          eip712.domain,
          typesWithoutDomain,
          eip712.message
        );

        console.log('🔓 Decrypting...');

        const decryptPromise = fhevmInstance.userDecrypt(
          handleContractPairs,
          keypair.privateKey,
          keypair.publicKey,
          signature.replace("0x", ""),
          contractAddresses,
          address,
          startTimeStamp,
          durationDays
        );

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Decryption timeout')), 90000)
        );

        const decryptedResults = await Promise.race([decryptPromise, timeoutPromise]);
        const result = (decryptedResults as any)[encryptedHandle];

        console.log('✅ Decrypted result:', result);
        setDecryptedAmount(result);
        setAppState('decrypted');
      } catch (e: any) {
        setErrorMessage(e.message || 'Failed to decrypt bet');
        console.error('❌ Decrypt error:', e);
        setAppState('encrypted');
      }
    }
    // State: decrypted -> idle (reset to submit new bet)
    else if (appState === 'decrypted') {
      setAppState('idle');
      setBetAmount('');
      setDecryptedAmount(null);
      setErrorMessage(null);
    }
  };

  // Render: Not connected
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-primary-900 to-dark-900 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-20 h-20 bg-primary-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Connect Your Wallet</h2>
          <p className="text-dark-300 mb-8 max-w-md">
            Connect your wallet to start placing encrypted bets
          </p>
          <ConnectButton />
          <Link href="/" className="block mt-6 text-primary-400 hover:text-primary-300">
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // Render: Initializing FHEVM
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-primary-900 to-dark-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary-500 mx-auto mb-6"></div>
          <p className="text-white text-xl font-semibold">Initializing FHEVM...</p>
          <p className="text-dark-300 text-sm mt-2">Setting up encryption environment</p>
        </div>
      </div>
    );
  }

  // Render: Init error
  if (initError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-primary-900 to-dark-900 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Initialization Error</h2>
          <p className="text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm mb-6">
            {initError}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition-all"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  // Render: Main app
  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-primary-900 to-dark-900">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-dark-900/80 backdrop-blur-lg border-b border-dark-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">🎲</span>
              </div>
              <span className="text-xl font-bold text-white">StealthBet</span>
            </Link>
            <ConnectButton />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-3">
              Virtual Event Betting
            </h1>
            <p className="text-dark-300 text-lg">
              Place your bet with complete privacy
            </p>
          </div>

          {/* OKX Wallet Warning */}
          <div className="bg-yellow-500/10 border-2 border-yellow-500/30 rounded-2xl p-6 mb-8">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-yellow-400 font-bold text-lg mb-2">
                  ⚠️ OKX Wallet Users: Important Notice
                </h3>
                <p className="text-yellow-200 text-sm leading-relaxed mb-3">
                  OKX Wallet has flagged this site as risky and <strong>blocks decryption signatures</strong>. 
                  While you can submit encrypted bets, you won&apos;t be able to decrypt them.
                </p>
                <p className="text-yellow-200 text-sm leading-relaxed font-semibold">
                  ✅ Solution: Please switch to <strong>MetaMask</strong> or another wallet to test the full decryption feature.
                </p>
              </div>
            </div>
          </div>

          {/* Main Card */}
          <div className="bg-dark-800/50 border border-dark-700 rounded-2xl p-8">
            {/* Input field - only show in idle or encrypting state */}
            {(appState === 'idle' || appState === 'encrypting') && (
              <div className="mb-6">
                <label className="block text-white font-semibold mb-3 text-lg">
                  Enter Bet Amount
                </label>
                <input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  placeholder="e.g., 100"
                  disabled={appState === 'encrypting'}
                  className="w-full px-6 py-4 bg-dark-900 border-2 border-dark-600 focus:border-primary-500 rounded-xl text-white text-2xl font-bold placeholder-dark-400 outline-none transition-all disabled:opacity-50"
                />
                <p className="text-dark-400 text-sm mt-2">
                  Your bet amount will be encrypted before submission
                </p>
              </div>
            )}

            {/* Decrypted result display */}
            {appState === 'decrypted' && decryptedAmount !== null && (
              <div className="mb-6 text-center">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-white font-bold text-2xl mb-2">
                  Your Bet Amount
                </h3>
                <div className="text-6xl font-bold text-green-400 my-6">
                  {decryptedAmount}
                </div>
                <p className="text-green-200 text-sm">
                  ✅ Successfully decrypted from blockchain
                </p>
              </div>
            )}

            {/* Status message for encrypted state */}
            {appState === 'encrypted' && (
              <div className="mb-6">
                <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                  <svg className="w-6 h-6 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-green-400 font-semibold">Bet Submitted Successfully!</p>
                    <p className="text-green-200 text-sm mt-1">
                      Click the button below to decrypt and view your bet amount.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Unified Action Button */}
            <button
              onClick={handleAction}
              disabled={
                !fhevmInstance || 
                appState === 'encrypting' || 
                appState === 'decrypting' ||
                (appState === 'idle' && !betAmount)
              }
              className={`w-full py-4 font-bold text-lg rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 ${
                appState === 'encrypted' 
                  ? 'bg-green-600 hover:bg-green-700 hover:shadow-green-500/50' 
                  : appState === 'decrypted'
                  ? 'bg-blue-600 hover:bg-blue-700 hover:shadow-blue-500/50'
                  : 'bg-primary-600 hover:bg-primary-700 hover:shadow-primary-500/50'
              } disabled:bg-dark-600 disabled:cursor-not-allowed text-white`}
            >
              {!fhevmInstance ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Initializing...</span>
                </>
              ) : appState === 'encrypting' ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Encrypting...</span>
                </>
              ) : appState === 'encrypted' ? (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                  </svg>
                  <span>🔓 Decrypt My Bet</span>
                </>
              ) : appState === 'decrypting' ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Decrypting...</span>
                </>
              ) : appState === 'decrypted' ? (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Submit New Bet</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>Submit Encrypted Bet</span>
                </>
              )}
            </button>

            {/* Error message */}
            {errorMessage && (
              <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-red-400 text-sm">{errorMessage}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

