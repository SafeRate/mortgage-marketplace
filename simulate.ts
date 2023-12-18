import { createSoulboundTokens, createNft, createFungibleToken } from './setup'; // Update the path as needed

async function simulate() {
  try {
    // ----------------- Soulbound Tokens Test -----------------
    await createSoulboundTokens("Safe Rate", "Lender");
    await createSoulboundTokens("Safe Rate", "Servicer");
    await createSoulboundTokens("IntelliCredit", "Loan Reviewer");
    await createSoulboundTokens("First Title", "Title search");

    // ----------------- Non-Fungible Tokens Test -----------------
    await createNft("Loan beneficiary token");

    // ----------------- Fungible Tokens Test -----------------
    await createFungibleToken("Principal non interest outstanding", 8000);
    
    // ----------------- Additional Simulated Transactions -----------------
    // Perform additional simulated transactions as needed

  } catch (error) {
    console.error('An error occurred during simulation:', error);
  }
}

// Run the simulation
simulate();
