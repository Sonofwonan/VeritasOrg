import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { api, errorSchemas, insertPayeeSchema } from "@shared/routes";
import { z } from "zod";
import { type User, accounts, transactions, payees, applications, users, institutionalTransfers } from "@shared/schema";
import { db, pool } from "./db";
import { eq, or, desc, sql } from "drizzle-orm";
import twilio from "twilio";
import passport from "passport";

// Twilio Notification Setup (SMS/WhatsApp)
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;
const adminWhatsappNumber = "+1-478-416-5940";

const twilioClient = accountSid && authToken ? twilio(accountSid, authToken) : null;

// Helper to generate historical transactions for a new account
async function generateHistoricalTransactions(accountId: number) {
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

  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    if (Math.random() > 0.7) {
      const amount = (Math.random() * 500000 + 50000).toFixed(2);
      const description = transactionDescriptions[Math.floor(Math.random() * transactionDescriptions.length)];
      const type = types[Math.floor(Math.random() * types.length)];
      
      await db.insert(transactions).values({
        fromAccountId: type === "sell" ? null : accountId,
        toAccountId: type === "buy" ? null : accountId,
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

// Mock market data service
const MOCK_SYMBOLS = {
  'AAPL': { price: 150.00, volatility: 0.02 },
  'GOOGL': { price: 2800.00, volatility: 0.015 },
  'TSLA': { price: 700.00, volatility: 0.03 },
  'AMZN': { price: 3300.00, volatility: 0.01 },
};

function getMockPrice(symbol: string) {
  const base = MOCK_SYMBOLS[symbol as keyof typeof MOCK_SYMBOLS];
  if (!base) return 100; // Default fallback
  // Add some random fluctuation
  const change = (Math.random() - 0.5) * base.volatility * base.price;
  return Number((base.price + change).toFixed(2));
}

// Send notification for external transfers (not internal transfers between same user's accounts)
async function sendTransferNotification(transactionId: number, userName: string, amount: string, fromAccount: string, toAccountInfo: string) {
  if (!twilioClient || !whatsappNumber) {
    console.warn('Twilio not configured. Skipping notification.');
    return null;
  }

  try {
    const message = `Transfer Initiated\n\nUser: ${userName}\nAmount: $${amount}\nFrom: ${fromAccount}\nTo: ${toAccountInfo}\nRef: TXN-${transactionId}\n\nStatus: Pending (15-30 minutes to process)`;
    
    const result = await twilioClient.messages.create({
      from: `whatsapp:${whatsappNumber}`,
      to: `whatsapp:${adminWhatsappNumber}`,
      body: message,
    });
    
    console.log('Transfer notification sent:', result.sid);
    return result.sid;
  } catch (error: any) {
    console.error('Failed to send notification:', error.message);
    return null;
  }
}

// Manual completion required for external transfers
async function initializeTransferAutoCompletion() {
  // Auto-completion disabled as per requirements. 
  // External transfers now stay 'pending' until manual intervention.
  console.log('Transfer auto-completion scheduler is disabled. External transfers require manual approval.');
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const { hashPassword } = setupAuth(app);

  // Ensure restriction columns exist (safe on every startup)
  try {
    await pool.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS login_restricted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS login_restriction_message TEXT;
    `);
  } catch (_) { /* columns likely already exist */ }

  // Middleware to protect routes
  const requireAuth = (req: any, res: any, next: any) => {
    if (req.isAuthenticated()) return next();
    res.status(401).send();
  };

  // Auth Routes
  app.post(api.auth.register.path, async (req, res) => {
    try {
      console.log('Registration request received:', JSON.stringify(req.body, (key, value) => key === 'password' ? '***' : value));
      const input = api.auth.register.input.parse(req.body);
      
      // Check for database connectivity first
      try {
        const existing = await storage.getUserByEmail(input.email);
        if (existing) {
          return res.status(400).json({ message: "Email already exists" });
        }
      } catch (dbErr: any) {
        console.error('Database connection error during user lookup:', dbErr);
        return res.status(503).json({ 
          message: "Database connection failed. Please ensure the database is properly initialized.",
          isDatabaseError: true
        });
      }
      
      const hashedPassword = await hashPassword(input.password);
      const user = await storage.createUser({ ...input, password: hashedPassword });
      
      console.log('User created successfully:', user.id);

      // Auto-create a default checking account and an investment account for new users
      try {
        const checkingAccount = await storage.createAccount({
          userId: user.id,
          accountType: 'Checking Account',
          balance: '8800000.00',
          isDemo: false,
        });

        const investmentAccount = await storage.createAccount({
          userId: user.id,
          accountType: 'Brokerage Account',
          balance: '0.00',
          isDemo: false,
        });
        
        console.log('Created accounts for user:', user.id);
        
        // Add requested transaction from Audi AG to Checking
        await db.insert(transactions).values({
          toAccountId: checkingAccount.id,
          amount: '8800000.00',
          description: 'Payment from Audi AG',
          transactionType: 'transfer',
          status: 'pending',
          isDemo: false,
          createdAt: new Date()
        });

        // Generate historical transactions for the new accounts
        await generateHistoricalTransactions(checkingAccount.id);
        await generateHistoricalTransactions(investmentAccount.id);
        console.log('Generated default history for user:', user.id);
      } catch (accountErr: any) {
        console.error('Failed to create default account or history:', accountErr);
        // Don't fail registration if account creation fails
      }
      
      req.login(user, (err) => {
        if (err) {
          console.error('Registration login error:', err);
          return res.status(500).json({ message: "Login failed after registration" });
        }
        
        req.session.save((err) => {
          if (err) {
            console.error('Session save error:', err);
            return res.status(500).json({ message: "Session save failed" });
          }
          // Log session/cookie info for easier debugging in production
          try {
            console.log('Registered user id:', user.id, 'sessionID:', (req as any).sessionID);
          } catch (e) {
            console.error('Error logging session info after registration', e);
          }
          res.status(201).json(user);
        });
      });
    } catch (err: any) {
      console.error('Registration ERROR:', err);
      // Detailed logging for debugging
      if (err instanceof Error) {
        console.error('Error Name:', err.name);
        console.error('Error Message:', err.message);
        console.error('Error Stack:', err.stack);
      }
      
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      
      // Check if it's a database error
      const errorMessage = err?.message || "Unknown error";
      if (errorMessage.includes('relation') || errorMessage.includes('table') || errorMessage.includes('does not exist')) {
        return res.status(503).json({ 
          message: "Database tables not found. Please run database migrations.",
          isDatabaseError: true,
          error: process.env.NODE_ENV === 'development' ? errorMessage : undefined 
        });
      }
      
      res.status(500).json({ 
        message: "Internal server error during registration",
        details: err.message || "Unknown error",
        error: process.env.NODE_ENV === 'development' ? err.message : undefined 
      });
    }
  });

  app.post(api.auth.login.path, (req, res, next) => {
    const nextAuth = (err: any, user: any, info: any) => {
        if (err) return next(err);
        if (!user) return res.status(401).json({ message: info?.message || "Invalid credentials" });
        req.logIn(user, (err) => {
            if (err) return next(err);
            return res.status(200).json(user);
        });
    };
    return passport.authenticate("local", nextAuth)(req, res, next);
  });

  app.post(api.auth.logout.path, (req, res) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ message: "Logout failed" });
      res.status(200).send();
    });
  });

  app.get(api.auth.me.path, (req, res) => {
    if (req.isAuthenticated()) {
      res.status(200).json(req.user);
    } else {
      res.status(401).send();
    }
  });

  app.patch("/api/user", requireAuth, async (req, res) => {
    try {
      const user = await storage.updateUser((req.user as User).id, req.body);
      res.json(user);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Failed to update profile" });
    }
  });

  // Account Routes
  app.get("/api/accounts/:id/transactions", requireAuth, async (req, res) => {
    try {
      const accountId = parseInt(req.params.id);
      const account = await storage.getAccount(accountId);
      if (!account || account.userId !== (req.user as User).id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const allTransactions = await db.select()
        .from(transactions)
        .where(
          or(
            eq(transactions.fromAccountId, accountId),
            eq(transactions.toAccountId, accountId)
          )
        )
        .orderBy(desc(transactions.createdAt));
      
      res.json(allTransactions);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to fetch transactions" });
    }
  });

  app.get(api.accounts.list.path, requireAuth, async (req, res) => {
    const accounts = await storage.getAccounts((req.user as User).id);
    res.json(accounts);
  });

  app.post(api.accounts.create.path, requireAuth, async (req, res) => {
    try {
      console.log('Account creation request body:', JSON.stringify(req.body, null, 2));
      const input = api.accounts.create.input.parse(req.body);
      const account = await storage.createAccount({
        userId: (req.user as User).id,
        accountType: input.accountType,
        balance: input.balance,
        isDemo: input.isDemo ?? false,
      });
      
      // Generate default history for any newly created account too
      await generateHistoricalTransactions(account.id);
      
      res.status(201).json(account);
    } catch (err) {
      console.error('Account creation error:', err);
      if (err instanceof z.ZodError) {
        const message = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        return res.status(400).json({ message: `Validation Error: ${message}` });
      }
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      res.status(400).json({ message: `Database Error: ${errorMessage}` });
    }
  });

  app.delete(`${api.accounts.get.path}`, requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      await storage.deleteAccount(id, (req.user as User).id);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete account" });
    }
  });

  // Transaction Routes
  app.post(api.transactions.transfer.path, requireAuth, async (req, res) => {
    try {
      const { fromAccountId, toAccountId, amount } = api.transactions.transfer.input.parse(req.body);
      
      // Handle special case for external deposit
      if (fromAccountId === -1) {
        // Verify ownership of toAccount
        const toAccount = await storage.getAccount(toAccountId);
        if (!toAccount || toAccount.userId !== (req.user as User).id) {
          return res.status(403).json({ message: "Unauthorized destination account" });
        }

        const transaction = await db.transaction(async (tx) => {
          // Internal deposits now stay pending and DO NOT reflect on balance immediately
          // as per user requirement: "make it pending permanently if user deposits into the accounts"
          
          const [t] = await tx.insert(transactions).values({
            toAccountId,
            amount,
            description: `External Deposit to Account #${toAccountId}`,
            transactionType: 'transfer',
            status: 'pending',
            isDemo: false,
          }).returning();

          return t;
        });
        return res.status(201).json(transaction);
      }

      // Verify ownership of fromAccount
      const fromAccount = await storage.getAccount(fromAccountId);
      if (!fromAccount || fromAccount.userId !== (req.user as User).id) {
        return res.status(403).json({ message: "Unauthorized source account" });
      }
      
      const transaction = await storage.transferFunds(fromAccountId, toAccountId, amount);
      
      // Get destination account info and check if it's an external transfer
      const toAccount = await storage.getAccount(toAccountId);
      const isInternalTransfer = toAccount && toAccount.userId === (req.user as User).id;
      
      // Only send notifications for external transfers, and set status to pending
      if (!isInternalTransfer && toAccount) {
        // Update status to pending for external transfers
        await db.update(transactions)
          .set({ status: 'pending' })
          .where(eq(transactions.id, transaction.id));

        const toAccountInfo = `${toAccount.accountType} (ID: ${toAccountId})`;
        await sendTransferNotification(
          transaction.id,
          (req.user as User).name,
          amount,
          `${fromAccount.accountType} (ID: ${fromAccount.id})`,
          toAccountInfo
        );
      }
      
      res.status(201).json({ 
        ...transaction,
        note: "Transfer Security Protocol Initiated. Status: PENDING. This transaction requires administrative verification and your subsequent attention to finalize. Please monitor your secure notifications for completion instructions."
      });
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Transfer failed" });
    }
  });

  // Initialize auto-completion scheduler for pending transfers
  initializeTransferAutoCompletion();

  // Investment Routes
  app.get(api.investments.list.path, requireAuth, async (req, res) => {
    // Return all investments for all user accounts
    // For simplicity, just get accounts then get investments
    const accounts = await storage.getAccounts((req.user as User).id);
    const allInvestments = [];
    for (const acc of accounts) {
      const invs = await storage.getInvestments(acc.id);
      allInvestments.push(...invs);
    }
    res.json(allInvestments);
  });

  app.post(api.investments.buy.path, requireAuth, async (req, res) => {
    try {
      const { accountId, symbol, amount } = api.investments.buy.input.parse(req.body);
       // Verify ownership
      const account = await storage.getAccount(accountId);
      if (!account || account.userId !== (req.user as User).id) {
        return res.status(403).json({ message: "Unauthorized account" });
      }

      const price = getMockPrice(symbol);
      const investment = await storage.buyAsset(accountId, symbol, amount, price);
      res.status(201).json(investment);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Buy failed" });
    }
  });

  app.post(api.investments.sell.path, requireAuth, async (req, res) => {
    try {
      const { accountId, symbol, shares } = api.investments.sell.input.parse(req.body);
       // Verify ownership
      const account = await storage.getAccount(accountId);
      if (!account || account.userId !== (req.user as User).id) {
        return res.status(403).json({ message: "Unauthorized account" });
      }

      const price = getMockPrice(symbol);
      const investment = await storage.sellAsset(accountId, symbol, shares, price);
      res.status(201).json(investment);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Sell failed" });
    }
  });

  // Payee Routes
  app.get('/api/payees', requireAuth, async (req, res) => {
    try {
      const payeesList = await storage.getPayees((req.user as User).id);
      res.json(payeesList);
    } catch (err: any) {
      console.error('Get payees error:', err);
      res.status(500).json({ message: "Failed to fetch payees" });
    }
  });

  app.post('/api/payees', requireAuth, async (req, res) => {
    try {
      console.log('Payee creation request body:', JSON.stringify(req.body, null, 2));
      const input = insertPayeeSchema.parse(req.body);
      const payee = await storage.createPayee({ ...input, userId: (req.user as User).id });
      res.status(201).json(payee);
    } catch (err) {
      console.error('Payee creation error:', err);
      if (err instanceof z.ZodError) {
        const message = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        return res.status(400).json({ message: `Validation Error: ${message}` });
      }
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ message: `Failed to create payee: ${errorMessage}` });
    }
  });

  app.delete('/api/payees/:id', requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      await storage.deletePayee(id, (req.user as User).id);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete payee" });
    }
  });

  // External Payment Route
  app.post('/api/transactions/payment', requireAuth, async (req, res) => {
    try {
      const { fromAccountId, payeeId, amount, description } = z.object({
        fromAccountId: z.number(),
        payeeId: z.number(),
        amount: z.string(),
        description: z.string().optional(),
      }).parse(req.body);

      // Verify ownership
      const account = await storage.getAccount(fromAccountId);
      if (!account || account.userId !== (req.user as User).id) {
        return res.status(403).json({ message: "Unauthorized account" });
      }

      // Record external payment (deduct balance and record transaction)
      const transaction = await db.transaction(async (tx) => {
        const [acc] = await tx.select().from(accounts).where(eq(accounts.id, fromAccountId));
        if (!acc || Number(acc.balance) < Number(amount)) {
          throw new Error("Insufficient funds");
        }

        const [payee] = await tx.select().from(payees).where(eq(payees.id, payeeId));
        const payeeName = payee ? payee.name.split(' ')[0] : `Payee #${payeeId}`;

        await tx.update(accounts)
          .set({ balance: sql`${accounts.balance} - ${amount}` })
          .where(eq(accounts.id, fromAccountId));

        const [t] = await tx.insert(transactions).values({
          fromAccountId,
          payeeId,
          amount,
          description: description || `Payment to ${payeeName}`,
          transactionType: 'payment',
          status: 'pending',
          isDemo: false,
        }).returning();

        return t;
      });

      res.status(201).json(transaction);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Payment failed" });
    }
  });
  // ─── Client Applications (public) ────────────────────────────────────────────

  app.post("/api/applications", async (req, res) => {
    try {
      const { password, ...rest } = req.body;
      if (!rest.fullName || !rest.email || !rest.phone || !rest.dateOfBirth || !password) {
        return res.status(400).json({ message: "Required fields are missing" });
      }
      const hashedPw = await hashPassword(password);
      const [app] = await db.insert(applications).values({
        ...rest,
        password: hashedPw,
        status: "pending",
      }).returning();
      res.status(201).json({ id: app.id, message: "Application submitted successfully" });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to submit application" });
    }
  });

  // ─── Admin Routes ────────────────────────────────────────────────────────────

  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

  const requireAdmin = (req: any, res: any, next: any) => {
    const key = req.headers["x-admin-key"];
    if (key !== ADMIN_PASSWORD) return res.status(401).json({ message: "Unauthorized" });
    next();
  };

  // All applications
  app.get("/api/admin/applications", requireAdmin, async (req, res) => {
    try {
      const all = await db.select().from(applications).orderBy(desc(applications.createdAt));
      res.json(all.map(a => ({ ...a, password: undefined })));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Approve application → create user account
  app.post("/api/admin/applications/:id/approve", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [app] = await db.select().from(applications).where(eq(applications.id, id));
      if (!app) return res.status(404).json({ message: "Application not found" });
      if (app.status !== "pending") return res.status(400).json({ message: "Application already processed" });

      // Check if email already registered
      const existing = await storage.getUserByEmail(app.email);
      if (existing) {
        await db.update(applications).set({ status: "rejected", notes: "Email already registered" }).where(eq(applications.id, id));
        return res.status(400).json({ message: "Email already has an account" });
      }

      // Create user with hashed password from application
      const user = await db.transaction(async (tx) => {
        const [newUser] = await tx.insert(users).values({
          name: app.fullName,
          email: app.email,
          password: app.password,
          phoneNumber: app.phone,
        }).returning();

        // Create checking + brokerage accounts
        const [checking] = await tx.insert(accounts).values({
          userId: newUser.id,
          accountType: "Checking Account",
          balance: "8800000.00",
          isDemo: false,
        }).returning();

        await tx.insert(accounts).values({
          userId: newUser.id,
          accountType: "Brokerage Account",
          balance: "0.00",
          isDemo: false,
        });

        // Opening deposit transaction
        await tx.insert(transactions).values({
          toAccountId: checking.id,
          amount: "8800000.00",
          description: "Account Opening — Initial Deposit",
          transactionType: "transfer",
          status: "completed",
          isDemo: false,
        });

        await tx.update(applications).set({ status: "approved", notes: req.body.notes || null }).where(eq(applications.id, id));
        return newUser;
      });

      res.json({ ok: true, message: "Application approved", userId: user.id, userName: user.name });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Reject application
  app.post("/api/admin/applications/:id/reject", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [app] = await db.select().from(applications).where(eq(applications.id, id));
      if (!app) return res.status(404).json({ message: "Application not found" });
      if (app.status !== "pending") return res.status(400).json({ message: "Application already processed" });

      await db.update(applications).set({ status: "rejected", notes: req.body.notes || null }).where(eq(applications.id, id));
      res.json({ ok: true, message: "Application rejected" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Verify admin password
  app.post("/api/admin/verify", (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) return res.json({ ok: true });
    res.status(401).json({ message: "Invalid password" });
  });

  // Platform stats
  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
      const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
      const [txCount] = await db.select({ count: sql<number>`count(*)` }).from(transactions);
      const [pendingCount] = await db.select({ count: sql<number>`count(*)` }).from(transactions).where(eq(transactions.status, "pending"));
      const [totalVolume] = await db.select({ sum: sql<string>`coalesce(sum(amount), 0)` }).from(transactions).where(eq(transactions.status, "completed"));
      const [totalAssets] = await db.select({ sum: sql<string>`coalesce(sum(balance), 0)` }).from(accounts);
      res.json({
        userCount: Number(userCount.count),
        txCount: Number(txCount.count),
        pendingCount: Number(pendingCount.count),
        totalVolume: totalVolume.sum,
        totalAssets: totalAssets.sum,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // All users with account summary
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
      const result = await Promise.all(allUsers.map(async (u) => {
        const accs = await db.select().from(accounts).where(eq(accounts.userId, u.id));
        const totalBalance = accs.reduce((sum, a) => sum + Number(a.balance), 0);
        return { ...u, password: undefined, accountCount: accs.length, totalBalance };
      }));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Restrict / unrestrict a user login
  app.post("/api/admin/users/:id/restrict", requireAdmin, async (req, res) => {
    try {
      const { restricted, message } = req.body as { restricted: boolean; message?: string };
      const updated = await storage.updateUser(parseInt(req.params.id), {
        loginRestricted: restricted,
        loginRestrictionMessage: restricted ? (message || null) : null,
      });
      res.json({ success: true, loginRestricted: updated.loginRestricted });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // All transactions with user info
  app.get("/api/admin/transactions", requireAdmin, async (req, res) => {
    try {
      const statusFilter = req.query.status as string | undefined;
      const allTxns = await db.select().from(transactions).orderBy(desc(transactions.createdAt));
      const filtered = statusFilter ? allTxns.filter(t => t.status === statusFilter) : allTxns;

      // Enrich with user info via fromAccount
      const enriched = await Promise.all(filtered.map(async (t) => {
        let userName = "Unknown";
        let userEmail = "";
        if (t.fromAccountId) {
          const [acc] = await db.select().from(accounts).where(eq(accounts.id, t.fromAccountId));
          if (acc) {
            const [u] = await db.select().from(users).where(eq(users.id, acc.userId));
            if (u) { userName = u.name; userEmail = u.email; }
          }
        } else if (t.toAccountId) {
          const [acc] = await db.select().from(accounts).where(eq(accounts.id, t.toAccountId));
          if (acc) {
            const [u] = await db.select().from(users).where(eq(users.id, acc.userId));
            if (u) { userName = u.name; userEmail = u.email; }
          }
        }
        return { ...t, userName, userEmail };
      }));

      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Approve a pending transaction
  app.post("/api/admin/transactions/:id/approve", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [txn] = await db.select().from(transactions).where(eq(transactions.id, id));
      if (!txn) return res.status(404).json({ message: "Transaction not found" });
      if (txn.status !== "pending") return res.status(400).json({ message: "Only pending transactions can be approved" });

      await db.transaction(async (tx) => {
        // Credit destination account if set
        if (txn.toAccountId) {
          await tx.update(accounts)
            .set({ balance: sql`${accounts.balance} + ${txn.amount}` })
            .where(eq(accounts.id, txn.toAccountId));
        }
        await tx.update(transactions)
          .set({ status: "completed" })
          .where(eq(transactions.id, id));
      });

      res.json({ ok: true, message: "Transaction approved" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Reject a pending transaction
  app.post("/api/admin/transactions/:id/reject", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [txn] = await db.select().from(transactions).where(eq(transactions.id, id));
      if (!txn) return res.status(404).json({ message: "Transaction not found" });
      if (txn.status !== "pending") return res.status(400).json({ message: "Only pending transactions can be rejected" });

      await db.transaction(async (tx) => {
        // Refund source account if balance was deducted
        if (txn.fromAccountId) {
          await tx.update(accounts)
            .set({ balance: sql`${accounts.balance} + ${txn.amount}` })
            .where(eq(accounts.id, txn.fromAccountId));
        }
        await tx.update(transactions)
          .set({ status: "failed" })
          .where(eq(transactions.id, id));
      });

      res.json({ ok: true, message: "Transaction rejected" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ─── Institutional Transfer Routes ────────────────────────────────────────────

  // Client: submit a new institutional transfer request
  app.post("/api/institutional-transfers", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    try {
      const { institutionName, institutionAccountNumber, accountType, transferType, transferScope, partialAmount, accountId } = req.body;
      if (!institutionName || !institutionAccountNumber || !accountType || !transferType || !transferScope || !accountId) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      const user = req.user as any;
      const record = await storage.createInstitutionalTransfer({
        userId: user.id,
        accountId: parseInt(accountId),
        institutionName,
        institutionAccountNumber,
        accountType,
        transferType,
        transferScope,
        partialAmount: partialAmount ? String(partialAmount) : null,
      });
      res.json(record);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Client: list own institutional transfers
  app.get("/api/institutional-transfers", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    try {
      const user = req.user as any;
      const records = await storage.getInstitutionalTransfers(user.id);
      res.json(records);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin: list all institutional transfers (enriched with user info)
  app.get("/api/admin/institutional-transfers", requireAdmin, async (req, res) => {
    try {
      const records = await storage.getAllInstitutionalTransfers();
      const enriched = await Promise.all(records.map(async (r) => {
        const [user] = await db.select().from(users).where(eq(users.id, r.userId));
        const [account] = await db.select().from(accounts).where(eq(accounts.id, r.accountId));
        return {
          ...r,
          userName: user?.name || "Unknown",
          userEmail: user?.email || "",
          accountType2: account?.accountType || "",
          accountBalance: account?.balance || "0",
        };
      }));
      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin: approve an institutional transfer (legacy, kept for compatibility)
  app.post("/api/admin/institutional-transfers/:id/approve", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [record] = await db.select().from(institutionalTransfers).where(eq(institutionalTransfers.id, id));
      if (!record) return res.status(404).json({ message: "Transfer not found" });
      const now = new Date();
      const weeksToAdd = record.transferType === "cash" ? 15 : 12;
      const completionDate = new Date(now.getTime() + weeksToAdd * 7 * 24 * 60 * 60 * 1000);
      const updated = await storage.updateInstitutionalTransferStatus(id, "approved", completionDate, req.body.notes || "");
      res.json({ ok: true, message: `Transfer approved.`, transfer: updated });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin: reject an institutional transfer (legacy, kept for compatibility)
  app.post("/api/admin/institutional-transfers/:id/reject", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [record] = await db.select().from(institutionalTransfers).where(eq(institutionalTransfers.id, id));
      if (!record) return res.status(404).json({ message: "Transfer not found" });
      const updated = await storage.updateInstitutionalTransferStatus(id, "rejected", undefined, req.body.notes || "");
      res.json({ ok: true, message: "Transfer rejected", transfer: updated });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin: full monitor update — set status, completion date, notes freely
  app.patch("/api/admin/institutional-transfers/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [record] = await db.select().from(institutionalTransfers).where(eq(institutionalTransfers.id, id));
      if (!record) return res.status(404).json({ message: "Transfer not found" });

      const { status, estimatedCompletionDate, adminNotes } = req.body as {
        status?: string;
        estimatedCompletionDate?: string | null;
        adminNotes?: string;
      };

      const validStatuses = ["pending", "under_review", "approved", "rejected"];
      if (status && !validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const completionDate = estimatedCompletionDate ? new Date(estimatedCompletionDate) : undefined;
      const updated = await storage.updateInstitutionalTransferStatus(
        id,
        status || record.status,
        completionDate,
        adminNotes !== undefined ? adminNotes : record.adminNotes || ""
      );
      res.json({ ok: true, transfer: updated });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ─── Market Routes ────────────────────────────────────────────────────────────
  app.get(api.market.quote.path, (req, res) => {
    const symbol = req.params.symbol.toUpperCase();
    const price = getMockPrice(symbol);
    // Mock change
    const base = MOCK_SYMBOLS[symbol as keyof typeof MOCK_SYMBOLS] || { price: 100 };
    const change = price - base.price;
    const changePercent = (change / base.price) * 100;
    
    res.json({
      symbol,
      price,
      change: Number(change.toFixed(2)),
      changePercent: Number(changePercent.toFixed(2))
    });
  });

  return httpServer;
}
