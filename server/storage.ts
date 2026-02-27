import { db } from "./db";
import { eq, sql, and } from "drizzle-orm";
import {
  users, accounts, transactions, investments, payees,
  type User, type InsertUser, type Account, type InsertAccount,
  type Transaction, type InsertTransaction, type Investment, type InsertInvestment,
  type Payee, type InsertPayee
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<User>): Promise<User>;

  // Accounts
  getAccounts(userId: number): Promise<Account[]>;
  getAccount(id: number): Promise<Account | undefined>;
  createAccount(account: InsertAccount): Promise<Account>;
  
  // Investments
  getInvestments(accountId: number): Promise<Investment[]>;
  
  // Transactions (Atomic Operations)
  transferFunds(fromAccountId: number, toAccountId: number, amount: string): Promise<Transaction>;
  buyAsset(accountId: number, symbol: string, amount: string, price: number): Promise<Investment>;
  sellAsset(accountId: number, symbol: string, shares: string, price: number): Promise<Investment>;
  // Payees
  getPayees(userId: number): Promise<Payee[]>;
  createPayee(payee: InsertPayee): Promise<Payee>;
  deletePayee(id: number, userId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // ... existing methods ...

  async getPayees(userId: number): Promise<Payee[]> {
    return await db.select().from(payees).where(eq(payees.userId, userId));
  }

  async createPayee(insertPayee: InsertPayee): Promise<Payee> {
    const [payee] = await db.insert(payees).values(insertPayee).returning();
    return payee;
  }

  async deletePayee(id: number, userId: number): Promise<void> {
    await db.delete(payees).where(and(eq(payees.id, id), eq(payees.userId, userId)));
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: number, data: Partial<User>): Promise<User> {
    const [user] = await db.update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    if (!user) throw new Error("User not found");
    return user;
  }

  async getAccounts(userId: number): Promise<Account[]> {
    try {
      return await db.select().from(accounts).where(eq(accounts.userId, userId));
    } catch (err) {
      console.error('Error fetching accounts for user:', userId, err);
      throw err;
    }
  }

  async getAccount(id: number): Promise<Account | undefined> {
    const [account] = await db.select().from(accounts).where(eq(accounts.id, id));
    return account;
  }

  async createAccount(insertAccount: any): Promise<Account> {
    const [account] = await db.insert(accounts).values({
      userId: insertAccount.userId,
      accountType: insertAccount.accountType,
      balance: String(insertAccount.balance || "0"),
      isDemo: insertAccount.isDemo ?? true,
    }).returning();
    return account;
  }

  async deleteAccount(id: number, userId: number): Promise<void> {
    await db.delete(accounts).where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
  }

  async getInvestments(accountId: number): Promise<Investment[]> {
    return await db.select().from(investments).where(eq(investments.accountId, accountId));
  }

  async transferFunds(fromAccountId: number, toAccountId: number, amount: string): Promise<Transaction> {
    return await db.transaction(async (tx) => {
      // 1. Deduct from sender
      const [fromAccount] = await tx.select().from(accounts).where(eq(accounts.id, fromAccountId));
      if (!fromAccount) throw new Error("Source account not found");
      if (Number(fromAccount.balance) < Number(amount)) throw new Error("Insufficient funds");

      await tx.update(accounts)
        .set({ balance: sql`${accounts.balance} - ${amount}` })
        .where(eq(accounts.id, fromAccountId));

      // 2. Add to receiver if it's an internal transfer (same user)
      const [toAccount] = await tx.select().from(accounts).where(eq(accounts.id, toAccountId));
      const status = (toAccount && toAccount.userId === fromAccount.userId) ? 'completed' : 'pending';

      if (status === 'completed' && toAccount) {
        await tx.update(accounts)
          .set({ balance: sql`${accounts.balance} + ${amount}` })
          .where(eq(accounts.id, toAccountId));
      }

      // 3. Record transaction
      const [transaction] = await tx.insert(transactions).values({
        fromAccountId,
        toAccountId,
        amount,
        description: `Transfer from Account #${fromAccountId} to Account #${toAccountId}`,
        transactionType: 'transfer',
        status: status,
        isDemo: false,
      }).returning();

      return transaction;
    });
  }

  async buyAsset(accountId: number, symbol: string, amount: string, price: number): Promise<Investment> {
    return await db.transaction(async (tx) => {
      // 1. Check balance
      const [account] = await tx.select().from(accounts).where(eq(accounts.id, accountId));
      if (!account) throw new Error("Account not found");
      if (Number(account.balance) < Number(amount)) throw new Error("Insufficient funds");

      // 2. Deduct balance
      await tx.update(accounts)
        .set({ balance: sql`${accounts.balance} - ${amount}` })
        .where(eq(accounts.id, accountId));

      // 3. Calculate shares
      const shares = (Number(amount) / price).toFixed(4);

      // 4. Update or Insert investment
      // Check if already owns this symbol
      const [existing] = await tx.select().from(investments)
        .where(and(eq(investments.accountId, accountId), eq(investments.symbol, symbol)));

      let investment;
      if (existing) {
        // Update existing
         [investment] = await tx.update(investments)
          .set({ 
            shares: sql`${investments.shares} + ${shares}`,
            // Weighted average price could be implemented here, but for simplicity keep purchase price of last or initial?
            // Let's keep purchase price as average cost basis
            purchasePrice: sql`((${investments.shares} * ${investments.purchasePrice}) + (${shares} * ${price})) / (${investments.shares} + ${shares})`
          })
          .where(eq(investments.id, existing.id))
          .returning();
      } else {
        // Insert new
        [investment] = await tx.insert(investments).values({
          accountId,
          symbol,
          shares,
          purchasePrice: String(price),
          currentPrice: String(price),
        }).returning();
      }

      // 3. Record transaction
      const [transaction] = await tx.insert(transactions).values({
        fromAccountId: accountId, // Used as source for 'buy'
        amount,
        description: `Purchase of ${shares} shares of ${symbol}`,
        transactionType: 'buy',
        status: 'completed',
        isDemo: false,
      }).returning();

      return investment;
    });
  }

  async sellAsset(accountId: number, symbol: string, shares: string, price: number): Promise<Investment> {
    return await db.transaction(async (tx) => {
      // 1. Check shares
      const [existing] = await tx.select().from(investments)
        .where(and(eq(investments.accountId, accountId), eq(investments.symbol, symbol)));

      if (!existing || Number(existing.shares) < Number(shares)) throw new Error("Insufficient shares");

      const amount = (Number(shares) * price).toFixed(2);

      // 2. Add balance
      await tx.update(accounts)
        .set({ balance: sql`${accounts.balance} + ${amount}` })
        .where(eq(accounts.id, accountId));

      // 3. Deduct shares
      let investment;
      const newShares = Number(existing.shares) - Number(shares);
      
      if (newShares <= 0.0001) { // Floating point safety, if ~0 delete
         await tx.delete(investments).where(eq(investments.id, existing.id));
         // Return a dummy investment object or the deleted one for response?
         // We'll return the state before deletion but with 0 shares to indicate sold out
         investment = { ...existing, shares: "0" };
      } else {
         [investment] = await tx.update(investments)
          .set({ shares: String(newShares) })
          .where(eq(investments.id, existing.id))
          .returning();
      }

      // 4. Record transaction
      await tx.insert(transactions).values({
        toAccountId: accountId, // Used as destination for 'sell' proceeds
        amount,
        description: `Sale of ${shares} shares of ${symbol}`,
        transactionType: 'sell',
        status: 'completed',
        isDemo: false,
      });

      return investment;
    });
  }
}

export const storage = new DatabaseStorage();
