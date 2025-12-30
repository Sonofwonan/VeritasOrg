import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { api, errorSchemas, insertPayeeSchema } from "@shared/routes";
import { z } from "zod";
import { type User, accounts, transactions } from "@shared/schema";
import { db } from "./db";
import { eq, sql } from "drizzle-orm";

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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const { hashPassword } = setupAuth(app);

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
      const existing = await storage.getUserByEmail(input.email);
      if (existing) {
        return res.status(400).json({ message: "Email already exists" });
      }
      const hashedPassword = await hashPassword(input.password);
      const user = await storage.createUser({ ...input, password: hashedPassword });
      
      console.log('User created successfully:', user.id);

      // Auto-create a default checking account for new users
      try {
        await storage.createAccount({
          userId: user.id,
          accountType: 'Checking Account',
          balance: '0',
          isDemo: false,
        });
        console.log('Created default account for user:', user.id);
      } catch (accountErr) {
        console.error('Failed to create default account:', accountErr);
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
        if (!user) return res.status(401).json({ message: "Invalid credentials" });
        req.logIn(user, (err) => {
            if (err) return next(err);
            return res.status(200).json(user);
        });
    };
    return require("passport").authenticate("local", nextAuth)(req, res, next);
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
  app.get(api.accounts.list.path, requireAuth, async (req, res) => {
    const accounts = await storage.getAccounts((req.user as User).id);
    res.json(accounts);
  });

  app.post(api.accounts.create.path, requireAuth, async (req, res) => {
    try {
      console.log('Account creation request body:', JSON.stringify(req.body, null, 2));
      const input = api.accounts.create.input.parse(req.body);
      const account = await storage.createAccount({ ...input, userId: (req.user as User).id });
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
          await tx.update(accounts)
            .set({ balance: sql`${accounts.balance} + ${amount}` })
            .where(eq(accounts.id, toAccountId));

          const [t] = await tx.insert(transactions).values({
            toAccountId,
            amount,
            description: `External Deposit to Account #${toAccountId}`,
            transactionType: 'transfer',
            status: 'completed',
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
      
      // Construct WhatsApp approval message
      const toAccount = await storage.getAccount(toAccountId);
      const message = `*TRANSFER APPROVAL REQUIRED*\n\n` +
                      `User: ${(req.user as User).name}\n` +
                      `Amount: $${amount}\n` +
                      `From: ${fromAccount.accountType} (ID: ${fromAccount.id})\n` +
                      `To: ${toAccount?.accountType || 'External'} (ID: ${toAccountId})\n` +
                      `Ref: TXN-${transaction.id}\n\n` +
                      `Please reply with "APPROVE TXN-${transaction.id}" to complete this transfer.`;
      
      const encodedMessage = encodeURIComponent(message);
      const whatsappUrl = `https://wa.me/14784165940?text=${encodedMessage}`;
      
      res.status(201).json({ ...transaction, whatsappUrl });
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Transfer failed" });
    }
  });

  // Approval Webhook/Endpoint
  app.post('/api/admin/approve-transaction/:id', requireAuth, async (req, res) => {
    try {
      // In a real scenario, this would be triggered by a WhatsApp webhook or admin panel
      // For now, we allow the user to trigger it as "Admin Approval"
      const id = Number(req.params.id);
      const [txn] = await db.select().from(transactions).where(eq(transactions.id, id));
      
      if (!txn) return res.status(404).json({ message: "Transaction not found" });
      if (txn.status !== 'pending') return res.status(400).json({ message: "Transaction is not pending" });

      await db.update(transactions)
        .set({ status: 'completed' })
        .where(eq(transactions.id, id));

      res.json({ message: "Transaction approved and completed" });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Approval failed" });
    }
  });

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

        await tx.update(accounts)
          .set({ balance: sql`${accounts.balance} - ${amount}` })
          .where(eq(accounts.id, fromAccountId));

        const [t] = await tx.insert(transactions).values({
          fromAccountId,
          payeeId,
          amount,
          description: description || `Payment to payee #${payeeId}`,
          transactionType: 'payment',
          status: 'completed',
          isDemo: false,
        }).returning();

        return t;
      });

      res.status(201).json(transaction);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Payment failed" });
    }
  });
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
