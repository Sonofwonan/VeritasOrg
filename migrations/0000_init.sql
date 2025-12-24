CREATE TYPE "public"."account_type" AS ENUM('cash', 'investment');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('transfer', 'buy', 'sell');--> statement-breakpoint
CREATE TABLE "public"."accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"account_type" "account_type" NOT NULL,
	"balance" numeric DEFAULT '0' NOT NULL,
	"is_demo" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "public"."investments" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"symbol" text NOT NULL,
	"shares" numeric NOT NULL,
	"purchase_price" numeric NOT NULL,
	"current_price" numeric,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "public"."transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_account_id" integer,
	"to_account_id" integer,
	"amount" numeric NOT NULL,
	"transaction_type" "transaction_type" NOT NULL,
	"status" "transaction_status" DEFAULT 'completed' NOT NULL,
	"is_demo" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "public"."users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
