// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title StealthBet
 * @notice Privacy-preserving betting platform using Fully Homomorphic Encryption
 * @dev Users can place encrypted bets and decrypt them privately later
 */
contract StealthBet is ZamaEthereumConfig {
    // Mapping from user address to their encrypted bet amount
    mapping(address => euint32) public userBets;
    
    // Mapping to track if user has placed a bet
    mapping(address => bool) public hasBet;
    
    // Mapping to track bet timestamps
    mapping(address => uint256) public betTimestamps;
    
    // Event emitted when a bet is placed
    event BetPlaced(address indexed user, uint256 timestamp);
    
    /**
     * @notice Place a bet with encrypted amount
     * @param encryptedAmount The encrypted bet amount (externalEuint32)
     * @param proof Zero-knowledge proof for the encrypted input
     */
    function placeBet(
        externalEuint32 encryptedAmount,
        bytes calldata proof
    ) external {
        // Convert external encrypted input to internal encrypted type
        euint32 amount = FHE.fromExternal(encryptedAmount, proof);
        
        // Store the encrypted bet amount
        userBets[msg.sender] = amount;
        hasBet[msg.sender] = true;
        betTimestamps[msg.sender] = block.timestamp;
        
        // Grant permissions (CRITICAL!)
        FHE.allowThis(amount);         // Contract can access the encrypted value
        FHE.allow(amount, msg.sender); // User can decrypt their own bet
        
        emit BetPlaced(msg.sender, block.timestamp);
    }
    
    /**
     * @notice Get user's encrypted bet amount
     * @return bytes32 handle representing the encrypted bet amount
     */
    function getMyBet() external view returns (bytes32) {
        require(hasBet[msg.sender], "No bet found");
        return FHE.toBytes32(userBets[msg.sender]);
    }
    
    /**
     * @notice Get the timestamp when user placed their bet
     * @return uint256 timestamp
     */
    function getMyBetTimestamp() external view returns (uint256) {
        require(hasBet[msg.sender], "No bet found");
        return betTimestamps[msg.sender];
    }
    
    /**
     * @notice Check if a user has placed a bet
     * @param user The address to check
     * @return bool true if user has placed a bet
     */
    function hasUserBet(address user) external view returns (bool) {
        return hasBet[user];
    }
}


