'use client';

import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-primary-900 to-dark-900">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-dark-900/80 backdrop-blur-lg border-b border-dark-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">🎲</span>
              </div>
              <span className="text-xl font-bold text-white">StealthBet</span>
            </div>
            <ConnectButton />
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500/10 border border-primary-500/20 rounded-full mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
              </span>
              <span className="text-primary-300 text-sm font-medium">Powered by FHEVM v0.9</span>
            </div>

            {/* Main Heading */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white mb-6 leading-tight">
              The Future of
              <br />
              <span className="bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
                Private Betting
              </span>
            </h1>

            {/* Subheading */}
            <p className="text-xl text-dark-300 max-w-3xl mx-auto mb-12 leading-relaxed">
              Place encrypted bets on virtual events. Your betting amounts remain completely private on-chain 
              using <span className="text-primary-400 font-semibold">Fully Homomorphic Encryption</span>. 
              Only you can decrypt and view your bet.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link 
                href="/bet"
                className="group px-8 py-4 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-primary-500/50 hover:scale-105"
              >
                <span className="flex items-center gap-2">
                  Start Betting
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </Link>
              <Link 
                href="#how-it-works"
                className="px-8 py-4 bg-dark-800 hover:bg-dark-700 text-white font-semibold rounded-xl transition-all duration-200 border border-dark-600"
              >
                Learn More
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 bg-dark-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Why StealthBet?</h2>
            <p className="text-dark-300 text-lg">Three core principles make us unique</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-dark-900/50 border border-dark-700 rounded-2xl p-8 hover:border-primary-500/50 transition-all duration-300">
              <div className="w-14 h-14 bg-primary-500/10 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">True Privacy</h3>
              <p className="text-dark-300 leading-relaxed">
                Your bet amounts are encrypted using Fully Homomorphic Encryption. 
                Not even the contract can see the plaintext values - only you can decrypt them.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-dark-900/50 border border-dark-700 rounded-2xl p-8 hover:border-primary-500/50 transition-all duration-300">
              <div className="w-14 h-14 bg-primary-500/10 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">On-Chain Verified</h3>
              <p className="text-dark-300 leading-relaxed">
                All bets are recorded on Ethereum Sepolia testnet with cryptographic proofs. 
                Transparent, immutable, and verifiable by anyone.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-dark-900/50 border border-dark-700 rounded-2xl p-8 hover:border-primary-500/50 transition-all duration-300">
              <div className="w-14 h-14 bg-primary-500/10 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Instant Access</h3>
              <p className="text-dark-300 leading-relaxed">
                No registration required. Connect your wallet, place a bet, and decrypt anytime. 
                Simple, fast, and truly decentralized.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">How It Works</h2>
            <p className="text-dark-300 text-lg">Three simple steps to private betting</p>
          </div>

          <div className="space-y-8">
            {[
              {
                step: '01',
                title: 'Enter Your Bet',
                description: 'Choose your betting amount. The value is encrypted locally in your browser before leaving your device.',
              },
              {
                step: '02',
                title: 'Submit On-Chain',
                description: 'Your encrypted bet is stored on the blockchain. The smart contract grants you exclusive decryption rights.',
              },
              {
                step: '03',
                title: 'Decrypt Anytime',
                description: 'Click the decrypt button to view your bet. Sign a message to prove ownership - no one else can see your amount.',
              },
            ].map((item, index) => (
              <div key={index} className="flex gap-6 items-start bg-dark-800/30 border border-dark-700/50 rounded-2xl p-8 hover:border-primary-500/30 transition-all duration-300">
                <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white mb-3">{item.title}</h3>
                  <p className="text-dark-300 leading-relaxed text-lg">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-primary-900/20 to-primary-700/20 border-y border-primary-500/20">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">Ready to Experience Private Betting?</h2>
          <p className="text-dark-300 text-lg mb-8">
            Join the future of privacy-preserving decentralized applications
          </p>
          <Link 
            href="/bet"
            className="inline-flex items-center gap-3 px-10 py-5 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-2xl hover:shadow-primary-500/50 hover:scale-105 text-lg"
          >
            <span>Launch App</span>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-dark-700">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">🎲</span>
            </div>
            <span className="text-xl font-bold text-white">StealthBet</span>
          </div>
          <p className="text-dark-400 text-sm">
            Built with FHEVM v0.9 • Deployed on Sepolia Testnet
          </p>
          <p className="text-dark-500 text-xs mt-2">
            © 2025 StealthBet. Demonstrating privacy-preserving technology.
          </p>
        </div>
      </footer>
    </div>
  );
}

