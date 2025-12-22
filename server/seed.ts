import { storage } from "./storage";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function run() {
  const existingUser = await storage.getUserByEmail("demo@example.com");
  if (!existingUser) {
    const password = await hashPassword("demo123");
    const user = await storage.createUser({
      name: "Demo User",
      email: "demo@example.com",
      password,
    });
    
    // Create accounts
    const cashAccount = await storage.createAccount({
      userId: user.id,
      accountType: "cash",
      balance: "10000",
      isDemo: true
    });
    
    const investmentAccount = await storage.createAccount({
      userId: user.id,
      accountType: "investment",
      balance: "5000",
      isDemo: true
    });
    
    // Add some initial investments
    // Mock prices: AAPL 150, GOOGL 2800
    await storage.buyAsset(investmentAccount.id, "AAPL", "1500", 150); // 10 shares
    await storage.buyAsset(investmentAccount.id, "GOOGL", "2800", 2800); // 1 share
    
    console.log("Seed completed");
  } else {
    console.log("Already seeded");
  }
}

run().catch(console.error);
