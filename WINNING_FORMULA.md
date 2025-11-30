# Zama 项目开发指南 (FHEVM v0.9)

> **目标**: 快速开发高质量的 FHEVM DApp，最大化在 Zama 开发者计划中的获胜概率。

---

## 📋 目录

1. [核心开发理念](#1-核心开发理念)
2. [项目启动流程](#2-项目启动流程)
3. [智能合约开发](#3-智能合约开发)
4. [前端开发](#4-前端开发)
5. [Next.js 配置](#5-nextjs-配置)
6. [常见问题与解决方案](#6-常见问题与解决方案)
7. [部署与发布](#7-部署与发布)
8. [文档规范](#8-文档规范)
9. [快速参考](#9-快速参考)

---

## 1. 核心开发理念

### 1.1 四大核心原则

#### ✨ 原则一：宏大叙事 (Grand Narrative)
- **目标**: 解决一个有远见、有意义的问题
- **执行**: 明确"一句话愿景"，例如：
  - ✅ "保护隐私的去中心化抽奖平台"
  - ✅ "无法被操纵的机密投票系统"
  - ❌ "简单的数字加密工具"（缺乏愿景）

#### 🎨 原则二：精美 UI (Exquisite UI)
- **目标**: 第一印象决定评委打分
- **执行**:
  - 使用 Tailwind CSS + 现代组件库
  - 追求简洁、优雅、流畅
  - 提供清晰的用户反馈（加载、成功、失败）
  - 支持深色模式

#### ⚡ 原则三：极简后端 (Minimalist Backend)
- **目标**: 降低复杂度，避免 Bug
- **执行**:
  - 合约只负责核心 FHE 计算
  - **严禁使用 `FHE.requestDecryption`**（异步回调增加复杂度）
  - 所有解密都使用 `userDecrypt` 在前端完成
  - 遵循"无状态合约 + 客户端解密"模式

#### 🎯 原则四：核心演示 (Core Demo)
- **目标**: 一个核心功能打磨到极致
- **执行**:
  - **"单按钮"法则**: 核心交互围绕一个主按钮
  - **功能禁令**: 严禁以下功能
    - ❌ 统计信息、排行榜
    - ❌ 用户资料、复杂注册
    - ❌ 交易历史记录
    - ❌ 多余的设置选项
    - ❌ 只需要一个readme文档，全部使用英文
  - **最小化可行路径**: 只实现核心链路

---

### 1.2 部署配置

#### 标准部署信息
```env
# Sepolia 测试网配置
PRIVATE_KEY=0xb284cc6ca1b2639cfa45ae5dc003cffd59a590d4f6f2d7df093eddd05a6dd26b
ALCHEMY_API_KEY=PdDY0FCflhQnCiLhEwxih
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}
```

---

## 2. 项目启动流程

### 2.1 基于模板创建项目 (5分钟)

```bash
# 1. 克隆模板
git clone https://github.com/0xchriswilder/fhevm-react-template.git YourProjectName
cd YourProjectName

# 2. 安装依赖
pnpm install

# 3. 配置环境变量
cd packages/hardhat
cp .env.example .env
# 编辑 .env，填入上述部署信息
```

### 2.2 项目配置清单

- [ ] 修改项目名称 (`package.json`)
- [ ] 配置 Git 用户信息
- [ ] 创建 GitHub 仓库
- [ ] 配置 Hardhat 网络
- [ ] 删除示例合约和组件

---

## 3. 智能合约开发

### 3.1 核心模式：只计算，不解密

#### 合约职责
1. 接收用户的加密输入 (`FHE.fromExternal`)
2. 执行 FHE 计算 (`FHE.eq`, `FHE.select`, `FHE.add` 等)
3. 存储加密的计算结果
4. 授予合约自身访问权限 (`FHE.allowThis`)
5. 授予用户解密权限 (`FHE.allow`)

#### ⚠️ 严格禁止
- ❌ 不要使用 `FHE.requestDecryption`
- ❌ 不要在合约中解密
- ❌ 不要使用复杂的状态管理

---

### 3.2 标准合约模板

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {EthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract YourContract is EthereumConfig {
    // 1. 存储加密结果
    mapping(address => euint32) public userResults;
    mapping(address => bool) public hasSubmitted;

    // 2. 存储预设的加密数据（如答案）
    euint32 private secretAnswer;
    
    constructor() {
        // 在构造函数中设置加密答案
        secretAnswer = FHE.asEuint32(1024);
        FHE.allowThis(secretAnswer);  // 授予合约访问权限
    }
    
    // 3. 核心函数：接收加密输入，执行计算，授权解密
    function submitGuess(
        externalEuint32 encryptedGuess,
        bytes calldata proof
    ) external {
        // 3.1 验证并转换用户输入
        euint32 guess = FHE.fromExternal(encryptedGuess, proof);

        // 3.2 执行 FHE 计算（比较是否相等）
        ebool isCorrect = FHE.eq(guess, secretAnswer);
        
        // 3.3 存储加密结果
        userResults[msg.sender] = FHE.asEuint32(
            FHE.select(isCorrect, FHE.asEuint32(1), FHE.asEuint32(0))
        );
        hasSubmitted[msg.sender] = true;

        // 3.4 双重授权（关键！）
        FHE.allowThis(userResults[msg.sender]);     // 合约才能返回 handle
        FHE.allow(userResults[msg.sender], msg.sender); // 用户才能解密
    }

    // 4. 视图函数：返回加密结果的句柄
    function getMyResult() external view returns (bytes32) {
        require(hasSubmitted[msg.sender], "No submission found");
        return FHE.toBytes32(userResults[msg.sender]);
    }
}
```

---

### 3.3 权限模型详解（最重要！）

#### 核心概念

FHEVM 有两层权限：
1. **合约访问权限** (`FHE.allowThis`) - 合约能否读取/返回 handle
2. **用户解密权限** (`FHE.allow`) - 用户能否解密 handle

#### ⚠️ 必须同时调用

```solidity
function submitData(externalEuint32 encrypted, bytes calldata proof) external {
    euint32 data = FHE.fromExternal(encrypted, proof);
    userData[msg.sender] = data;
    
    // 必须同时调用这两个
    FHE.allowThis(data);         // 合约可以返回 handle
    FHE.allow(data, msg.sender); // 用户可以解密
}

function getMyData() external view returns (bytes32) {
    // ✅ 因为调用了 FHE.allowThis()，合约可以返回 handle
    return FHE.toBytes32(userData[msg.sender]);
}
```

#### ❌ 常见错误

```solidity
// ❌ 错误：只授予用户权限
function submitData(externalEuint32 encrypted, bytes calldata proof) external {
    euint32 data = FHE.fromExternal(encrypted, proof);
    userData[msg.sender] = data;
    FHE.allow(data, msg.sender);  // ← 只有这个不够！
}

function getMyData() external view returns (bytes32) {
    // ❌ 报错：contract is not authorized to user decrypt handle
    return FHE.toBytes32(userData[msg.sender]);
}
```

**原因**：`FHE.fromExternal()` 创建了一个新的内部 handle，合约需要 `allowThis` 才能访问它。

---

### 3.4 完整合约示例

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {EthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract LoanCommitment is EthereumConfig {
    mapping(address => euint32) public userCommitments;
    mapping(address => bool) public hasCommitted;
    mapping(address => uint256) public commitmentTimestamp;
    
    event CommitmentSubmitted(address indexed user, uint256 timestamp);
    
    function submitCommitment(
        externalEuint32 encryptedAmount,
        bytes calldata proof
    ) external {
        euint32 amount = FHE.fromExternal(encryptedAmount, proof);
        userCommitments[msg.sender] = amount;
        hasCommitted[msg.sender] = true;
        commitmentTimestamp[msg.sender] = block.timestamp;
        
        // 必须同时调用这两个
        FHE.allowThis(amount);         // 合约可以返回 handle
        FHE.allow(amount, msg.sender); // 用户可以解密
        
        emit CommitmentSubmitted(msg.sender, block.timestamp);
    }
    
    function getMyCommitment() external view returns (bytes32) {
        require(hasCommitted[msg.sender], "No commitment found");
        return FHE.toBytes32(userCommitments[msg.sender]);
    }
    
    function getMyCommitmentTimestamp() external view returns (uint256) {
        require(hasCommitted[msg.sender], "No commitment found");
        return commitmentTimestamp[msg.sender];
    }
    
    function hasUserCommitted(address user) external view returns (bool) {
        return hasCommitted[user];
    }
}
```

---

### 3.5 常用 FHE API

#### 数据转换
```solidity
// 明文 -> 加密
euint32 encrypted = FHE.asEuint32(1024);

// 外部输入 -> 加密（需要 proof）
euint32 value = FHE.fromExternal(externalValue, proof);

// 加密 -> bytes32 (用于传递给前端)
bytes32 handle = FHE.toBytes32(encrypted);
```

#### 比较运算
```solidity
ebool eq = FHE.eq(a, b);   // a == b
ebool ne = FHE.ne(a, b);   // a != b
ebool gt = FHE.gt(a, b);   // a > b
ebool lt = FHE.lt(a, b);   // a < b
ebool gte = FHE.gte(a, b); // a >= b
ebool lte = FHE.lte(a, b); // a <= b
```

#### 算术运算
```solidity
euint32 sum = FHE.add(a, b);  // a + b
euint32 diff = FHE.sub(a, b); // a - b
euint32 prod = FHE.mul(a, b); // a * b
```

#### 条件选择
```solidity
// condition ? valueIfTrue : valueIfFalse
euint32 result = FHE.select(condition, valueIfTrue, valueIfFalse);
```

#### 访问控制
```solidity
FHE.allow(encrypted, userAddress);     // 授予用户解密权限
FHE.allowThis(encrypted);             // 授予合约自身访问权限
```

---

### 3.6 部署合约

```bash
# 1. 编译
pnpm hardhat:compile

# 2. 测试（可选）
pnpm hardhat:test

# 3. 部署到 Sepolia
pnpm hardhat:deploy --network sepolia

# 4. 记录合约地址
# 示例: 0x15eB8FeE645286BA7F15704cF0C991A4cD35cbA2
```

---

## 4. 前端开发

### 4.1 核心技术栈

- **框架**: Next.js 15 + React 19
- **样式**: Tailwind CSS
- **钱包**: RainbowKit + Wagmi
- **FHEVM**: Zama Relayer SDK 0.2.0 (CDN)
- **状态管理**: React Hooks

---

### 4.2 项目结构

```
packages/nextjs-showcase/
├── app/
│   ├── layout.tsx          # 根布局，加载 FHEVM CDN
│   ├── page.tsx            # Landing Page
│   └── dapp/
│       └── page.tsx        # DApp 核心页面
├── components/
│   ├── Providers.tsx       # RainbowKit/Wagmi Provider
│   ├── ClientProviders.tsx # 客户端 Provider 包装器
│   └── YourComponent.tsx   # 业务组件
├── utils/
│   └── wallet.ts           # Provider 获取工具
├── vercel.json             # CORS 配置（必需）
└── next.config.js          # Webpack 配置（必需）
```

---

### 4.3 关键代码模板

#### 4.3.1 Layout.tsx - FHEVM CDN 加载

```typescript
// app/layout.tsx
import Script from 'next/script'
import { ClientProviders } from '../components/ClientProviders'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {/* 加载 FHEVM Relayer SDK */}
        <Script
          src="https://cdn.zama.org/relayer-sdk-js/0.2.0/relayer-sdk-js.umd.cjs"
          strategy="beforeInteractive"
        />
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  )
}
```

---

#### 4.3.2 ClientProviders.tsx - 禁用 SSR

```typescript
// components/ClientProviders.tsx
'use client';

import dynamic from 'next/dynamic';

const Providers = dynamic(
  () => import('./Providers').then((mod) => mod.Providers),
  { ssr: false } // 关键：禁用 SSR
);

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}
```

---

#### 4.3.3 Providers.tsx - 钱包配置

```typescript
// components/Providers.tsx
'use client';

import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { 
  metaMaskWallet, 
  rainbowWallet, 
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { connectorsForWallets } from '@rainbow-me/rainbowkit';

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Recommended',
      wallets: [
        metaMaskWallet,
        rainbowWallet,
        walletConnectWallet,
      ],
    },
  ],
  {
    appName: 'Your App Name',
    projectId: 'YOUR_WALLETCONNECT_PROJECT_ID',
  }
);

const config = getDefaultConfig({
  appName: 'Your App Name',
  projectId: 'YOUR_PROJECT_ID',
  chains: [sepolia],
  ssr: false,
  autoConnect: false, // 避免多钱包冲突
  connectors,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  // 服务端直接返回 children
  if (typeof window === 'undefined') {
    return <>{children}</>;
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

---

#### 4.3.4 utils/wallet.ts - Provider 获取工具

```typescript
// utils/wallet.ts
/**
 * 通用 Provider 获取工具
 * 优先级：window.ethereum > OKX Wallet > Wagmi Connector
 */
export function getWalletProvider(): any {
  if (typeof window === 'undefined') return null;
  
  // 尝试 window.ethereum（MetaMask 等）
  if ((window as any).ethereum) {
    return (window as any).ethereum;
  }
  
  // 尝试 OKX Wallet
  if ((window as any).okxwallet?.provider) {
    return (window as any).okxwallet.provider;
  }
  
  return null;
}
```

---

#### 4.3.5 DApp Page - FHEVM 初始化

```typescript
// app/dapp/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useAccount, useConnectorClient } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { getWalletProvider } from '@/utils/wallet';

// FHEVM v0.9 配置（7个必需参数）
const FHEVM_CONFIG = {
  chainId: 11155111,  // Sepolia
  
  // ACL - 访问控制列表
  aclContractAddress: '0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D',
  
  // KMS - 密钥管理服务
  kmsContractAddress: '0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A',
  
  // Input Verifier - 输入验证器
  inputVerifierContractAddress: '0xBBC1fFCdc7C316aAAd72E807D9b0272BE8F84DA0',
  
  // Gateway 相关
  verifyingContractAddressDecryption: '0x5D8BD78e2ea6bbE41f26dFe9fdaEAa349e077478',
  verifyingContractAddressInputVerification: '0x483b9dE06E4E4C7D35CCf5837A1668487406D955',
  gatewayChainId: 10901,
  relayerUrl: 'https://relayer.testnet.zama.org',
};

export default function DAppPage() {
  const { isConnected, address, connector } = useAccount();
  const { data: connectorClient } = useConnectorClient();
  
  const [fhevmInstance, setFhevmInstance] = useState(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState(null);
  
  // 防止重复初始化
  const isInitializingRef = useRef(false);

  useEffect(() => {
    // 多重检查
    if (!isConnected || !connectorClient || isInitializingRef.current || fhevmInstance) {
      return;
    }

    const initFhevm = async () => {
      isInitializingRef.current = true;  // 立即设置锁
      setIsInitializing(true);
      setError(null);

      try {
        // 等待 relayerSDK 加载
        if (!window.relayerSDK) {
          throw new Error('Relayer SDK not loaded');
        }

        // 多重 fallback 获取 provider
        let provider = getWalletProvider();
        
        if (!provider && connector) {
          provider = await connector.getProvider();
        }
        
        if (!provider) {
          throw new Error('No wallet provider found');
        }

        // 创建实例（7个参数）
        const instance = await window.relayerSDK.createInstance({
          ...FHEVM_CONFIG,
          network: provider,  // 使用获取到的 provider
        });

        setFhevmInstance(instance);
        console.log('✅ FHEVM initialized successfully');
      } catch (e) {
        setError(e.message);
        console.error('❌ FHEVM init failed:', e);
        isInitializingRef.current = false;  // 失败时重置，允许重试
      } finally {
        setIsInitializing(false);
      }
    };

    initFhevm();
  }, [isConnected, connectorClient, connector, fhevmInstance]);

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <ConnectButton />
      </div>
    );
  }

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Initializing FHEVM...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center text-red-500">
          <p className="font-bold mb-2">❌ Initialization Error</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Your DApp UI */}
      <p>FHEVM Instance Ready: {fhevmInstance ? '✅' : '❌'}</p>
    </div>
  );
}

// 禁用静态生成
export const dynamic = 'force-dynamic';
```

---

#### 4.3.6 完整流程：加密、提交、解密

```typescript
import { ethers, BrowserProvider } from 'ethers';

// ==================== 1. 加密用户输入 ====================
async function encryptInput(
  instance: any,
  contractAddress: string,
  userAddress: string,
  value: number
) {
  const input = instance.createEncryptedInput(contractAddress, userAddress);
  input.add32(value); // euint32
  
  // 加密并返回 { handles, inputProof }
  const encryptedInput = await input.encrypt();
  
  return {
    handle: encryptedInput.handles[0],    // bytes32 - 加密数据句柄
    proof: encryptedInput.inputProof      // bytes - 零知识证明
  };
}

// ==================== 2. 调用合约 ====================
async function submitToContract(
  contract: any,
  handle: string,
  proof: string
) {
  const tx = await contract.submitGuess(handle, proof);
  await tx.wait();
}

// ==================== 3. 获取加密结果 ====================
async function getEncryptedResult(
  contract: any,
  signer: any
) {
  // ⚠️ 关键：必须使用 signer 而不是 provider
  // 因为合约中的 view 函数依赖 msg.sender
  const contractWithSigner = contract.connect(signer);
  return await contractWithSigner.getMyResult();
}

// ==================== 4. 解密结果 (userDecrypt) ====================
async function decryptResult(
  fhevmInstance: any,
  encryptedHandle: string,
  contractAddress: string,
  userAddress: string,
  signer: any
) {
  // Step 1: 生成临时密钥对
  const keypair = fhevmInstance.generateKeypair();
  
  // Step 2: 准备解密参数
  const handleContractPairs = [
    { handle: encryptedHandle, contractAddress }
  ];
  const startTimeStamp = Math.floor(Date.now() / 1000).toString();
  const durationDays = "10";  // 签名有效期
  const contractAddresses = [contractAddress];
  
  // Step 3: 创建 EIP-712 签名消息
  const eip712 = fhevmInstance.createEIP712(
    keypair.publicKey,
    contractAddresses,
    startTimeStamp,
    durationDays
  );
  
  // Step 4: 用户签名授权（移除 EIP712Domain）
  const typesWithoutDomain = { ...eip712.types };
  delete typesWithoutDomain.EIP712Domain;
  
  const signature = await signer.signTypedData(
    eip712.domain,
    typesWithoutDomain,
    eip712.message
  );
  
  // Step 5: 调用 userDecrypt 解密
  const decryptedResults = await fhevmInstance.userDecrypt(
    handleContractPairs,
    keypair.privateKey,
    keypair.publicKey,
    signature.replace("0x", ""),  // 移除 0x 前缀
    contractAddresses,
    userAddress,
    startTimeStamp,
    durationDays
  );
  
  // Step 6: 从结果中提取值
  return decryptedResults[encryptedHandle];
}

// ==================== 完整流程示例 ====================
async function handleGuess(
  guessNumber: number,
  fhevmInstance: any,
  contract: any,
  contractAddress: string,
  address: string,
  walletProvider: any
) {
  try {
    // 1. 加密输入
    const { handle, proof } = await encryptInput(
      fhevmInstance,
      contractAddress,
      address,
      guessNumber
    );

    // 2. 提交到合约
    await submitToContract(contract, handle, proof);

    // 3. 获取 signer（必需）
    const provider = new BrowserProvider(walletProvider);
    const signer = await provider.getSigner();

    // 4. 获取加密结果（使用 signer）
    const encryptedResult = await getEncryptedResult(contract, signer);

    // 5. 解密结果 (userDecrypt)
    const result = await decryptResult(
      fhevmInstance,
      encryptedResult,
      contractAddress,
      address,
      signer
    );

    console.log('✅ Decrypted Result:', result);
    return result;
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}
```

---

### 4.4 关键注意事项

#### ✅ 必须做
1. **使用 7 个配置参数**：所有系统合约地址都要配置
2. **使用 Wagmi 获取 provider**：通过 `useConnectorClient` 或 `connector.getProvider()`
3. **使用 signer 调用 view 函数**：如果函数依赖 `msg.sender`
4. **使用 useRef 防止重复初始化**：避免 React StrictMode 问题
5. **处理 encrypt 返回值**：使用 `handles[0]` 和 `inputProof`
6. **实现完整的 userDecrypt 流程**：包括 EIP-712 签名

#### ❌ 常见错误
1. **参数名拼写错误**：确保使用 `kmsContractAddress` 等正确的参数名
2. **使用 provider 而不是 signer**：导致 `msg.sender` 不正确
3. **忘记移除 EIP712Domain**：签名时会报错
4. **直接使用 window.ethereum**：Vercel 部署时可能失败
5. **忘记 FHE.allowThis()**：合约无法返回 handle

---

## 5. Next.js 配置

### 5.1 Webpack 配置（必需）

#### 问题
MetaMask SDK 和 WalletConnect 依赖 React Native 模块，Vercel 构建时会报错。

#### 解决方案

```javascript
// next.config.js
const nextConfig = {
  transpilePackages: ['@fhevm-sdk'],
  
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Fallback：忽略 React Native 依赖
      config.resolve.fallback = {
        ...config.resolve.fallback,
        '@react-native-async-storage/async-storage': false,
        'pino-pretty': false,
        fs: false,
        net: false,
        tls: false,
      };
    }
    
    // 抑制警告
    config.ignoreWarnings = [
      { module: /@metamask\/sdk/ },
      { module: /@react-native-async-storage/ },
      { module: /pino-pretty/ },
    ];
    
    return config;
  },
};

module.exports = nextConfig;
```

---

### 5.2 CORS 头配置（必需）

#### 问题
FHEVM WebAssembly 需要特定的 CORS 头才能使用多线程。

#### 解决方案 1：next.config.js

```javascript
// next.config.js
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
        ],
      },
    ];
  },
};
```

#### 解决方案 2：vercel.json（推荐）

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cross-Origin-Opener-Policy",
          "value": "same-origin"
        },
        {
          "key": "Cross-Origin-Embedder-Policy",
          "value": "require-corp"
        }
      ]
    }
  ]
}
```

⚠️ **重要**: 这两个响应头是 FHEVM 正常工作的**必需条件**！

---

### 5.3 完整的 next.config.js

```javascript
// next.config.js
const nextConfig = {
  transpilePackages: ['@fhevm-sdk'],
  
  // CORS 头配置（必需）
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
        ],
      },
    ];
  },
  
  // Webpack 配置（必需）
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        '@react-native-async-storage/async-storage': false,
        'pino-pretty': false,
        fs: false,
        net: false,
        tls: false,
      };
    }
    
    config.ignoreWarnings = [
      { module: /@metamask\/sdk/ },
      { module: /@react-native-async-storage/ },
      { module: /pino-pretty/ },
    ];
    
    return config;
  },
};

module.exports = nextConfig;
```

---

## 6. 常见问题与解决方案

### 6.1 FHEVM 初始化错误

#### 错误 1: KMS contract address is not valid or empty

**错误信息**:
```
Error: KMS contract address is not valid or empty
```

**原因**:
- SDK 初始化配置不完整
- 参数名拼写错误

**解决方案**:
```typescript
// ✅ 确保所有 7 个参数都存在且参数名正确
const config = {
  chainId: 11155111,
  network: provider,
  aclContractAddress: '0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D',
  kmsContractAddress: '0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A',  // ⚠️ 不是 kmsVerifierAddress
  inputVerifierContractAddress: '0xBBC1fFCdc7C316aAAd72E807D9b0272BE8F84DA0',
  verifyingContractAddressDecryption: '0x5D8BD78e2ea6bbE41f26dFe9fdaEAa349e077478',
  verifyingContractAddressInputVerification: '0x483b9dE06E4E4C7D35CCf5837A1668487406D955',
  gatewayChainId: 10901,
  relayerUrl: 'https://relayer.testnet.zama.org',
};
```

---

#### 错误 2: called Result::unwrap_throw() on an Err value

**错误信息**:
```
Error: called 'Result::unwrap_throw()' on an 'Err' value
```

**原因**:
- FHEVM 被初始化了多次
- React StrictMode 导致 `useEffect` 执行两次

**解决方案**:
```typescript
const isInitializingRef = useRef(false);

useEffect(() => {
  if (isInitializingRef.current || fhevmInstance) return;
  
  const init = async () => {
    isInitializingRef.current = true;
    try {
      // ... 初始化
      const instance = await window.relayerSDK.createInstance(config);
      setFhevmInstance(instance);
    } catch (e) {
      console.error('Init failed:', e);
      isInitializingRef.current = false;  // 失败时重置，允许重试
    }
  };
  
  init();
}, [isConnected, connectorClient]);
```

---

#### 错误 3: No Ethereum provider found

**错误信息**:
```
Error: No Ethereum provider found
```

**原因**:
- 直接使用 `window.ethereum`
- Vercel 上 RainbowKit 的 provider 由 Wagmi 管理

**解决方案**:
```typescript
// 使用 getWalletProvider 工具
import { getWalletProvider } from '@/utils/wallet';
import { useConnectorClient } from 'wagmi';

const { connector } = useAccount();
const { data: connectorClient } = useConnectorClient();

// 多重 fallback
let provider = getWalletProvider();

if (!provider && connector) {
  provider = await connector.getProvider();
}

if (!provider) {
  throw new Error('No wallet provider found');
}

const instance = await window.relayerSDK.createInstance({
  ...config,
  network: provider,
});
```

---

### 6.2 合约权限错误

#### 错误 4: contract is not authorized to user decrypt handle

**错误信息**:
```
Error: dapp contract 0x... is not authorized to user decrypt handle 0x...
```

**原因**:
- 合约没有调用 `FHE.allowThis()`
- 只调用了 `FHE.allow(data, msg.sender)` 不够

**解决方案**:
```solidity
function submitData(externalEuint32 encrypted, bytes calldata proof) external {
    euint32 data = FHE.fromExternal(encrypted, proof);
    userData[msg.sender] = data;
    
    // ⚠️ 必须同时调用
    FHE.allowThis(data);         // ← 合约才能返回 handle
    FHE.allow(data, msg.sender); // ← 用户才能解密
}
```

---

### 6.3 前端调用错误

#### 错误 5: You have not submitted a commitment yet

**错误信息**:
```
Error: execution reverted: "You have not submitted a commitment yet"
```

**原因**:
- 使用 `provider` 而不是 `signer` 调用 `view` 函数
- `msg.sender` 不是用户地址

**解决方案**:
```typescript
// ❌ 错误
const contract = new ethers.Contract(address, abi, provider);
const result = await contract.getMyResult();

// ✅ 正确
const provider = new BrowserProvider(walletProvider);
const signer = await provider.getSigner();
const contract = new ethers.Contract(address, abi, signer);
const result = await contract.getMyResult();
```

---

#### 错误 6: Cannot read properties of undefined (reading 'then')

**错误信息**:
```
TypeError: Cannot read properties of undefined (reading 'then')
```

**原因**:
- `encrypt()` 返回值处理错误

**解决方案**:
```typescript
// ✅ 正确
const input = instance.createEncryptedInput(contractAddress, userAddress);
input.add32(value);
const encryptedInput = await input.encrypt();

// 使用 handles 和 inputProof
const handle = encryptedInput.handles[0];
const proof = encryptedInput.inputProof;

await contract.submitData(handle, proof);
```

---

### 6.4 构建和部署错误

#### 错误 7: FHEVM WebAssembly Threads 支持

**问题**:
```
This browser does not support threads. Verify that your server returns correct headers
```

**解决**: 添加 CORS 头配置（见 [5.2](#52-cors-头配置必需)）

---

#### 错误 8: Module not found: pino-pretty

**错误信息**:
```
Module not found: Can't resolve 'pino-pretty'
Module not found: Can't resolve '@react-native-async-storage/async-storage'
```

**解决**: 添加 Webpack fallback 配置（见 [5.1](#51-webpack-配置必需)）

---

#### 错误 9: 多钱包扩展冲突

**问题**: 
- 用户切换钱包（如从 MetaMask 到 OKX）
- FHEVM 初始化卡住

**解决**: 
```typescript
const config = getDefaultConfig({
  appName: 'Your App',
  projectId: 'YOUR_PROJECT_ID',
  chains: [sepolia],
  ssr: false,
  autoConnect: false, // ← 关键：禁用自动重连
});
```

**用户侧清理**（可选）:
```javascript
localStorage.clear();
indexedDB.deleteDatabase('WALLET_CONNECT_V2_INDEXED_DB');
indexedDB.deleteDatabase('keyval-store');
window.location.reload();
```

---

### 6.5 UI/UX 建议

#### 添加多钱包冲突提示

```typescript
<div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded-xl">
  <div className="flex items-start gap-3">
    <svg className="w-5 h-5 text-amber-600 flex-shrink-0">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
    </svg>
    <div>
      <p className="text-sm font-semibold text-amber-900 mb-1">
        ⚠️ Multi-Wallet Conflict Notice
      </p>
      <p className="text-xs text-amber-800 leading-relaxed">
        If you encounter issues such as <strong>FHEVM initialization failure</strong>, 
        please try using <strong>incognito mode</strong> or a 
        <strong>fresh browser environment</strong> to avoid multi-wallet extension conflicts.
      </p>
    </div>
  </div>
</div>
```

---

### 6.6 合约编译错误

#### 错误 10: encrypted-types 库缺失

**错误信息**:
```
Error HH411: The library encrypted-types, imported from @fhevm/solidity/lib/FHE.sol, is not installed.
```

**原因**:
- FHEVM v0.9.1 依赖 `encrypted-types` 包，但不会自动安装

**解决方案**:
```bash
# 在 packages/hardhat 目录下
pnpm add encrypted-types@^0.0.4
```

```json
// packages/hardhat/package.json
{
  "dependencies": {
    "@fhevm/solidity": "0.9.1",
    "@fhevm/host-contracts": "^0.9.0",
    "encrypted-types": "^0.0.4",  // ← 必需
    "hardhat": "^2.19.0",
    // ... 其他依赖
  }
}
```

**参考成功案例**:
- https://github.com/yuanzi8556-arch/secret-commitment-fhevm
- https://github.com/beibeiyaya/Secret-Raffle

---

#### 错误 11: EthereumConfig not found

**错误信息**:
```
DeclarationError: Declaration "EthereumConfig" not found in "@fhevm/solidity/config/ZamaConfig.sol"
```

**原因**:
- FHEVM v0.9 中 `EthereumConfig` 重命名为 `ZamaEthereumConfig`

**解决方案**:
```solidity
// ❌ 错误写法
import {EthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
contract YourContract is EthereumConfig { }

// ✅ 正确写法
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
contract YourContract is ZamaEthereumConfig { }
```

---

#### 错误 12: FHE.asEuint32 类型错误

**错误信息**:
```
TypeError: Member "asEuint32" not found or not visible after argument-dependent lookup in type(library FHE).
```

**原因**:
- `FHE.asEuint32()` 不能直接接受整数字面量，需要显式类型转换

**解决方案**:
```solidity
// ❌ 错误写法
euint32 value = FHE.asEuint32(1);
euint32 result = FHE.select(condition, FHE.asEuint32(1), FHE.asEuint32(0));

// ✅ 正确写法
euint32 value = FHE.asEuint32(uint32(1));
euint32 one = FHE.asEuint32(uint32(1));
euint32 zero = FHE.asEuint32(uint32(0));
euint32 result = FHE.select(condition, one, zero);
```

---

#### 错误 13: Hardhat TypeScript 配置错误

**错误信息**:
```
error TS5109: Option 'moduleResolution' must be set to 'NodeNext' when option 'module' is set to 'NodeNext'.
```

**解决方案**:
```json
// packages/hardhat/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",        // ← 使用 commonjs
    "moduleResolution": "node",  // ← 使用 node
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true
  }
}
```

---

#### 错误 14: Impossible to fetch public key: wrong relayer url

**错误信息**:
```
Error: Impossible to fetch public key: wrong relayer url.
```

**出现场景**:
- 点击连接钱包后，选择钱包时报错
- FHEVM 初始化失败

**原因**:
- 缺少 `relayerSDK.initSDK()` 调用
- 必须在创建实例前先初始化 SDK

**解决方案**:
```typescript
const initFhevm = async () => {
  try {
    if (!(window as any).relayerSDK) {
      throw new Error('Relayer SDK not loaded');
    }

    // ⚠️ 关键步骤：必须先调用 initSDK()
    await (window as any).relayerSDK.initSDK();

    // 获取 provider
    let provider = getWalletProvider();
    
    if (!provider && connector) {
      provider = await connector.getProvider();
    }
    
    if (!provider) {
      throw new Error('No wallet provider found');
    }

    // 然后才能创建实例
    const instance = await (window as any).relayerSDK.createInstance({
      chainId: 11155111,
      network: provider,
      aclContractAddress: '0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D',
      kmsContractAddress: '0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A',
      inputVerifierContractAddress: '0xBBC1fFCdc7C316aAAd72E807D9b0272BE8F84DA0',
      verifyingContractAddressDecryption: '0x5D8BD78e2ea6bbE41f26dFe9fdaEAa349e077478',
      verifyingContractAddressInputVerification: '0x483b9dE06E4E4C7D35CCf5837A1668487406D955',
      gatewayChainId: 10901,
      relayerUrl: 'https://relayer.testnet.zama.org',
    });

    setFhevmInstance(instance);
  } catch (e) {
    console.error('Init failed:', e);
  }
};
```

**参考代码**:
- https://github.com/yuanzi8556-arch/secret-commitment-fhevm/blob/main/packages/nextjs-showcase/app/dapp/page.tsx#L65

---

#### 错误 15: Incorrect Handle (SDK 版本不匹配)

**错误信息**:
```
⚠️ Incorrect Handle 0: (expected) 3066a840...aa36a70400 != ba221a94...aa36a70400 (received)
```

**出现场景**:
- 提交加密数据到合约后报错
- Handle 不匹配

**根本原因**:
- **SDK 版本与合约版本不匹配**
- 合约使用 FHEVM v0.9，但前端 SDK 使用旧版本 v0.2.0

**解决方案**:

**1. 更新 SDK CDN 版本**
```typescript
// app/layout.tsx
// ❌ 错误 - 旧版本
<Script
  src="https://cdn.zama.org/relayer-sdk-js/0.2.0/relayer-sdk-js.umd.cjs"
  strategy="beforeInteractive"
/>

// ✅ 正确 - 匹配 FHEVM v0.9
<Script
  src="https://cdn.zama.org/relayer-sdk-js/0.3.0-5/relayer-sdk-js.umd.cjs"
  strategy="beforeInteractive"
/>
```

**2. 确认合约配置正确**
```solidity
// ✅ v0.9 正确写法
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract MyContract is ZamaEthereumConfig {
    constructor() {
        // 类型转换必须显式
        secretValue = FHE.asEuint32(uint32(888));
        FHE.allowThis(secretValue);
    }
    
    function submit(externalEuint32 encrypted, bytes calldata proof) external {
        euint32 data = FHE.fromExternal(encrypted, proof);
        
        // 必须同时调用！
        FHE.allowThis(data);         // Contract can access
        FHE.allow(data, msg.sender); // User can decrypt
    }
}
```

**3. 加密数据直接传递（不做转换）**
```typescript
// ✅ 正确：直接传递
const input = fhevmInstance.createEncryptedInput(contractAddress, userAddress);
input.add32(value);
const encrypted = await input.encrypt();

// 直接使用，不转换
await contract.submit(
  encrypted.handles[0],    // ← 直接用
  encrypted.inputProof     // ← 直接用
);
```

**检查清单**:
- [ ] CDN 版本改成 `0.3.0-5`
- [ ] 合约继承 `ZamaEthereumConfig`
- [ ] 合约调用了 `FHE.allowThis()`
- [ ] 类型转换使用 `uint32()` 显式转换
- [ ] 加密数据没有做额外转换
- [ ] 重新编译和部署合约

**版本对应关系**:
| FHEVM 合约版本 | Relayer SDK 版本 | 状态 |
|---------------|-----------------|------|
| v0.8.x | 0.1.x - 0.2.x | ❌ 已弃用 |
| **v0.9.x** | **0.3.0-5** | ✅ 当前 |

**参考案例**:
- https://github.com/yuanzi8556-arch/secret-commitment-fhevm (使用 v0.3.0-5)

---

#### 错误 16: User decrypt failed: relayer respond with HTTP code 500

**错误信息**:
```
User decrypt failed: relayer respond with HTTP code 500
```

**出现场景**:
- 提交交易成功后立即尝试解密
- 点击签名后报 500 错误

**根本原因**:
- **权限信息需要时间在 relayer 上同步**
- 立即解密时，relayer 还没有收到合约的权限更新
- 导致 relayer 拒绝解密请求

**错误的做法** ❌:
```typescript
// ❌ 错误：提交后立即自动解密
await tx.wait();
await handleDecrypt();  // 会报 500 错误
```

**正确的做法** ✅:

**方案 1：手动解密按钮（推荐）**
```typescript
// 1. 提交后不要立即解密
const handleSubmit = async () => {
  const tx = await contract.submit(handle, proof);
  await tx.wait();
  
  console.log('✅ Transaction confirmed!');
  setCanDecrypt(true);  // 显示解密按钮，让用户手动触发
};

// 2. 用户点击解密按钮时，等待几秒再解密
const handleDecrypt = async () => {
  // 等待权限同步
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // 然后执行解密
  const decrypted = await fhevmInstance.userDecrypt(...);
};
```

**方案 2：自动解密（需要更长等待时间）**
```typescript
await tx.wait();
console.log('✅ Transaction confirmed');

// 等待足够长的时间（至少 5-10 秒）
await new Promise(resolve => setTimeout(resolve, 10000));

// 然后才能解密
await handleDecrypt();
```

**UI 实现**:
```tsx
{/* 提交成功后显示解密按钮 */}
{canDecrypt && result === null && (
  <button onClick={handleDecrypt} disabled={isDecrypting}>
    {isDecrypting ? '解密中...' : '🔓 解密查看结果'}
  </button>
)}
```

**关键要点**:
1. ⏰ **不要立即解密** - 必须等待权限同步
2. 👆 **推荐手动触发** - 让用户点击解密按钮
3. ⏳ **至少等待 3-5 秒** - 给 relayer 时间同步
4. 🔄 **可以重试** - 如果仍然失败，等待更长时间再试

**参考实现**:
- https://github.com/yuanzi8556-arch/secret-commitment-fhevm (使用手动解密按钮)

---

#### 错误 17: 解密一直卡住（签名后无响应）

**症状**:
- 点击解密按钮 → 签名成功
- 一直显示"解密中..."，持续几分钟
- 没有任何错误提示

**可能原因**:
1. **网络慢** - Relayer 响应时间长（可能 30-60 秒）
2. **过早解密** - 提交后立即解密，权限未同步
3. **无超时控制** - 代码没有超时机制

**解决方案**:

**1. 添加强制等待（倒计时）**
```typescript
// 提交成功后，强制等待 10 秒
await tx.wait();
setCountdown(10);  // 显示倒计时 UI

const timer = setInterval(() => {
  setCountdown(prev => {
    if (prev <= 1) {
      clearInterval(timer);
      setCanDecrypt(true);  // 倒计时结束，允许解密
      return 0;
    }
    return prev - 1;
  });
}, 1000);
```

**2. 添加超时控制**
```typescript
// userDecrypt 添加 60 秒超时
const decryptPromise = fhevmInstance.userDecrypt(...);

const timeoutPromise = new Promise((_, reject) => 
  setTimeout(() => reject(new Error('解密超时')), 60000)
);

const result = await Promise.race([decryptPromise, timeoutPromise]);
```

**3. 添加详细日志**
```typescript
console.log('✍️ Requesting signature...');
const signature = await signer.signTypedData(...);
console.log('✅ Signature received');

console.log('🔓 Calling userDecrypt...');
console.log('⏳ This may take 30-60 seconds...');
const result = await fhevmInstance.userDecrypt(...);
console.log('✅ Decrypted:', result);
```

**4. UI 改进**
```tsx
{/* 倒计时显示 */}
{countdown > 0 && (
  <div>⏳ 正在同步权限... 请等待 {countdown} 秒</div>
)}

{/* 解密按钮 */}
{canDecrypt && (
  <button onClick={handleDecrypt}>
    {isDecrypting ? (
      <span>
        解密中... ⏳ 通常需要 30-60 秒
      </span>
    ) : (
      '🔓 解密查看结果'
    )}
  </button>
)}
```

**关键要点**:
1. ⏱️ **强制等待** - 提交后等待至少 10 秒
2. ⏰ **超时控制** - 解密超过 60 秒自动中断
3. 📝 **详细日志** - 便于调试卡住的位置
4. 💬 **用户提示** - 告知用户需要等待 30-60 秒

**正常时间**:
- 提交交易: 5-15 秒
- 权限同步: 10 秒（倒计时）
- userDecrypt: 30-60 秒（正常）

**如果超过 60 秒**:
- 检查网络连接
- 查看控制台日志
- 重新点击解密按钮重试

---

#### 错误 18: CORS 阻止 relayer 请求

**错误信息**:
```
Access to fetch at 'https://relayer.testnet.zama.org/v1/user-decrypt' from origin 'http://localhost:3000' 
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

**出现场景**:
- 签名完成后，调用 `userDecrypt`
- 控制台显示 CORS 错误
- 一直卡在"解密中..."

**根本原因**:
- `Cross-Origin-Embedder-Policy: require-corp` 设置过于严格
- 要求所有跨域资源都必须有 `Cross-Origin-Resource-Policy` 头
- 但 relayer 只有 `Access-Control-Allow-Origin: *`，没有 `Cross-Origin-Resource-Policy`

**解决方案**:

**将 COEP 从 `require-corp` 改为 `credentialless`**

```javascript
// next.config.js
async headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'Cross-Origin-Opener-Policy',
          value: 'same-origin',
        },
        {
          key: 'Cross-Origin-Embedder-Policy',
          value: 'credentialless',  // ✅ 改为 credentialless
        },
      ],
    },
  ];
},
```

```json
// vercel.json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cross-Origin-Opener-Policy",
          "value": "same-origin"
        },
        {
          "key": "Cross-Origin-Embedder-Policy",
          "value": "credentialless"
        }
      ]
    }
  ]
}
```

**区别说明**:
- `require-corp`: 要求所有跨域资源都有 `Cross-Origin-Resource-Policy` 头
- `credentialless`: 允许跨域 fetch，但不发送凭证（更宽松）

**注意**:
- ⚠️ 修改后必须**硬刷新浏览器**（Cmd+Shift+R）或**清除缓存**
- ⚠️ 开发服务器需要**重启**才能应用新的 CORS 头
- ✅ `credentialless` 仍然支持 FHEVM WebAssembly threads

**验证方法**:
```bash
# 重启服务器
pkill -f "next dev"
pnpm dev

# 浏览器硬刷新（Mac）
Cmd + Shift + R

# 浏览器硬刷新（Windows）
Ctrl + Shift + R
```

**参考**:
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Embedder-Policy

---

#### 错误 19: useConnectorClient vs useWalletClient

**症状**:
- CORS 错误
- 解密失败
- 代码与参考项目不一致

**根本原因**:
自创实现而非参考官方项目，导致 hooks 使用不正确。

**解决方案**:

**直接复制参考项目的实现！**

```typescript
// ❌ 错误：使用 useConnectorClient
import { useConnectorClient } from 'wagmi';
const { data: connectorClient } = useConnectorClient();

// ✅ 正确：使用 useWalletClient（参考项目）
import { useWalletClient } from 'wagmi';
const { data: walletClient } = useWalletClient();

// ✅ 创建 provider
const provider = new BrowserProvider(walletClient as any);
const signer = await provider.getSigner();
```

**完整参考实现**:
```typescript
// app/dapp/page.tsx
import { useAccount, useWalletClient } from 'wagmi';

export default function DAppPage() {
  const { isConnected, address } = useAccount();
  const { data: walletClient } = useWalletClient();
  
  useEffect(() => {
    if (!isConnected || !address || !walletClient || fhevmInstance) {
      return;
    }
    // ... initFhevm
  }, [isConnected, address, walletClient]);
  
  // 提交猜测
  const handleSubmitGuess = async () => {
    if (!walletClient) return;
    
    const provider = new BrowserProvider(walletClient as any);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    
    // ...
  };
  
  // 解密结果
  const handleDecryptResult = async () => {
    if (!walletClient) return;
    
    const provider = new BrowserProvider(walletClient as any);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    
    const encryptedHandle = await contract.getMyResult();
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
    
    const signature = await signer.signTypedData(
      eip712.domain,
      typesWithoutDomain,
      eip712.message
    );
    
    const decryptedResults = await fhevmInstance.userDecrypt(
      handleContractPairs,
      keypair.privateKey,
      keypair.publicKey,
      signature.replace("0x", ""),
      contractAddresses,
      address,
      startTimeStamp,
      durationDays
    );
    
    const decryptedValue = decryptedResults[encryptedHandle];
    console.log('✅ Decrypted result:', decryptedValue);
  };
}
```

**关键点**:
1. ✅ 使用 `useWalletClient` 而不是 `useConnectorClient`
2. ✅ 依赖项：`[isConnected, address, walletClient]`
3. ✅ Provider: `new BrowserProvider(walletClient as any)`
4. ✅ 完全按照参考项目的方式实现

**参考项目**:
- https://github.com/yuanzi8556-arch/secret-commitment-fhevm/blob/main/packages/nextjs-showcase/components/MyCommitment.tsx

---

#### 错误 20: 500 错误深度分析和解决

**症状**:
即使等待倒计时后仍然报 `User decrypt failed: relayer respond with HTTP code 500`

**深度原因分析**:

1. **合约地址不匹配** ⚠️（90% 的情况）
   - `.env.local` 中的地址与实际部署地址不同
   - 前端硬编码了错误的地址
   - relayer 在错误的合约上查找权限

2. **权限同步时间不够** ⏰（5% 的情况）
   - Sepolia 网络拥堵
   - Relayer 处理队列积压
   - 需要 30-60 秒甚至更长

3. **Handle 无效** 🔑（3% 的情况）
   - `getMyResult()` 返回 `0x0000...`
   - 合约存储失败
   - 用户未提交猜测

4. **Relayer 配置错误** 📡（2% 的情况）
   - RelayerURL 错误
   - Gateway 配置错误
   - SDK 版本不匹配

**完整解决方案**:

**Step 1: 运行诊断脚本**
```bash
bash check-config.sh
```

输出示例：
```
✅ 地址匹配！
✅ SDK 版本正确！
✅ CORS 配置正确！
```

**Step 2: 如果地址不匹配，修复**
```bash
# 获取实际部署地址
DEPLOYED_ADDRESS=$(cat packages/hardhat/deployments/sepolia/SecretRedPacket.json | grep '"address"' | head -1 | sed 's/.*: "\(.*\)".*/\1/')

# 更新 .env.local
echo "NEXT_PUBLIC_CONTRACT_ADDRESS=$DEPLOYED_ADDRESS" > packages/nextjs-showcase/.env.local

# 重启服务器
pkill -f "next dev"
pnpm dev
```

**Step 3: 设置等待时间为 10 秒**
```typescript
// app/dapp/page.tsx
setCountdown(10);  // 权限同步等待时间
```

**Step 4: 添加自动重试机制**
```typescript
const handleDecryptResult = async (retryCount = 0) => {
  try {
    // ... 解密逻辑
    const decryptedResults = await fhevmInstance.userDecrypt(...);
    // 成功
  } catch (e: any) {
    // 如果是 500 错误，自动重试最多 3 次
    if (e.message?.includes('500') && retryCount < 3) {
      const waitTime = (retryCount + 1) * 10;
      console.log(`⚠️ Retry ${retryCount + 1}/3 after ${waitTime}s...`);
      await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      return handleDecryptResult(retryCount + 1);
    }
    throw e;
  }
};
```

**Step 5: 检查交易记录**
在 Sepolia Etherscan 查看 `submitGuess` 交易：
```
https://sepolia.etherscan.io/address/0xdb6CFA912e20d4DeF31681ddDc3C67D0F8318587
```

确认：
- ✅ 交易成功
- ✅ 有 `GuessSubmitted` 事件
- ✅ Gas 使用正常（约 300k-500k）

**Step 6: 手动验证权限**
在浏览器控制台：
```javascript
// 1. 检查合约地址
console.log('CONTRACT_ADDRESS:', '0xdb6CFA912e20d4DeF31681ddDc3C67D0F8318587');

// 2. 检查 handle
const handle = await contract.getMyResult();
console.log('Handle:', handle);
// 应该是非零的 32 字节 hex

// 3. 检查 relayer 配置
console.log('Relayer URL:', 'https://relayer.testnet.zama.org');
```

**完整测试流程**:

```
1. 硬刷新浏览器（Cmd+Shift+R）
2. 连接钱包
3. 输入 888
4. 提交猜测
5. 等待交易确认（5-15 秒）
6. 倒计时 10 秒（黄色提示框）
7. 点击解密按钮
8. 签名授权
9. 等待解密（30-60 秒）
   - 如果 500 错误，自动重试
   - 第 1 次重试：等待 10 秒
   - 第 2 次重试：等待 20 秒
   - 第 3 次重试：等待 30 秒
10. 显示结果：1（正确）或 0（错误）
```

**如果仍然失败**:

1. **查看完整日志**
   ```
   打开浏览器控制台（F12）
   查找所有红色错误
   复制完整堆栈
   ```

2. **检查 relayer 状态**
   ```bash
   curl -I https://relayer.testnet.zama.org/v1/user-decrypt
   # 应该返回 HTTP/2 200 或 411
   ```

3. **重新部署合约**（如果合约有问题）
   ```bash
   cd packages/hardhat
   pnpm run deploy
   # 更新 .env.local 中的新地址
   ```

4. **使用不同的测试数字**
   - 试试 100, 500, 888（正确答案）

5. **等待更长时间**
   - Sepolia 网络高峰期可能需要 2-3 分钟

**关键诊断文件**:
- `check-config.sh` - 一键检查所有配置
- `packages/nextjs-showcase/DEBUG_500.md` - 详细调试指南

**常见误区** ❌:
- ❌ 没有重启服务器就测试
- ❌ 没有硬刷新浏览器
- ❌ 合约地址配置错误
- ❌ 立即重试而不等待

**正确做法** ✅:
- ✅ 等待 10 秒倒计时
- ✅ 使用自动重试机制（3 次，间隔递增）
- ✅ 运行 `check-config.sh` 验证配置
- ✅ 硬刷新浏览器
- ✅ 查看完整日志
- ✅ 在 Etherscan 确认交易成功

---

### 6.7 开发流程建议

#### ⚠️ 重要提醒

1. **不要编写多余文档**
   - 只保留必要的 README.md
   - 所有问题解决方案记录在本文档（WINNING_FORMULA.md）
   - 不要创建 QUICKSTART.md, DEPLOYMENT.md 等额外文档

2. **遇到问题的正确做法**
   - 优先查看官方文档：https://docs.zama.org/fhevm
   - 参考已成功部署的项目：
     - https://github.com/yuanzi8556-arch/secret-commitment-fhevm
     - https://github.com/beibeiyaya/Secret-Raffle
   - **禁止盲目搜索**，避免使用过时的 v0.8 资料

3. **快速验证方法**
   ```bash
   # 检查已安装的包版本
   cd packages/hardhat
   cat package.json | grep fhevm
   
   # 查看示例项目的依赖
   curl -s https://raw.githubusercontent.com/yuanzi8556-arch/secret-commitment-fhevm/main/packages/hardhat/package.json | grep fhevm
   ```

---

## 7. 部署与发布

### 7.1 GitHub 推送流程

```bash
# 1. 配置项目级 Git 用户
git config user.name "your-username"
git config user.email "your-email@example.com"

# 2. 初始化并提交
git init
git add .
git commit -m "feat: Initial commit - YourProjectName"

# 3. 添加远程仓库
git remote add origin https://github.com/username/repo-name.git

# 4. 推送（需要 Personal Access Token）
git push -u origin main
```

**获取 Personal Access Token**:
1. GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token
3. 勾选 `repo` 权限
4. 复制 Token（以 `ghp_` 开头）

**权限问题解决**:
```bash
git remote set-url origin https://username:token@github.com/username/repo.git
```

---

### 7.2 Vercel 部署流程

#### 配置步骤

1. **导入 GitHub 仓库**到 Vercel

2. **配置 Root Directory**（Monorepo 项目）:
   ```
   Root Directory: packages/nextjs-showcase
   ```

3. **配置环境变量**:
   ```bash
   NEXT_PUBLIC_CONTRACT_ADDRESS=0x你的合约地址
   NEXT_PUBLIC_CHAIN_ID=11155111
   ```

4. **构建配置**（Vercel 自动识别）:
   - Framework Preset: Next.js
   - Build Command: `pnpm build`
   - Output Directory: `.next`
   - Install Command: `pnpm install`

5. **点击 Deploy**

---

### 7.3 部署前检查清单

- [ ] 所有 TypeScript 类型错误已修复
- [ ] 本地运行 `pnpm build` 测试生产构建
- [ ] `vercel.json` 已配置 CORS 响应头
- [ ] `next.config.js` 已配置 Webpack fallback
- [ ] 环境变量已配置
- [ ] 合约地址已更新
- [ ] 使用 `EthereumConfig` 配置类
- [ ] 所有 `FHE.fromExternal` 后都有 `FHE.allowThis()`
- [ ] 使用 Wagmi 获取 provider
- [ ] 实现了完整的 `userDecrypt` 流程

---

## 8. 文档规范

### 8.1 必需文档

#### README.md 结构

```markdown
# Project Name

> Built with FHEVM v0.9

One-sentence value proposition.

## 🌟 Features

- Privacy-preserving feature 1
- FHE-powered feature 2
- Decentralized feature 3

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- pnpm
- MetaMask or compatible Web3 wallet

### Installation
\`\`\`bash
pnpm install
\`\`\`

### Run Locally
\`\`\`bash
pnpm dev
\`\`\`

## 🏗️ Architecture

- **FHEVM Version**: v0.9
- **Smart Contract**: [Link to Etherscan]
- **Frontend**: Next.js 15 + Tailwind CSS
- **SDK**: Zama Relayer SDK 0.2.0

## 🔒 Privacy & Security

Explain how FHE protects user data.

## 📸 Screenshots

[Add screenshots]

## 🛣️ Roadmap

- [x] FHEVM v0.9 integration
- [ ] Current features
- [ ] Future plans

## 📄 License

MIT
```

---

#### PRD.md 结构（可选）

```markdown
# Product Requirements Document

## 1. Project Overview

### Vision
One-sentence vision statement.

### Problem
What problem are we solving?

### Solution
How does FHE solve this problem?

## 2. User Stories

- As a user, I want to...
- As a user, I need to...

## 3. Technical Architecture

### Smart Contract (FHEVM v0.9)
- Contract name: YourContract
- Configuration: EthereumConfig
- Core functions
- FHE operations
- Permission model: allowThis + allow

### Frontend
- Tech stack: Next.js 15, RainbowKit, Wagmi
- User flow
- Encryption/Decryption flow (userDecrypt)

## 4. Security Considerations

- Privacy guarantees
- Access control
- Known limitations
```

---

### 8.2 文档写作原则

#### ✅ 应该做
- 使用清晰、简洁的语言
- 提供代码示例
- 包含截图和演示链接
- 突出 FHE 的核心价值
- 使用 Markdown 格式规范

#### ❌ 不应该做
- 冗长、重复的描述
- 过度技术化的术语（除非必要）
- 缺少上下文的代码片段
- 没有视觉元素

---

## 9. 快速参考

### 9.1 常用命令

```bash
# Hardhat
pnpm hardhat:compile
pnpm hardhat:test
pnpm hardhat:deploy --network sepolia

# Next.js
pnpm dev          # 开发服务器
pnpm build        # 生产构建（测试用）
pnpm lint         # 代码检查

# Git
git status
git add .
git commit -m "feat: description"
git push origin main
```

---

### 9.2 常用链接

- **Zama 官方文档**: https://docs.zama.org/fhevm
- **合约地址配置**: https://docs.zama.org/protocol/solidity-guides/smart-contract/configure/contract_addresses
- **Sepolia 浏览器**: https://sepolia.etherscan.io/
- **Sepolia 水龙头**: https://sepoliafaucet.com/
- **RainbowKit 文档**: https://www.rainbowkit.com/docs
- **Wagmi 文档**: https://wagmi.sh/
- **Next.js 文档**: https://nextjs.org/docs
- **Tailwind CSS**: https://tailwindcss.com/docs

---

### 9.3 系统合约地址 (Sepolia)

```typescript
// 复制即用 - FHEVM v0.9 配置
const FHEVM_CONFIG = {
  chainId: 11155111,
  aclContractAddress: '0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D',
  kmsContractAddress: '0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A',
  inputVerifierContractAddress: '0xBBC1fFCdc7C316aAAd72E807D9b0272BE8F84DA0',
  verifyingContractAddressDecryption: '0x5D8BD78e2ea6bbE41f26dFe9fdaEAa349e077478',
  verifyingContractAddressInputVerification: '0x483b9dE06E4E4C7D35CCf5837A1668487406D955',
  gatewayChainId: 10901,
  relayerUrl: 'https://relayer.testnet.zama.org',
};
```

---

### 9.4 项目开发时间表

基于实际项目经验：

| 阶段 | 时间 | 主要任务 |
|------|------|---------|
| **需求分析** | 1h | 明确核心功能、写 PRD |
| **合约开发** | 2-3h | 编写、测试、部署合约 |
| **前端开发** | 5-7h | UI 设计、FHEVM 集成、userDecrypt 实现 |
| **调试修复** | 2-4h | 解决 SSR、类型、兼容性问题 |
| **文档编写** | 2h | README、PRD、代码注释 |
| **部署上线** | 1h | GitHub、Vercel 配置 |
| **总计** | **13-18h** | 一个完整的 Demo |

---

## 10. 总结

### 核心要点

1. **理念优先**: 明确愿景和核心价值
2. **极简合约**: 只计算，不解密
3. **双重授权**: `FHE.allowThis()` + `FHE.allow()`
4. **精美前端**: 第一印象很重要
5. **完整配置**: 7个系统合约地址 + CORS 头 + Webpack fallback
6. **用户解密**: 使用 `userDecrypt` + EIP-712 签名

---

### ✅ 成功标志

1. 合约部署成功到 Sepolia
2. 前端可以连接钱包
3. FHEVM 初始化无错误
4. 可以提交加密数据
5. 可以使用 `userDecrypt` 解密查看数据
6. Vercel 部署无构建错误
7. 控制台显示 "✅ FHEVM initialized successfully"

---

### 🚨 最容易踩的坑

1. **忘记 `FHE.allowThis()`** → 合约无法返回 handle
2. **用 `provider` 调用 view 函数** → `msg.sender` 不对
3. **直接用 `window.ethereum`** → Vercel 上失败
4. **配置参数不全或拼写错误** → "KMS contract address is not valid"
5. **忘记配置 CORS 头** → WebAssembly 无法运行
6. **FHEVM 重复初始化** → "Result::unwrap_throw()"
7. **`encrypt()` 返回值处理错误** → 参数类型不匹配

---

### 下次项目开始时

1. 告诉我你的**项目创意**
2. 我会根据这个指南：
   - 创建 PRD
   - 编写合约（EthereumConfig + allowThis）
   - 开发前端（userDecrypt + 7参数配置）
   - 配置 Next.js（CORS + Webpack）
   - 部署上线
   - 编写文档

---

## 附录：核心代码清单

### A. 合约模板文件路径
```
packages/hardhat/contracts/YourContract.sol         # 使用 EthereumConfig
packages/hardhat/deploy/deploy_your_contract.ts
packages/hardhat/test/YourContract.test.ts
```

### B. 前端核心文件路径
```
packages/nextjs-showcase/app/layout.tsx             # 加载 Relayer SDK
packages/nextjs-showcase/app/page.tsx
packages/nextjs-showcase/app/dapp/page.tsx          # userDecrypt 实现
packages/nextjs-showcase/components/ClientProviders.tsx
packages/nextjs-showcase/components/Providers.tsx   # autoConnect: false
packages/nextjs-showcase/utils/wallet.ts            # Provider 获取
packages/nextjs-showcase/vercel.json                # CORS 头
packages/nextjs-showcase/next.config.js             # Webpack fallback
```

### C. 配置文件
```
packages/hardhat/.env
packages/hardhat/hardhat.config.ts
packages/nextjs-showcase/.env.local
vercel.json
next.config.js
```

---

**🎉 准备好开始下一个 FHEVM 项目了吗？告诉我你的创意！**

---

**版本**: V4.0 (Pure FHEVM v0.9)  
**更新日期**: 2025-11-28  
**说明**: 纯 v0.9 开发指南，移除所有 v0.8 内容
