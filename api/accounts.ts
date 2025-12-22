import { VercelRequest, VercelResponse } from "@vercel/node";
import { storage } from "../server/storage";
import { api } from "@shared/routes";
import { z } from "zod";

// Simple auth check for demo (in production, use JWT)
async function getUserIdFromRequest(req: VercelRequest): Promise<number | null> {
  // This is a placeholder - in production use proper JWT validation
  const userId = req.headers["x-user-id"];
  return userId ? Number(userId) : null;
}

export default async (req: VercelRequest, res: VercelResponse) => {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).end();

  if (req.method === "GET") {
    const accounts = await storage.getAccounts(userId);
    return res.json(accounts);
  }

  if (req.method === "POST") {
    try {
      const input = api.accounts.create.input.parse(req.body);
      const account = await storage.createAccount({ ...input, userId });
      return res.status(201).json(account);
    } catch (err) {
      return res.status(400).json({ message: "Invalid input" });
    }
  }

  res.status(405).end();
};
