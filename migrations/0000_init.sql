CREATE TYPE "public"."account_type" AS ENUM('Checking Account', 'Savings Account', 'Money Market Account', 'Certificate of Deposit (CCD)', 'High-Yield Savings', 'Brokerage Account', 'Traditional IRA', 'Roth IRA', '401(k) / 403(b)', '529 Savings Plan', 'Trust Account', 'Business Checking', 'Business Savings');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('completed', 'pending', 'failed');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('transfer', 'buy', 'sell', 'payment', 'withdrawal');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"account_type" text NOT NULL,
	"balance" numeric DEFAULT '0' NOT NULL,
	"is_demo" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "investments" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"symbol" text NOT NULL,
	"shares" numeric NOT NULL,
	"purchase_price" numeric NOT NULL,
	"current_price" numeric,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payees" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"account_number" text,
	"routing_number" text,
	"bank_name" text,
	"type" text DEFAULT 'individual' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_account_id" integer,
	"to_account_id" integer,
	"payee_id" integer,
	"amount" numeric NOT NULL,
	"description" text,
	"transaction_type" "transaction_type" NOT NULL,
	"status" "transaction_status" DEFAULT 'completed' NOT NULL,
	"is_demo" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password" text NOT NULL,
	"phone_number" text,
	"avatar_url" text,
	"two_factor_enabled" boolean DEFAULT false,
	"marketing_emails" boolean DEFAULT true,
	"security_alerts" boolean DEFAULT true,
	"theme" text DEFAULT 'light',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
