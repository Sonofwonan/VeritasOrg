import { z } from "zod";

export const addressSchema = z.object({
  line1: z.string().trim().min(1, "Enter your street address.").max(120),
  line2: z.string().trim().max(120).default(""),
  city: z.string().trim().min(1, "Enter your town or city.").max(80),
  region: z.string().trim().max(80).default(""),
  postalCode: z.string().trim().min(1, "Enter your postcode or postal code.").max(20),
  country: z.string().trim().min(2, "Enter your country.").max(80),
}).strict();

export const contactDetailsSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(254),
  phoneNumber: z.string().trim().max(40),
  residentialAddress: addressSchema.nullable(),
  mailingAddress: addressSchema.nullable(),
}).strict();

export type Address = z.infer<typeof addressSchema>;
export type ContactDetails = z.infer<typeof contactDetailsSchema>;
export const contactDetailsPath = "/api/client/contact-details";
export type RecoveryRequest = {
  id: number;
  status: "pending" | "issued" | "rejected";
  createdAt: string;
  reviewedAt: string | null;
  name?: string;
  clientRef?: string;
};
export const recoveryRequestPath = "/api/security/recovery-requests";
export const adminRecoveryRequestPath = "/api/admin/security/recovery-requests";
