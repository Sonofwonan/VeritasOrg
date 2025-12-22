import { VercelRequest, VercelResponse } from "@vercel/node";
import { storage } from "../server/storage";

export default async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "GET") return res.status(405).end();
  
  // For Vercel serverless, we can't use session middleware like Express
  // In production, you'd need to validate a JWT or bearer token
  // For now, return 401 - implement proper auth for production
  res.status(401).end();
};
