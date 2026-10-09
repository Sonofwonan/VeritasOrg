import type { Express } from "express";
import { createServer, type Server } from "http";
import { createHash, randomBytes } from "crypto";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { api, errorSchemas, insertPayeeSchema } from "@shared/routes";
import { z } from "zod";
import { type User, accounts, transactions, payees, applications, users, institutionalTransfers, accountSetupTokens } from "@shared/schema";
import { db, pool } from "./db";
import { eq, or, desc, sql } from "drizzle-orm";
import twilio from "twilio";
import passport from "passport";
import { registerFeeRoutes } from "./fees/routes";
import { moneyToCents } from "@shared/fees";
import { approvePayment, FundsAccessError, fundsAccess, fundsAccessGuard } from "./funds-access";
import { accountLabel } from "@shared/account-display";
import { registerDisplayCurrencyRoutes } from "./display-currency";

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

  // Ensure new columns exist (safe on every startup)
  try {
    await pool.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS login_restricted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS login_restriction_message TEXT,
        ADD COLUMN IF NOT EXISTS display_currency TEXT NOT NULL DEFAULT 'CAD',
        ADD COLUMN IF NOT EXISTS debt_clearance_required BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS debt_payment_account_id INTEGER,
        ADD COLUMN IF NOT EXISTS debt_payment_confirmed_at TIMESTAMP;
      ALTER TABLE payees
        ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending_approval',
        ADD COLUMN IF NOT EXISTS admin_notes TEXT;
      ALTER TABLE transactions
        ADD COLUMN IF NOT EXISTS admin_notes TEXT;
      ALTER TABLE institutional_transfers
        ADD COLUMN IF NOT EXISTS portfolio_snapshot TEXT;
      ALTER TABLE institutional_transfers
        ALTER COLUMN account_id DROP NOT NULL;
      ALTER TABLE institutional_transfers
        ADD COLUMN IF NOT EXISTS account_holder_type TEXT;
      ALTER TABLE institutional_transfers
        ADD COLUMN IF NOT EXISTS account_holder_name TEXT;
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS account_frozen BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS freeze_reason TEXT,
        ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMP;
      ALTER TABLE applications ALTER COLUMN password DROP NOT NULL;
      CREATE TABLE IF NOT EXISTS account_setup_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        consumed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS account_setup_tokens_user_id_idx ON account_setup_tokens(user_id);
    `);
  } catch (_) { /* columns likely already exist */ }

  const INACTIVITY_LIMIT_MS = 25 * 60 * 1000;

  // Middleware to protect routes — enforces 25-minute inactivity timeout + freeze check
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const lastActivity = req.session?.lastActivity;
    if (lastActivity && Date.now() - lastActivity > INACTIVITY_LIMIT_MS) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: "Session expired due to inactivity" });
    }
    if ((req.user as any)?.accountFrozen) {
      return res.status(423).json({ message: "ACCOUNT_FROZEN", freezeReason: (req.user as any).freezeReason });
    }
    return next();
  };

  // Middleware: block all write operations while an active liquidation is in progress
  const LIQUIDATION_ACTIVE_STATUSES = ["liquidating", "approved", "transfer_out"];
  const requireNoLiquidation = async (req: any, res: any, next: any) => {
    try {
      const userId = (req.user as User).id;
      const transfers = await db
        .select({ status: institutionalTransfers.status })
        .from(institutionalTransfers)
        .where(eq(institutionalTransfers.userId, userId));
      const hasActive = transfers.some(t => LIQUIDATION_ACTIVE_STATUSES.includes(t.status ?? ""));
      if (hasActive) {
        return res.status(423).json({
          message: "LIQUIDATION_IN_PROGRESS",
          detail: "This account is currently under an active portfolio liquidation. All transactions, investments, and account changes are suspended until the transfer is complete.",
        });
      }
    } catch (_) { /* fail open — don't block on DB error */ }
    return next();
  };

  const INVESTMENT_ACCOUNT_TYPES = new Set([
    "Brokerage Account",
    "Traditional IRA",
    "Roth IRA",
    "401(k) / 403(b)",
    "529 Savings Plan",
    "Trust Account",
  ]);
  const requireFundsAccess = fundsAccessGuard(pool);
  const requireFundsAccessOrDeposit = fundsAccessGuard(pool, true);

  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
  const requireAdmin = (req: any, res: any, next: any) => {
    const key = req.headers["x-admin-key"];
    if (key !== ADMIN_PASSWORD) return res.status(401).json({ message: "Unauthorized" });
    next();
  };

  await registerFeeRoutes(app, pool, requireAdmin);
  await registerDisplayCurrencyRoutes(app, pool, requireAdmin);

  // Auth Routes
  app.post(api.auth.register.path, (_req, res) => {
    res.status(410).json({
      message: "Direct registration is disabled. Submit an application and wait for approval.",
    });
  });

  app.post(api.auth.login.path, (req, res, next) => {
    const nextAuth = (err: any, user: any, info: any) => {
        if (err) return next(err);
        if (!user) return res.status(401).json({ message: info?.message || "Invalid credentials" });
        req.logIn(user, (err) => {
            if (err) return next(err);
            (req.session as any).lastActivity = Date.now();
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

  app.patch("/api/user", requireAuth, requireNoLiquidation, async (req, res) => {
    if (["debtClearanceRequired", "debtPaymentAccountId", "debtPaymentConfirmedAt"].some(key => key in req.body)) {
      return res.status(403).json({ message: "Funds access policy cannot be changed by the client" });
    }
    // Currency is an explicitly authorized designation, not a self-service
    // preference: changing a symbol does not convert the underlying ledger.
    if (Object.prototype.hasOwnProperty.call(req.body, "displayCurrency")) {
      return res.status(403).json({ message: "Balance display currency cannot be changed through client profile settings" });
    }
    try {
      const user = await storage.updateUser((req.user as User).id, req.body);
      res.json(user);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Failed to update profile" });
    }
  });

  // Account Routes
  app.get("/api/transactions", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const ledger = await db.select().from(transactions)
        .where(sql`EXISTS (SELECT 1 FROM accounts a WHERE a.user_id=${userId}
          AND (a.id=${transactions.fromAccountId} OR a.id=${transactions.toAccountId}))`)
        .orderBy(desc(transactions.createdAt),desc(transactions.id));
      res.json(ledger);
    } catch {
      res.status(500).json({ message:"Failed to fetch portfolio transactions" });
    }
  });

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
  app.get("/api/funds-access", requireAuth, async (req, res) => {
    try { res.json(await fundsAccess(pool, (req.user as User).id)); }
    catch { res.status(503).json({ message: "Funds access status unavailable" }); }
  });

  app.post(api.accounts.create.path, requireAuth, requireFundsAccess, requireNoLiquidation, async (req, res) => {
    try {
      console.log('Account creation request body:', JSON.stringify(req.body, null, 2));
      const input = api.accounts.create.input.parse(req.body);
      if (!INVESTMENT_ACCOUNT_TYPES.has(input.accountType)) {
        return res.status(400).json({
          message: "Only investment and retirement accounts are available. Liquid cash accounts are not supported.",
        });
      }
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

  app.delete(`${api.accounts.get.path}`, requireAuth, requireFundsAccess, requireNoLiquidation, async (req, res) => {
    try {
      const id = Number(req.params.id);
      await storage.deleteAccount(id, (req.user as User).id);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete account" });
    }
  });

  // Transaction Routes
  app.post(api.transactions.transfer.path, requireAuth, requireFundsAccessOrDeposit, requireNoLiquidation, async (req, res) => {
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
            description: `External Deposit to ${accountLabel(toAccount)}`,
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

  app.post(api.investments.buy.path, requireAuth, requireFundsAccess, requireNoLiquidation, async (req, res) => {
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

  app.post(api.investments.sell.path, requireAuth, requireFundsAccess, requireNoLiquidation, async (req, res) => {
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

  // Admin: list all payees across all users
  app.get('/api/admin/payees', requireAdmin, async (req, res) => {
    try {
      const all = await db.select().from(payees).orderBy(desc(payees.createdAt));
      const enriched = await Promise.all(all.map(async (p) => {
        const [user] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, p.userId));
        return { ...p, userName: user?.name || "Unknown", userEmail: user?.email || "" };
      }));
      res.json(enriched);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Admin: approve a beneficiary
  app.post('/api/admin/payees/:id/approve', requireAdmin, async (req, res) => {
    try {
      const [updated] = await db.update(payees)
        .set({ status: 'approved', adminNotes: req.body.notes || null })
        .where(eq(payees.id, parseInt(req.params.id)))
        .returning();
      res.json({ ok: true, payee: updated });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Admin: reject a beneficiary
  app.post('/api/admin/payees/:id/reject', requireAdmin, async (req, res) => {
    try {
      const [updated] = await db.update(payees)
        .set({ status: 'rejected', adminNotes: req.body.notes || null })
        .where(eq(payees.id, parseInt(req.params.id)))
        .returning();
      res.json({ ok: true, payee: updated });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Admin: list all wire disbursement transactions (payment type)
  app.get('/api/admin/wire-transfers', requireAdmin, async (req, res) => {
    try {
      const all = await db.select().from(transactions)
        .where(eq(transactions.transactionType, 'payment'))
        .orderBy(desc(transactions.createdAt));
      const enriched = await Promise.all(all.map(async (t) => {
        let userName = "Unknown", userEmail = "";
        if (t.fromAccountId) {
          const [acc] = await db.select().from(accounts).where(eq(accounts.id, t.fromAccountId));
          if (acc) {
            const [u] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, acc.userId));
            if (u) { userName = u.name; userEmail = u.email; }
          }
        }
        let payeeName = "Unknown";
        if (t.payeeId) {
          const [p] = await db.select({ name: payees.name, bankName: payees.bankName }).from(payees).where(eq(payees.id, t.payeeId));
          if (p) payeeName = `${p.name} (${p.bankName || "—"})`;
        }
        return { ...t, userName, userEmail, payeeName };
      }));
      res.json(enriched);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Admin: update wire transfer status / notes
  app.patch('/api/admin/wire-transfers/:id', requireAdmin, async (req, res) => {
    try {
      const { status, adminNotes } = req.body as { status?: string; adminNotes?: string };
      const updates: any = {};
      if (status) updates.status = status;
      if (adminNotes !== undefined) updates.adminNotes = adminNotes;
      const [updated] = await db.update(transactions)
        .set(updates)
        .where(eq(transactions.id, parseInt(req.params.id)))
        .returning();
      res.json({ ok: true, transaction: updated });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post('/api/payees', requireAuth, requireNoLiquidation, async (req, res) => {
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

  app.delete('/api/payees/:id', requireAuth, requireNoLiquidation, async (req, res) => {
    try {
      const id = Number(req.params.id);
      await storage.deletePayee(id, (req.user as User).id);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete payee" });
    }
  });

  // External Payment Route
  app.post('/api/transactions/payment', requireAuth, requireFundsAccess, requireNoLiquidation, async (req, res) => {
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
      if (moneyToCents(amount) <= 0n) throw new Error("Amount must be positive");
      const transaction = await db.transaction(async (tx) => {
        const [acc] = await tx.select().from(accounts).where(eq(accounts.id, fromAccountId)).for("update");
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
      const applicationInput = z.object({
        fullName: z.string().trim().min(2).max(200),
        email: z.string().trim().email().max(254),
        phone: z.string().trim().min(7).max(32),
        dateOfBirth: z.string().min(1).max(32),
        nationality: z.string().max(100).optional().nullable(),
        address: z.string().max(300).optional().nullable(),
        city: z.string().max(120).optional().nullable(),
        country: z.string().min(1).max(120),
        employmentStatus: z.string().min(1).max(80),
        annualIncome: z.string().min(1).max(80),
        investmentExperience: z.string().min(1).max(80),
        riskTolerance: z.string().min(1).max(80),
        investmentGoal: z.string().min(1).max(120),
        initialDeposit: z.string().min(1).max(80),
        sourceOfFunds: z.string().min(1).max(120),
      }).parse(req.body);

      const [app] = await db.insert(applications).values({
        ...applicationInput,
        password: null,
        status: "pending",
      }).returning();
      res.status(201).json({ id: app.id, message: "Application submitted successfully" });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message || "Invalid application details" });
      }
      res.status(500).json({ message: err.message || "Failed to submit application" });
    }
  });

  app.post("/api/account-activation/complete", async (req, res) => {
    const inputSchema = z.object({
      token: z.string().min(32).max(256),
      password: z.string()
        .min(12, "Password must be at least 12 characters")
        .max(128, "Password must be no more than 128 characters")
        .regex(/[a-z]/, "Password must include a lowercase letter")
        .regex(/[A-Z]/, "Password must include an uppercase letter")
        .regex(/[0-9]/, "Password must include a number")
        .regex(/[^A-Za-z0-9]/, "Password must include a symbol"),
    });

    let client;
    try {
      const { token, password } = inputSchema.parse(req.body);
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const passwordHash = await hashPassword(password);
      client = await pool.connect();
      await client.query("BEGIN");

      const tokenResult = await client.query(
        `SELECT id, user_id
           FROM account_setup_tokens
          WHERE token_hash = $1
            AND consumed_at IS NULL
            AND expires_at > NOW()
          FOR UPDATE`,
        [tokenHash],
      );
      if (tokenResult.rowCount !== 1) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "This setup link is invalid, expired, or already used. Contact support for a new link." });
      }

      const userId = tokenResult.rows[0].user_id;
      const updateResult = await client.query(
        "UPDATE users SET password = $1 WHERE id = $2 RETURNING client_ref",
        [passwordHash, userId],
      );
      if (updateResult.rowCount !== 1) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "This setup link is invalid, expired, or already used. Contact support for a new link." });
      }

      await client.query(
        "UPDATE account_setup_tokens SET consumed_at = NOW() WHERE user_id = $1 AND consumed_at IS NULL",
        [userId],
      );
      await client.query("COMMIT");
      return res.json({ ok: true, clientRef: updateResult.rows[0].client_ref });
    } catch (err: any) {
      if (client) await client.query("ROLLBACK").catch(() => {});
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message || "Invalid password" });
      }
      console.error("Account activation failed:", err);
      return res.status(500).json({ message: "Unable to complete account setup right now." });
    } finally {
      client?.release();
    }
  });

  // ─── Admin Routes ────────────────────────────────────────────────────────────

  // All applications
  app.get("/api/admin/applications", requireAdmin, async (req, res) => {
    try {
      const all = await db.select().from(applications).orderBy(desc(applications.createdAt));
      res.json(all.map(({ password: _password, ...application }) => application));
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

      const setupToken = randomBytes(32).toString("base64url");
      const setupTokenHash = createHash("sha256").update(setupToken).digest("hex");
      const setupExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const unavailablePasswordHash = await hashPassword(randomBytes(48).toString("base64url"));
      let assignedClientRef = "";

      const user = await db.transaction(async (tx) => {
        for (let attempt = 0; attempt < 10; attempt++) {
          const candidate = `VW-${randomBytes(5).toString("hex").toUpperCase()}`;
          const [existingRef] = await tx.select({ id: users.id })
            .from(users)
            .where(eq(users.clientRef, candidate))
            .limit(1);
          if (!existingRef) {
            assignedClientRef = candidate;
            break;
          }
        }
        if (!assignedClientRef) throw new Error("Unable to assign a unique Client ID");

        const [newUser] = await tx.insert(users).values({
          clientRef: assignedClientRef,
          name: app.fullName,
          email: app.email,
          password: unavailablePasswordHash,
          phoneNumber: app.phone,
        }).returning();

        // Create an investment-only brokerage account with no liquid cash.
        await tx.insert(accounts).values({
          userId: newUser.id,
          accountType: "Brokerage Account",
          balance: "0.00",
          isDemo: false,
        });

        await tx.insert(accountSetupTokens).values({
          userId: newUser.id,
          tokenHash: setupTokenHash,
          expiresAt: setupExpiresAt,
        });

        await tx.update(applications)
        .set({ status: "approved", notes: req.body.notes || null })
          .where(eq(applications.id, id));
        return newUser;
      });

      res.json({
        ok: true,
        message: "Application approved",
        userId: user.id,
        userName: user.name,
        clientRef: user.clientRef,
        activationPath: `/activate#token=${setupToken}`,
        activationExpiresAt: setupExpiresAt.toISOString(),
      });
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

      await db.update(applications)
        .set({ status: "rejected", notes: req.body.notes || null })
        .where(eq(applications.id, id));
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

  // Freeze / unfreeze an account (compliance / fraud)
  app.post("/api/admin/users/:id/freeze", requireAdmin, async (req, res) => {
    try {
      const { frozen, reason } = req.body as { frozen: boolean; reason?: string };
      const updated = await storage.updateUser(parseInt(req.params.id), {
        accountFrozen: frozen,
        freezeReason: frozen ? (reason || null) : null,
        frozenAt: frozen ? new Date() : null,
      } as any);
      // Destroy all active sessions for this user so they are immediately logged out
      if (frozen) {
        await pool.query(`DELETE FROM session WHERE sess::jsonb->'passport'->>'user' = $1`, [String(req.params.id)]);
      }
      res.json({ success: true, accountFrozen: (updated as any).accountFrozen });
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
      if (!process.env.ADMIN_PASSWORD) return res.status(503).json({ message: "Payment verification is not configured" });
      const id = parseInt(req.params.id);
      await approvePayment(pool,id);

      res.json({ ok: true, message: "Transaction approved" });
    } catch (err: any) {
      res.status(err instanceof FundsAccessError ? err.status : 500).json({ message: err instanceof FundsAccessError ? err.message : "Payment approval failed" });
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
  app.post("/api/institutional-transfers", requireAuth, requireFundsAccess, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    try {
      const { institutionName, institutionAccountNumber, accountType, transferType, transferScope, partialAmount, accountId, portfolioSnapshot, accountHolderType, accountHolderName } = req.body;
      const isFullPortfolio = transferScope === "full-portfolio";
      if (!institutionName || !institutionAccountNumber || !accountType || !transferType || !transferScope) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      if (!isFullPortfolio && !accountId) {
        return res.status(400).json({ message: "Account ID required for single-account transfers" });
      }
      const user = req.user as any;
      const record = await storage.createInstitutionalTransfer({
        userId: user.id,
        accountId: isFullPortfolio ? null : parseInt(accountId),
        institutionName,
        institutionAccountNumber,
        accountType,
        transferType,
        transferScope,
        partialAmount: partialAmount ? String(partialAmount) : null,
        portfolioSnapshot: portfolioSnapshot ? JSON.stringify(portfolioSnapshot) : null,
        accountHolderType: accountHolderType || "own",
        accountHolderName: accountHolderName || null,
      } as any);
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
        const account = r.accountId
          ? (await db.select().from(accounts).where(eq(accounts.id, r.accountId)))[0]
          : null;
        return {
          ...r,
          userName: user?.name || "Unknown",
          userEmail: user?.email || "",
          accountType2: account?.accountType || (r.transferScope === "full-portfolio" ? "Full Portfolio" : ""),
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
      if ((await fundsAccess(pool,record.userId)).locked) return res.status(423).json({ message: "DEBT_PAYMENT_REQUIRED" });
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
      if (req.body.status && !["pending","under_review","rejected"].includes(req.body.status) &&
          (await fundsAccess(pool,record.userId)).locked) return res.status(423).json({ message: "DEBT_PAYMENT_REQUIRED" });

      const { status, estimatedCompletionDate, adminNotes } = req.body as {
        status?: string;
        estimatedCompletionDate?: string | null;
        adminNotes?: string;
      };

      const validStatuses = ["pending", "under_review", "liquidating", "transfer_out", "completed", "rejected", "approved"];
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
