import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { api, errorSchemas } from "@shared/routes";
import { z } from "zod";

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

  // Auth Routes
  app.post(api.auth.register.path, async (req, res) => {
    try {
      const input = api.auth.register.input.parse(req.body);
      const existing = await storage.getUserByEmail(input.email);
      if (existing) {
        return res.status(400).json({ message: "Email already exists" });
      }
      const hashedPassword = await hashPassword(input.password);
      const user = await storage.createUser({ ...input, password: hashedPassword });
      
      req.login(user, (err) => {
        if (err) return res.status(500).json({ message: "Login failed after registration" });
        res.status(201).json(user);
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.auth.login.path, (req, res, next) => {
    // passport local strategy
    const nextAuth = (err: any, user: any, info: any) => {
        if (err) return next(err);
        if (!user) return res.status(401).json({ message: "Invalid credentials" });
        req.logIn(user, (err) => {
            if (err) return next(err);
            return res.status(200).json(user);
        });
    };
    // Need to trick passport since our schema expects username but we use email
    // Actually our storage.ts uses getUserByEmail so it matches
    // But passport-local defaults to 'username' and 'password' in body.
    // Ensure frontend sends 'username' as the email field, or configure passport strategy.
    // In auth.ts we used default LocalStrategy which looks for 'username' in body.
    // So frontend MUST send { username: "email@example.com", password: "..." }
    // API contract says { username, password }.
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

  // Middleware to protect routes
  const requireAuth = (req: any, res: any, next: any) => {
    if (req.isAuthenticated()) return next();
    res.status(401).send();
  };

  // Account Routes
  app.get(api.accounts.list.path, requireAuth, async (req, res) => {
    const accounts = await storage.getAccounts(req.user!.id);
    res.json(accounts);
  });

  app.post(api.accounts.create.path, requireAuth, async (req, res) => {
    try {
      const input = api.accounts.create.input.parse(req.body);
      const account = await storage.createAccount({ ...input, userId: req.user!.id });
      res.status(201).json(account);
    } catch (err) {
       res.status(400).json({ message: "Invalid input" });
    }
  });

  app.get(api.accounts.get.path, requireAuth, async (req, res) => {
    const account = await storage.getAccount(Number(req.params.id));
    if (!account || account.userId !== req.user!.id) {
      return res.status(404).json({ message: "Account not found" });
    }
    res.json(account);
  });

  // Transaction Routes
  app.post(api.transactions.transfer.path, requireAuth, async (req, res) => {
    try {
      const { fromAccountId, toAccountId, amount } = api.transactions.transfer.input.parse(req.body);
      // Verify ownership of fromAccount
      const fromAccount = await storage.getAccount(fromAccountId);
      if (!fromAccount || fromAccount.userId !== req.user!.id) {
        return res.status(403).json({ message: "Unauthorized source account" });
      }
      
      const transaction = await storage.transferFunds(fromAccountId, toAccountId, amount);
      res.status(201).json(transaction);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Transfer failed" });
    }
  });

  // Investment Routes
  app.get(api.investments.list.path, requireAuth, async (req, res) => {
    // Return all investments for all user accounts
    // For simplicity, just get accounts then get investments
    const accounts = await storage.getAccounts(req.user!.id);
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
      if (!account || account.userId !== req.user!.id) {
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
      if (!account || account.userId !== req.user!.id) {
        return res.status(403).json({ message: "Unauthorized account" });
      }

      const price = getMockPrice(symbol);
      const investment = await storage.sellAsset(accountId, symbol, shares, price);
      res.status(201).json(investment);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Sell failed" });
    }
  });

  // Market Data
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
