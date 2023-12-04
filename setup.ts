import * as nacl from "tweetnacl";
import * as Long from "long";

import { config } from 'dotenv';
import {
  AccountId,
  PrivateKey,
  Client,
  AccountCreateTransaction,
  Hbar,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  TokenMintTransaction,
  TransferTransaction,
  AccountBalanceQuery,
  TokenAssociateTransaction,
  TokenInfoQuery,
} from '@hashgraph/sdk';

// Load the .env file
config();

let newAccountId = "";
let PKEY = "";

const MAX_RETRIES = 20; // The counter that avoids the transaction limit issue (max attempts)


/**
 * Creates a new user account on Hedera Hashgraph.
 *
 * @param {string} entityName - A name associated with the new user account.
 * @returns {Promise<{ newAccountId: string; PKEY: string }>} A promise that resolves to an object containing the new account ID and private key.
 * @throws Will throw an error if any issues occur during the account creation process.
 */
async function createUser(entityName: string): Promise<{ newAccountId: string; PKEY: string }> {
  try {
    const operatorPrivateKey: string = process.env.PRIVATE_KEY!;
    const operatorAccount: string = process.env.ACCOUNT_ID!;

    const client: Client = Client.forTestnet(); // Use Testnet, change to Mainnet for production
    client.setOperator(AccountId.fromString(operatorAccount), PrivateKey.fromString(operatorPrivateKey));

    const privateKey: PrivateKey = await PrivateKey.generate();
    const publicKey: string = privateKey.publicKey.toString();

    const transaction = new AccountCreateTransaction()
      .setKey(privateKey.publicKey)
      .setInitialBalance(new Hbar(10)); // Adjust the initial balance as needed

    const txResponse = await transaction.execute(client);
    const receipt = await txResponse.getReceipt(client);
    const newAccountId: string = receipt.accountId?.toString() || "";

    // Store the private key in an environment variable
    process.env[`${entityName.toUpperCase()}_PRIVATE_KEY`] = privateKey.toString();
    process.env[`${entityName.toUpperCase()}_ACCOUNT_ID`] = newAccountId;

    const PKEY: string = privateKey.toString();
    return { newAccountId, PKEY };
  } catch (error) {
    console.error("Error creating user:", error);
    throw error; // Re-throw the error to indicate that the operation failed
  }
}



// Configure accounts and client, and generate needed keys
const operatorId: AccountId = AccountId.fromString(process.env.ACCOUNT_ID!);
const operatorKey: PrivateKey = PrivateKey.fromString(process.env.PRIVATE_KEY!);
const treasuryId: AccountId = operatorId;
const treasuryKey: PrivateKey = operatorKey;
const client: Client = Client.forTestnet().setOperator(operatorId, operatorKey);
const supplyKey: PrivateKey = PrivateKey.generate();


/**
 * Executes a transaction on Hedera Hashgraph, handling retries in case of failure.
 *
 * @param {any} transaction - The transaction object to be executed.
 * @param {PrivateKey} key - The private key used to sign the transaction.
 * @returns {Promise<any>} A promise that resolves to the result of the transaction execution.
 * @throws Will throw an error if the transaction fails after the maximum number of retries.
 */
async function executeTransaction(transaction: any, key: PrivateKey) {
  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      const txSign = await transaction.sign(key);
      const txSubmit = await txSign.execute(client);
      
      // If the transaction succeeded, return the receipt
      return txSubmit;
    } catch (err) {
      // If the error is BUSY, retry the transaction
      if (err instanceof Error && err.toString().includes('BUSY'))  {
        retries++;
        console.log(`Retry attempt: ${retries}`);
      } else {
        // If the error is not BUSY or exceeds retries, throw the error
        throw err;
      }
    }
  }

  throw new Error(`Transaction failed after ${MAX_RETRIES} attempts`);
}

/**
 * Creates soulbound tokens and performs associated transactions.
 *
 * @param {string} TokenName - The name of the token.
 * @param {string} TokenSymbol - The symbol of the token.
 * @returns {Promise<void>} A promise that resolves when the process is complete.
 */
async function createSoulboundTokens(TokenName: string, TokenSymbol: string): Promise<void> {
  try {
    // Obtain newAccountId and private Key that we are going to transfer to
    const { newAccountId: newId, PKEY: pk } = await createUser(TokenName);

    // Current account ID and key
    const currAccId = AccountId.fromString(newId);
    const currAccKey = PrivateKey.fromString(pk);

    // Create the NFT
    const nftCreate = await new TokenCreateTransaction()
      .setTokenName(TokenName)
      .setTokenSymbol(TokenSymbol)
      .setTokenType(TokenType.NonFungibleUnique)
      .setDecimals(0)
      .setInitialSupply(0)
      .setTreasuryAccountId(treasuryId)
      .setSupplyType(TokenSupplyType.Finite)
      .setMaxSupply(250)
      .setSupplyKey(supplyKey)
      .freezeWith(client);

    // Sign the transaction with the treasury key
    const nftCreateTxSign = await nftCreate.sign(operatorKey);

    // Submit the transaction to a Hedera network
    const nftCreateSubmit = await nftCreateTxSign.execute(client);

    // Get the transaction receipt
    const nftCreateRx = await nftCreateSubmit.getReceipt(client);
    // Get the token ID
    const tokenId = nftCreateRx.tokenId!;

    // Log the token ID
    console.log(`- Created NFT with Token ID: ${tokenId} \n`);

    const tokenInfo = await new TokenInfoQuery().setTokenId(tokenId).execute(client);
    // console.table(tokenInfo.TokenName);

    // Max transaction fee as a constant
    const maxTransactionFee = new Hbar(50);

    // IPFS content identifiers for which we will create an NFT
    const CID = [
      Buffer.from(
        "ipfs://bafyreib4pff766vhpbxbhjbqqnsh5emeznvujayjj4z2iu533cprgbz23m/metadata.json"
      ),
    ];

    // Mint new batch of NFTs
    const mintTx = new TokenMintTransaction()
      .setTokenId(tokenId)
      .setMetadata(CID) // Batch minting - UP TO 10 NFTs in a single tx
      .setMaxTransactionFee(maxTransactionFee)
      .freezeWith(client);

    // Sign the transaction with the supply key
    const mintTxSign = await mintTx.sign(supplyKey);

    // Submit the transaction to a Hedera network
    const mintTxSubmit = await mintTxSign.execute(client);
    // Get the transaction receipt
    const mintRx = await mintTxSubmit.getReceipt(client);

    // Create the associate transaction and sign with My key
    const associateMyTx = await new TokenAssociateTransaction()
    .setAccountId(currAccId)
    .setTokenIds([tokenId])
    .freezeWith(client)
    .sign(currAccKey);

  // Submit the transaction to a Hedera network
  //********************const associateMyTxSubmit = await associateMyTx.execute(client);

  // Submit the transaction to a Hedera network with retry mechanism
  const associateMyTxSubmit = await executeTransaction(associateMyTx, currAccKey);

  // Get the transaction receipt
  const associateMyRx = await associateMyTxSubmit.getReceipt(client);

    // Check the balance before the transfer for the treasury account
    const balanceCheckTxTreasury = await new AccountBalanceQuery()
      .setAccountId(treasuryId)
      .execute(client);

    console.log(`- Treasury balance: ${
      balanceCheckTxTreasury.tokens
        ? balanceCheckTxTreasury.tokens._map.get(tokenId.toString())
        : 'N/A'
    } NFTs of ID ${tokenId}`);

    // Check the balance before the transfer
    const balanceCheckTxCurrAcc = await new AccountBalanceQuery()
      .setAccountId(currAccId)
      .execute(client);

    console.log(`- ${TokenName}'s balance: ${
      balanceCheckTxCurrAcc.tokens
        ? balanceCheckTxCurrAcc.tokens._map.get(tokenId.toString())
        : 'N/A'
    } NFTs of ID ${tokenId}`);

    // Transfer the NFT from treasury to SAFE RATE
    // Sign with the treasury key to authorize the transfer
    const tokenTransferTx = await new TransferTransaction()
      .addNftTransfer(tokenId, 1, treasuryId, currAccId)
      .freezeWith(client);

    const tokenTransferTxSign = await tokenTransferTx.sign(treasuryKey);

    // Submit the transaction to a Hedera network
    //*******************************const tokenTransferSubmit = await tokenTransferTxSign.execute(client);

    // Submit the transaction to a Hedera network with retry mechanism
    const tokenTransferSubmit = await executeTransaction(tokenTransferTxSign, treasuryKey);
    // Get the transaction receipt
    const tokenTransferRx = await tokenTransferSubmit.getReceipt(client);
    console.log(
      `\n- NFT transfer from Treasury to ${TokenName} ACCOUNT: ${tokenTransferRx.status} \n`
    );

    // Check the balance of the treasury account after the transfer
    const balanceCheckTxTreasuryAfter = await new AccountBalanceQuery()
      .setAccountId(treasuryId)
      .execute(client);

    console.log(`- Treasury balance after transfer: ${
      balanceCheckTxTreasuryAfter.tokens
        ? balanceCheckTxTreasuryAfter.tokens._map.get(tokenId.toString())
        : 'N/A'
    } NFTs of ID ${tokenId}`);

    // Check the balance of Safe Rate's account after the transfer
    const balanceCheckTxCurrAccAfter = await new AccountBalanceQuery()
      .setAccountId(currAccId)
      .execute(client);
    console.log(`- ${TokenName}'s balance after transfer: ${
      balanceCheckTxCurrAccAfter.tokens
        ? balanceCheckTxCurrAccAfter.tokens._map.get(tokenId.toString())
        : 'N/A'
    } NFTs of ID ${tokenId}`);
  } catch (error) {
    console.error('An error occurred:', error);
  }
}




/**
 * Creates a fungible token on the Hedera network with the specified parameters.
 *
 * The method performs the following steps:
 * 1. Creates a fungible token using the provided token name, symbol, and other parameters.
 * 2. Checks the balance of the treasury account for the created token.
 * 3. Associates the created token with the treasury account.
 *
 * @param {string} tokenName - The name of the fungible token.
 * @param {number} initialSupply - The initial supply of the fungible token.
 * @throws {Error} Throws an error if there's an issue creating the token or associating it with the treasury account.
 */
async function createFungibleToken(tokenName: string, initialSupply: number) {
  try {
    // Create the fungible token
    const tokenCreate = new TokenCreateTransaction()
      .setTokenName(tokenName)
      .setTokenSymbol(makeTokenSymbol(tokenName))
      .setTokenType(TokenType.FungibleCommon) // Change to FungibleCommon for fungible tokens
      .setDecimals(2) // Set decimals if you want to have fractional tokens
      .setInitialSupply(initialSupply) // Set the initial supply of the token
      .setTreasuryAccountId(treasuryId)
      .setSupplyType(TokenSupplyType.Infinite) 
      .setSupplyKey(supplyKey)
      .freezeWith(client);

    // Sign the transaction with the treasury key
    const tokenCreateSign = await tokenCreate.sign(treasuryKey);

    // Submit the transaction to a Hedera network
    const tokenCreateSubmit = await tokenCreateSign.execute(client);

    // Get the transaction receipt
    const tokenCreateRx = await tokenCreateSubmit.getReceipt(client);

    // Get the token ID
    const tokenId = tokenCreateRx.tokenId!;

    // Log the token ID
    console.log(`- Created fungible token with Token ID: ${tokenId} \n`);

    // Check the balance for the treasury account
    const balanceCheckTx = await new AccountBalanceQuery()
      .setAccountId(treasuryId)
      .execute(client);
      console.log(
        `- Treasury balance: ${
          balanceCheckTx.tokens?._map.get(tokenId?.toString()) ?? 'N/A'
        } units of token ID ${tokenId ?? 'N/A'}`
      );
      
    // Associate the token with the treasury account
    const associateTx = await new TokenAssociateTransaction()
      .setAccountId(treasuryId)
      .setTokenIds([tokenId])
      .freezeWith(client)
      .sign(treasuryKey);

    const associateTxSubmit = await associateTx.execute(client);
    const associateRx = await associateTxSubmit.getReceipt(client);

    // Log the token association status
    console.log(`- Token association with Treasury account: ${associateRx.status} \n`);
  } catch (error) {
    if ((error as Error).message?.includes("TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT")) {
      console.log('- Token is already associated with the Treasury account.\n');
    } else {
      throw error; // Re-throw other errors
    }
  }
}


/**
 * Creates a Non-Fungible Token (NFT) on the Hedera network with the specified parameters.
 * The method performs the following steps:
 * 1. Creates an NFT using the provided token name, symbol, and other parameters.
 * 2. Checks the balance of the treasury account for the created NFT.
 * 3. Mints a new batch of NFTs, associating them with the specified metadata.
 *
 * @param {string} TokenName - The name of the NFT.
 * @throws {Error} Throws an error if there's an issue creating the NFT or minting new tokens.
 */
async function createNft(TokenName: string): Promise<void> {
  try {
    // Create the NFT
    const nftCreate = await new TokenCreateTransaction()
      .setTokenName(TokenName)
      .setTokenSymbol(makeTokenSymbol(TokenName) as string)
      .setTokenType(TokenType.NonFungibleUnique)
      .setDecimals(0)
      .setInitialSupply(0)
      .setTreasuryAccountId(treasuryId)
      .setSupplyType(TokenSupplyType.Finite)
      .setMaxSupply(250)
      .setSupplyKey(supplyKey)
      .freezeWith(client);

    // Sign the transaction with the treasury key
    const nftCreateTxSign = await nftCreate.sign(operatorKey);

    // Submit the transaction to a Hedera network
    const nftCreateSubmit = await nftCreateTxSign.execute(client);

    // Get the transaction receipt
    const nftCreateRx = await nftCreateSubmit.getReceipt(client);

    // Get the token ID
    const tokenId = nftCreateRx.tokenId!;

    // Log the token ID
    console.log(`- Created NFT with Token ID: ${tokenId} \n`);

    // Max transaction fee as a constant
    const maxTransactionFee = new Hbar(20);

    // IPFS content identifiers for which we will create an NFT
    const CID = [
      Buffer.from(
        "ipfs://bafyreib4pff766vhpbxbhjbqqnsh5emeznvujayjj4z2iu533cprgbz23m/metadata.json"
      ),
    ];

    // Mint new batch of NFTs
    const mintTx = new TokenMintTransaction()
      .setTokenId(tokenId)
      .setMetadata(CID) // Batch minting - UP TO 10 NFTs in a single tx
      .setMaxTransactionFee(maxTransactionFee)
      .freezeWith(client);

    // Sign the transaction with the supply key
    const mintTxSign = await mintTx.sign(supplyKey);

    // Submit the transaction to a Hedera network
    //const mintTxSubmit = await mintTxSign.execute(client);

    // Submit the transaction to a Hedera network with retry mechanism
    const mintTxSubmit = await executeTransaction(mintTxSign, supplyKey);

    // Get the transaction receipt
    const mintRx = await mintTxSubmit.getReceipt(client);

    // Check the balance before the transfer for the treasury account
    const balanceCheckTx = await new AccountBalanceQuery()
      .setAccountId(treasuryId)
      .execute(client);

    // Log the token name and symbol
    console.log(`- Token Name: ${TokenName}`);
    console.log(`- Token Symbol: ${makeTokenSymbol(TokenName)}`);
  } catch (error) {
    // Handle errors, if any
    throw error;
  }
}


/**
 * Generates a unique symbol for a token based on its name.
 *
 * The symbol is created by taking the first letter of each word in the token name,
 * including any uppercase letters that are not the first letter of the words.
 * If the resulting symbol is less than 3 characters long, 'X' characters are
 * appended to ensure a minimum length of 3 characters.
 *
 * @param {string} tokenName - The name of the token for which the symbol is generated.
 * @returns {string} The generated token symbol.
 */
function makeTokenSymbol(tokenName: string): string {
  // Split the token name into words
  const words: string[] = tokenName.split(' ');
  // Take the first letter of each word to create the symbol
  let symbol: string = words.map(word => word[0]).join('');

  // Include any uppercase letters that are not the first letter of the words
  words.forEach(word => {
    for (let i = 1; i < word.length; i++) {
      if (word[i] === word[i].toUpperCase()) {
        symbol += word[i];
      }
    }
  });

  // Ensure the symbol is at least 3 characters long
  while (symbol.length < 3) {
    symbol += 'X';
  }

  return symbol.toUpperCase();
}

//  ----------------- Soulbound Tokens Test -----------------
// Lender
// Servicer
// Loan Reviewer
// Title search
// Document Record
// Impact
// Developer
// Appraiser

// createSoulboundTokens("Safe Rate", "Lender");
// createSoulboundTokens("Safe Rate", "Servicer");
// createSoulboundTokens("IntelliCredit", "Loan Reviewer");
// createSoulboundTokens("First Title", "Title search");


// ----------------- Non-Fungible Tokens Test -----------------
// Non-Fungible Tokens
// Loan beneficiary token
// Loan servicing token

createNft("Loan beneficiary token");




// ----------------- Fungible Tokens Test -----------------
// Principal outstanding
// Principal non interest outstanding
// Principal paid
// Principal written down
// Interest accumulated
// Interest paid
// Interest written down
// Fees outstanding
// Fees paid
// Fees written down
// Escrow outstanding
// Escrow received
// Escrow remitted
// Escrow written down
// Advance payment received
// Advance payment remitted

//createFungibleToken("Principal non interest outstanding",  8000);



