# StealthBet 🎲

> Privacy-First Betting Platform powered by Fully Homomorphic Encryption

StealthBet is a decentralized betting platform that leverages FHEVM (Fully Homomorphic Encryption Virtual Machine) to ensure complete privacy for users' betting amounts. Built on Ethereum Sepolia testnet with Zama's FHEVM v0.9.

## 🌟 Features

- **🔐 Complete Privacy**: Betting amounts are encrypted end-to-end using Fully Homomorphic Encryption
- **🛡️ On-Chain Security**: All bets are stored on-chain with cryptographic proofs
- **👤 User-Only Decryption**: Only the bet owner can decrypt and view their betting amount
- **⚡ Modern Stack**: Built with Next.js 15, React 19, and Tailwind CSS
- **🎨 Beautiful UI**: Clean, modern interface with smooth animations

## 🏗️ Architecture

### Smart Contract (FHEVM v0.9)
- **Contract**: `StealthBet.sol`
- **Network**: Ethereum Sepolia Testnet
- **Configuration**: `ZamaEthereumConfig`
- **Encryption**: euint32 for bet amounts
- **Access Control**: Dual permission model (`FHE.allowThis` + `FHE.allow`)

### Frontend
- **Framework**: Next.js 15 with App Router
- **Wallet Integration**: RainbowKit + Wagmi
- **Styling**: Tailwind CSS
- **FHEVM SDK**: Zama Relayer SDK v0.3.0-5

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- pnpm package manager
- MetaMask or compatible Web3 wallet
- Sepolia testnet ETH

### Installation

```bash
# Clone the repository
git clone https://github.com/moralesmarroquin261-sudo/stealthbet.git
cd stealthbet

# Install dependencies
pnpm install
```

### Smart Contract Deployment

```bash
# Navigate to hardhat directory
cd packages/hardhat

# Configure environment variables
cp .env.example .env
# Edit .env with your PRIVATE_KEY and RPC_URL

# Compile contract
pnpm hardhat compile

# Deploy to Sepolia
pnpm hardhat run scripts/deploy.ts --network sepolia
```

### Frontend Setup

```bash
# Navigate to Next.js directory
cd packages/nextjs-showcase

# Create environment file
echo "NEXT_PUBLIC_CONTRACT_ADDRESS=<your_deployed_contract_address>" > .env.local

# Start development server
pnpm dev
```

The application will be available at `http://localhost:3000`

## 📖 How It Works

### 1. Place Encrypted Bet

Users connect their wallet and enter a bet amount. The value is encrypted locally using FHEVM before being submitted to the blockchain.

```typescript
// Frontend encryption
const input = fhevmInstance.createEncryptedInput(contractAddress, userAddress);
input.add32(amount);
const encryptedInput = await input.encrypt();

// Submit to contract
await contract.placeBet(encryptedInput.handles[0], encryptedInput.inputProof);
```

### 2. On-Chain Storage

The smart contract stores the encrypted bet with proper access permissions:

```solidity
function placeBet(externalEuint32 encryptedAmount, bytes calldata proof) external {
    euint32 amount = FHE.fromExternal(encryptedAmount, proof);
    userBets[msg.sender] = amount;
    
    // Grant permissions
    FHE.allowThis(amount);         // Contract can access
    FHE.allow(amount, msg.sender); // User can decrypt
    
    emit BetPlaced(msg.sender, block.timestamp);
}
```

### 3. User Decryption

Only the bet owner can decrypt their amount using EIP-712 signature:

```typescript
// Generate keypair and EIP-712 message
const keypair = fhevmInstance.generateKeypair();
const eip712 = fhevmInstance.createEIP712(/* ... */);

// User signs the message
const signature = await signer.signTypedData(/* ... */);

// Decrypt with relayer
const result = await fhevmInstance.userDecrypt(/* ... */);
```

## 🔒 Privacy & Security

### Encryption Technology

- **FHE**: Fully Homomorphic Encryption allows computation on encrypted data
- **No Plaintext Exposure**: Betting amounts never exist in plaintext on-chain
- **Selective Decryption**: Only authorized users can decrypt their own data

### Access Control

- **Contract-Level**: `FHE.allowThis()` grants contract read access
- **User-Level**: `FHE.allow()` grants specific user decryption rights
- **Time-Based**: 10-day validity period for decryption permissions

### Security Considerations

- All transactions are verified on Ethereum Sepolia
- Smart contract inherits from `ZamaEthereumConfig` for system configuration
- No centralized servers can access user data
- Cryptographic proofs validate all encrypted inputs

## 📁 Project Structure

```
stealthbet/
├── packages/
│   ├── hardhat/               # Smart contract development
│   │   ├── contracts/
│   │   │   └── StealthBet.sol
│   │   ├── scripts/
│   │   │   └── deploy.ts
│   │   └── hardhat.config.ts
│   │
│   └── nextjs-showcase/       # Frontend application
│       ├── app/
│       │   ├── layout.tsx     # FHEVM SDK loader
│       │   ├── page.tsx       # Landing page
│       │   └── bet/
│       │       └── page.tsx   # Main betting interface
│       ├── components/
│       │   ├── Providers.tsx  # Wallet providers
│       │   └── ClientProviders.tsx
│       └── utils/
│           └── wallet.ts      # Provider utilities
```

## 🛠️ Technology Stack

### Smart Contract
- Solidity ^0.8.24
- FHEVM v0.9 (@fhevm/solidity)
- Hardhat development environment

### Frontend
- Next.js 15 (App Router)
- React 19
- TypeScript 5
- Tailwind CSS 3
- RainbowKit 2.0
- Wagmi 2.0
- Ethers.js 6

### FHEVM Integration
- Zama Relayer SDK v0.3.0-5
- FHEVM System Contracts (Sepolia)
  - ACL: `0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D`
  - KMS: `0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A`
  - InputVerifier: `0xBBC1fFCdc7C316aAAd72E807D9b0272BE8F84DA0`

## 🌐 Deployment

### Vercel Deployment

The project is configured for easy Vercel deployment:

1. Import GitHub repository to Vercel
2. Set root directory: `packages/nextjs-showcase`
3. Add environment variable: `NEXT_PUBLIC_CONTRACT_ADDRESS`
4. Deploy

### CORS Configuration

The project includes necessary CORS headers for FHEVM WebAssembly:

```javascript
// next.config.js
headers: [
  {
    key: 'Cross-Origin-Opener-Policy',
    value: 'same-origin-allow-popups',
  },
  {
    key: 'Cross-Origin-Embedder-Policy',
    value: 'credentialless',
  },
]
```

## 🔧 Development

### Run Tests

```bash
cd packages/hardhat
pnpm hardhat test
```

### Compile Contracts

```bash
cd packages/hardhat
pnpm hardhat compile
```

### Local Development

```bash
# Terminal 1: Start Next.js dev server
cd packages/nextjs-showcase
pnpm dev

# Application runs at http://localhost:3000
```

## 📝 Smart Contract Interface

```solidity
interface IStealthBet {
    // Place an encrypted bet
    function placeBet(
        externalEuint32 encryptedAmount,
        bytes calldata proof
    ) external;
    
    // Get encrypted bet handle
    function getMyBet() external view returns (bytes32);
    
    // Get bet timestamp
    function getMyBetTimestamp() external view returns (uint256);
    
    // Check if user has placed bet
    function hasUserBet(address user) external view returns (bool);
}
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - see LICENSE file for details

## 🔗 Links

- [Zama FHEVM Documentation](https://docs.zama.org/fhevm)
- [Ethereum Sepolia Testnet](https://sepolia.etherscan.io/)
- [RainbowKit Documentation](https://www.rainbowkit.com/)
- [Next.js Documentation](https://nextjs.org/docs)

## ⚠️ Disclaimer

This is a demonstration project for educational purposes. The smart contract is deployed on Sepolia testnet and should not be used with real funds on mainnet without proper auditing.

## 🙏 Acknowledgments

Built with:
- [Zama](https://www.zama.ai/) - FHEVM technology
- [Rainbow](https://rainbow.me/) - Wallet integration
- [Vercel](https://vercel.com/) - Deployment platform

---

**Made with ❤️ for the future of private DeFi**
