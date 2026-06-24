import { pgTable, text, serial, integer, boolean, timestamp, numeric, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const accountTypeEnum = pgEnum('account_type', [
  // Deposit Accounts
  'Checking Account',
  'Savings Account',
  'Money Market Account',
  'Certificate of Deposit (CCD)',
  'High-Yield Savings',
  // Investment/Retirement
  'Brokerage Account',
  'Traditional IRA',
  'Roth IRA',
  '401(k) / 403(b)',
  '529 Savings Plan',
  // Other
  'Trust Account',
  'Business Checking',
  'Business Savings'
]);
export const transactionTypeEnum = pgEnum('transaction_type', ['transfer', 'buy', 'sell', 'payment', 'withdrawal']);
export const transactionStatusEnum = pgEnum('transaction_status', ['completed', 'pending', 'failed']);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  clientRef: text("client_ref").unique(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  password: text("password").notNull(),
  phoneNumber: text("phone_number"),
  avatarUrl: text("avatar_url"),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  marketingEmails: boolean("marketing_emails").default(true),
  securityAlerts: boolean("security_alerts").default(true),
  theme: text("theme").default("light"),
  loginRestricted: boolean("login_restricted").default(false),
  loginRestrictionMessage: text("login_restriction_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  accountType: text("account_type").notNull(),
  balance: numeric("balance").notNull().default("0"),
  isDemo: boolean("is_demo").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  fromAccountId: integer("from_account_id"),
  toAccountId: integer("to_account_id"),
  payeeId: integer("payee_id"),
  amount: numeric("amount").notNull(),
  description: text("description"),
  transactionType: transactionTypeEnum("transaction_type").notNull(),
  status: transactionStatusEnum("status").notNull().default('completed'),
  isDemo: boolean("is_demo").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const payees = pgTable("payees", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  accountNumber: text("account_number"),
  routingNumber: text("routing_number"),
  bankName: text("bank_name"),
  type: text("type").notNull().default("individual"), // individual, business
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

export const payeesRelations = relations(payees, ({ one, many }) => ({
  user: one(users, {
    fields: [payees.userId],
    references: [users.id],
  }),
  transactions: many(transactions, { relationName: 'payee' }),
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
  payee: one(payees, {
    fields: [transactions.payeeId],
    references: [payees.id],
    relationName: 'payee'
  }),
}));

export const investmentsRelations = relations(investments, ({ one }) => ({
  account: one(accounts, {
    fields: [investments.accountId],
    references: [accounts.id],
  }),
}));

export const institutionalTransfers = pgTable("institutional_transfers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  accountId: integer("account_id").notNull(),
  institutionName: text("institution_name").notNull(),
  institutionAccountNumber: text("institution_account_number").notNull(),
  accountType: text("account_type").notNull(),
  transferType: text("transfer_type").notNull(), // "cash" | "in-kind"
  transferScope: text("transfer_scope").notNull(), // "full" | "partial"
  partialAmount: numeric("partial_amount"),
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  estimatedCompletionDate: timestamp("estimated_completion_date"),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type InstitutionalTransfer = typeof institutionalTransfers.$inferSelect;
export const insertInstitutionalTransferSchema = createInsertSchema(institutionalTransfers).omit({
  id: true, createdAt: true, status: true, estimatedCompletionDate: true, adminNotes: true,
});
export type InsertInstitutionalTransfer = z.infer<typeof insertInstitutionalTransferSchema>;

export const applications = pgTable("applications", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  dateOfBirth: text("date_of_birth").notNull(),
  nationality: text("nationality"),
  address: text("address"),
  city: text("city"),
  country: text("country"),
  employmentStatus: text("employment_status"),
  annualIncome: text("annual_income"),
  investmentExperience: text("investment_experience"),
  riskTolerance: text("risk_tolerance"),
  investmentGoal: text("investment_goal"),
  initialDeposit: text("initial_deposit"),
  sourceOfFunds: text("source_of_funds"),
  password: text("password").notNull(),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Application = typeof applications.$inferSelect;
export const insertApplicationSchema = createInsertSchema(applications).omit({ id: true, createdAt: true, status: true, notes: true });
export type InsertApplication = z.infer<typeof insertApplicationSchema>;

export const insertUserSchema = createInsertSchema(users, {
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
}).omit({ id: true, createdAt: true });
export const insertAccountSchema = createInsertSchema(accounts, {
  userId: z.number().optional(),
  balance: z.string().min(1, "Initial deposit is required").refine((val) => !isNaN(Number(val)) && Number(val) >= 0, "Initial deposit must be at least 0"),
}).omit({ id: true, createdAt: true });
export const insertPayeeSchema = createInsertSchema(payees).omit({ id: true, createdAt: true });
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true });
export const insertInvestmentSchema = createInsertSchema(investments).omit({ id: true, createdAt: true });

export type User = typeof users.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Payee = typeof payees.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Investment = typeof investments.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type InsertPayee = z.infer<typeof insertPayeeSchema>;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type InsertInvestment = z.infer<typeof insertInvestmentSchema>;
