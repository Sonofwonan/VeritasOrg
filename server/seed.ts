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
    
    // Seed only an investment account; the project does not support liquid cash accounts.
    const investmentAccount = await storage.createAccount({
      userId: user.id,
      accountType: "Brokerage Account",
      balance: "0",
      isDemo: true
    });
    
    console.log("Seed completed");
  } else {
    console.log("Already seeded");
  }
}

run().catch(console.error);
