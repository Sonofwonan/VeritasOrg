import { pgTable, text, serial, integer, boolean, timestamp, numeric, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const accountTypeEnum = pgEnum('account_type', ['cash', 'investment']);
export const transactionTypeEnum = pgEnum('transaction_type', ['transfer', 'buy', 'sell']);
export const transactionStatusEnum = pgEnum('transaction_status', ['completed', 'failed']);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  accountType: accountTypeEnum("account_type").notNull(),
  balance: numeric("balance").notNull().default("0"),
  isDemo: boolean("is_demo").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  fromAccountId: integer("from_account_id"),
  toAccountId: integer("to_account_id"),
  amount: numeric("amount").notNull(),
  transactionType: transactionTypeEnum("transaction_type").notNull(),
  status: transactionStatusEnum("status").notNull().default('completed'),
  isDemo: boolean("is_demo").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const investments = pgTable("investments", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull(),
  symbol: text("symbol").notNull(),
  shares: numeric("shares").notNull(),
  purchasePrice: numeric("purchase_price").notNull(),
  currentPrice: numeric("current_price"), // For tracking current value
  createdAt: timestamp("created_at").defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
  investments: many(investments),
  outgoingTransactions: many(transactions, { relationName: 'fromAccount' }),
  incomingTransactions: many(transactions, { relationName: 'toAccount' }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  fromAccount: one(accounts, {
    fields: [transactions.fromAccountId],
    references: [accounts.id],
    relationName: 'fromAccount'
  }),
  toAccount: one(accounts, {
    fields: [transactions.toAccountId],
    references: [accounts.id],
    relationName: 'toAccount'
  }),
}));

export const investmentsRelations = relations(investments, ({ one }) => ({
  account: one(accounts, {
    fields: [investments.accountId],
    references: [accounts.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertAccountSchema = createInsertSchema(accounts).omit({ id: true, createdAt: true });
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true });
export const insertInvestmentSchema = createInsertSchema(investments).omit({ id: true, createdAt: true });

export type User = typeof users.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Investment = typeof investments.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type InsertInvestment = z.infer<typeof insertInvestmentSchema>;

// Set runtime schema explicitly to avoid relying on Postgres search_path (helps with connection poolers like Supabase)
;(users as any)[Symbol.for('drizzle:Schema')] = 'public';
;(accounts as any)[Symbol.for('drizzle:Schema')] = 'public';
;(transactions as any)[Symbol.for('drizzle:Schema')] = 'public';
;(investments as any)[Symbol.for('drizzle:Schema')] = 'public';

// Enums: attach schema at runtime so generated SQL references public.<enum_name>
;(accountTypeEnum as any).schema = 'public';
;(transactionTypeEnum as any).schema = 'public';
;(transactionStatusEnum as any).schema = 'public';
