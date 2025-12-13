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

  // Bet state
  const [betAmount, setBetAmount] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Decrypt state
  const [canDecrypt, setCanDecrypt] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [isPreparingDecrypt, setIsPreparingDecrypt] = useState(false);
  const [decryptedAmount, setDecryptedAmount] = useState<number | null>(null);
  const [decryptError, setDecryptError] = useState<string | null>(null);

  // Check if user has existing bet
  const checkExistingBet = useCallback(async (provider: any) => {
    try {
      const ethersProvider = new BrowserProvider(provider);
      const signer = await ethersProvider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      
      const hasBet = await contract.hasUserBet(address);
      if (hasBet) {
        setCanDecrypt(true);
      }
    } catch (e) {
      console.log('No existing bet found');
    }
  }, [address]);

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

        // Check if user has existing bet
        checkExistingBet(provider);
      } catch (e: any) {
        setInitError(e.message);
        console.error('❌ FHEVM init failed:', e);
        isInitializingRef.current = false;
      } finally {
        setIsInitializing(false);
      }
    };

    initFhevm();
  }, [isConnected, address, walletClient, fhevmInstance, checkExistingBet]);

  // Submit encrypted bet
  const handleSubmitBet = async () => {
    if (!fhevmInstance || !walletClient || !betAmount) return;

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      // Validate amount
      const amount = parseInt(betAmount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Please enter a valid amount');
      }

      console.log('🔐 Encrypting bet amount:', amount);

      // Create encrypted input
      const input = fhevmInstance.createEncryptedInput(CONTRACT_ADDRESS, address);
      input.add32(amount);
      const encryptedInput = await input.encrypt();

      console.log('✅ Encryption complete');

      // Get contract instance
      const provider = new BrowserProvider(walletClient as any);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      // Submit to contract
      console.log('📤 Submitting bet to contract...');
      const tx = await contract.placeBet(
        encryptedInput.handles[0],
        encryptedInput.inputProof,
        { gasLimit: 500000 } // 设置 gas limit（FHEVM 交易通常需要 300k-500k）
      );

      console.log('⏳ Waiting for confirmation...');
      await tx.wait();

      console.log('✅ Bet submitted successfully!');
      setSubmitSuccess(true);
      setCanDecrypt(true);
    } catch (e: any) {
      setSubmitError(e.message || 'Failed to submit bet');
      console.error('❌ Submit error:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Decrypt bet amount
  const handleDecrypt = async () => {
    if (!fhevmInstance || !walletClient || isDecrypting || isPreparingDecrypt) {
      console.log('⚠️ Decrypt already in progress or not ready');
      return;
    }

    setIsPreparingDecrypt(true);
    setDecryptError(null);

    try {
      console.log('🔓 Starting decryption...');

      // Get contract with signer
      const provider = new BrowserProvider(walletClient as any);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      // Get encrypted handle
      const encryptedHandle = await contract.getMyBet();
      console.log('📦 Retrieved encrypted handle');

      // Generate keypair
      const keypair = fhevmInstance.generateKeypair();

      // Prepare decrypt parameters
      const handleContractPairs = [
        { handle: encryptedHandle, contractAddress: CONTRACT_ADDRESS }
      ];
      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = "10";
      const contractAddresses = [CONTRACT_ADDRESS];

      // Create EIP-712 message
      const eip712 = fhevmInstance.createEIP712(
        keypair.publicKey,
        contractAddresses,
        startTimeStamp,
        durationDays
      );

      // Remove EIP712Domain for signing
      const typesWithoutDomain = { ...eip712.types };
      delete typesWithoutDomain.EIP712Domain;

      console.log('✍️ Requesting signature...');
      setIsPreparingDecrypt(false);
      setIsDecrypting(true);
      
      const signature = await signer.signTypedData(
        eip712.domain,
        typesWithoutDomain,
        eip712.message
      );

      console.log('🔓 Decrypting...');

      // 创建解密 Promise
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

      // Decrypt with timeout (90 seconds)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Decryption timeout')), 90000)
      );

      const decryptedResults = await Promise.race([decryptPromise, timeoutPromise]);
      const result = (decryptedResults as any)[encryptedHandle];

      console.log('✅ Decrypted result:', result);
      setDecryptedAmount(result);
    } catch (e: any) {
      setDecryptError(e.message || 'Failed to decrypt bet');
      console.error('❌ Decrypt error:', e);
    } finally {
      setIsDecrypting(false);
      setIsPreparingDecrypt(false);
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

          {/* Bet Input Card */}
          <div className="bg-dark-800/50 border border-dark-700 rounded-2xl p-8 mb-6">
            <div className="mb-6">
              <label className="block text-white font-semibold mb-3 text-lg">
                Enter Bet Amount
              </label>
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                placeholder="e.g., 100"
                disabled={isSubmitting || submitSuccess}
                className="w-full px-6 py-4 bg-dark-900 border-2 border-dark-600 focus:border-primary-500 rounded-xl text-white text-2xl font-bold placeholder-dark-400 outline-none transition-all disabled:opacity-50"
              />
              <p className="text-dark-400 text-sm mt-2">
                Your bet amount will be encrypted before submission
              </p>
            </div>

            <button
              onClick={handleSubmitBet}
              disabled={!betAmount || isSubmitting || submitSuccess}
              className="w-full py-4 bg-primary-600 hover:bg-primary-700 disabled:bg-dark-600 disabled:cursor-not-allowed text-white font-bold text-lg rounded-xl transition-all shadow-lg hover:shadow-primary-500/50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Submitting...</span>
                </>
              ) : submitSuccess ? (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Bet Submitted!</span>
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

            {submitError && (
              <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-red-400 text-sm">{submitError}</p>
              </div>
            )}
          </div>

          {/* Decrypt Card */}
          {canDecrypt && decryptedAmount === null && (
            <div className="bg-dark-800/50 border border-dark-700 rounded-2xl p-8">
              <h3 className="text-white font-bold text-xl mb-4">
                Decrypt Your Bet
              </h3>
              <p className="text-dark-300 mb-6">
                Click the button below to decrypt and view your bet amount. 
                You&apos;ll need to sign a message to prove ownership.
              </p>

              <button
                onClick={handleDecrypt}
                disabled={!fhevmInstance || isDecrypting || isPreparingDecrypt}
                className="w-full py-4 bg-green-600 hover:bg-green-700 disabled:bg-dark-600 disabled:cursor-not-allowed text-white font-bold text-lg rounded-xl transition-all shadow-lg hover:shadow-green-500/50 flex items-center justify-center gap-2"
              >
                {!fhevmInstance ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Initializing...</span>
                  </>
                ) : isPreparingDecrypt ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Preparing...</span>
                  </>
                ) : isDecrypting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Decrypting...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                    <span>🔓 Decrypt My Bet</span>
                  </>
                )}
              </button>

              {decryptError && (
                <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <p className="text-red-400 text-sm">{decryptError}</p>
                  <button
                    onClick={handleDecrypt}
                    disabled={!fhevmInstance || isDecrypting || isPreparingDecrypt}
                    className="mt-3 text-primary-400 hover:text-primary-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Decrypted Result */}
          {decryptedAmount !== null && (
            <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 border-2 border-green-500/50 rounded-2xl p-8 text-center">
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
        </div>
      </div>
    </div>
  );
}

