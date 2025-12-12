/**
 * Universal Provider Retrieval Utility
 * Priority: window.ethereum > OKX Wallet > Wagmi Connector
 */
export function getWalletProvider(): any {
  if (typeof window === 'undefined') return null;
  
  // Try window.ethereum (MetaMask, etc.)
  if ((window as any).ethereum) {
    return (window as any).ethereum;
  }
  
  // Try OKX Wallet
  if ((window as any).okxwallet?.provider) {
    return (window as any).okxwallet.provider;
  }
  
  return null;
}


