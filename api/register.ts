import { VercelRequest, VercelResponse } from "@vercel/node";
import { storage } from "../server/storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export default async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const input = api.auth.register.input.parse(req.body);
    const existing = await storage.getUserByEmail(input.email);
    if (existing) {
      return res.status(400).json({ message: "Email already exists" });
    }
    const hashedPassword = await hashPassword(input.password);
    const user = await storage.createUser({ ...input, password: hashedPassword });
    res.status(201).json(user);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.errors[0].message });
    }
    res.status(500).json({ message: "Internal server error" });
  }
};
