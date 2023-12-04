# mortgage-marketplace

## Prerequisites
Before running the TypeScript code, ensure you have the following installed on your machine:

1. Node.js: Ensure you have Node.js installed. TypeScript requires Node.js to run.

2. npm: npm is the package manager for Node.js. It's typically included with Node.js installation.


### Installing TypeScript
To install TypeScript globally, open a terminal and run the following command:

```Shell
npm install -g typescript
```
and Install project dependencies:
```Shell
npm install
```

### Running TypeScript
To compile and run the TypeScript code, use the following command:
```Shell
npm start
```

### How to run setup.ts
You can simply run 'setup.ts' by running `npx ts-node setup.ts` 
At the end of the setup.ts file, three functions are called: createNFT(), createSoulboundTokens(), and createFungibleToken(). The createNFT() function is not commented out. If you want to run the other two methods, please uncomment them.

### Design and Implementation of setup.ts
Setup.ts is a TypeScript implementation using the Hedera Hashgraph SDK to create various types of tokens on the Hedera network. It includes functions to create fungible tokens, non-fungible tokens (NFTs), and soulbound tokens. The design follows best practices, utilizing the Hedera SDK for token-related transactions, and includes error handling. The implementation demonstrates the creation of tokens, associated transactions, and token metadata, offering a comprehensive solution for tokenization on the Hedera network. Users can customize token names and symbols while maintaining consistency and clarity in the generated symbols.

### Reference
[Create and transfer your first nft](https://docs.hedera.com/hedera/tutorials/token/create-and-transfer-your-first-nft)



