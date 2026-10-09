import { pgTable, serial, integer, text, numeric, boolean, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import type { FeeComponent } from "./fees";

export const feeSchedules = pgTable("fee_schedules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  version: integer("version").notNull().unique(),
  currency: text("currency").notNull().default("CAD"),
  components: jsonb("components").$type<FeeComponent[]>().notNull(),
  total: numeric("total", { precision: 14, scale: 2 }).notNull(),
  terms: text("terms").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const feeEnrollments = pgTable("fee_enrollments", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull(),
  userId: integer("user_id").notNull(),
  scheduleId: integer("schedule_id").notNull(),
  state: text("state").notNull().default("offered"),
  firstChargeDate: text("first_charge_date").notNull(),
  nextPeriod: integer("next_period").notNull().default(0),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  acceptedBy: integer("accepted_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const feeAssessments = pgTable("fee_assessments", {
  id: serial("id").primaryKey(),
  enrollmentId: integer("enrollment_id").notNull(),
  accountId: integer("account_id").notNull(),
  period: integer("period").notNull(),
  dueDate: text("due_date").notNull(),
  components: jsonb("components").$type<FeeComponent[]>().notNull(),
  total: numeric("total", { precision: 14, scale: 2 }).notNull(),
  status: text("status").notNull(),
  reason: text("reason"),
  transactionId: integer("transaction_id"),
  refundTransactionId: integer("refund_transaction_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("fee_assessments_period_idx").on(table.enrollmentId, table.period)]);
export const feeAudit = pgTable("fee_audit", {
  id: serial("id").primaryKey(),
  enrollmentId: integer("enrollment_id"),
  assessmentId: integer("assessment_id"),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  detail: jsonb("detail").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const feeSettings = pgTable("fee_settings", {
  id: integer("id").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  timeZone: text("time_zone").notNull().default("America/Toronto"),
});
