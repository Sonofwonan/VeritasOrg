
import { db } from "./server/db";
import { transactions, accounts } from "./shared/schema";
import { sql } from "drizzle-orm";

async function generateHistory() {
  console.log("Starting historical transaction generation...");
  
  // Get all accounts
  const allAccounts = await db.select().from(accounts);
  if (allAccounts.length === 0) {
    console.log("No accounts found. Please create an account first.");
    process.exit(0);
  }

  const startDate = new Date("2025-01-01");
  const endDate = new Date("2025-07-31");
  const oneDay = 24 * 60 * 60 * 1000;

  const transactionDescriptions = [
    "Venture Capital Distribution",
    "Quarterly Portfolio Rebalancing",
    "Private Equity Capital Call",
    "Institutional Asset Transfer",
    "Dividend Reinvestment",
    "Real Estate Investment Trust Distribution",
    "Hedge Fund Liquidity Event",
    "Merger & Acquisition Proceeds",
    "Tax-Loss Harvesting Sell",
    "Strategic Equity Buy"
  ];

  const types = ["transfer", "buy", "sell", "payment", "withdrawal"] as const;

  for (const account of allAccounts) {
    console.log(`Generating history for Account #${account.id}...`);
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      // Randomly decide if a transaction happens on this day (approx every 3-5 days)
      if (Math.random() > 0.7) {
        const amount = (Math.random() * 500000 + 50000).toFixed(2); // Large sums: 50k to 550k
        const description = transactionDescriptions[Math.floor(Math.random() * transactionDescriptions.length)];
        const type = types[Math.floor(Math.random() * types.length)];
        
        await db.insert(transactions).values({
          fromAccountId: type === "sell" ? null : account.id,
          toAccountId: type === "buy" ? null : account.id,
          amount,
          description: `${description} - ${currentDate.toLocaleDateString()}`,
          transactionType: type,
          status: "completed",
          isDemo: false,
          createdAt: new Date(currentDate)
        });
      }
      currentDate = new Date(currentDate.getTime() + oneDay);
    }
  }

  console.log("Historical transaction generation complete.");
  process.exit(0);
}

generateHistory().catch(err => {
  console.error(err);
  process.exit(1);
});
