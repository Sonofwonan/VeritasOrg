import { VercelRequest, VercelResponse } from "@vercel/node";
import { storage } from "../server/storage";
import { scrypt } from "crypto";
import { promisify } from "util";
import { timingSafeEqual } from "crypto";

const scryptAsync = promisify(scrypt);

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedPasswordBuf = Buffer.from(hashed, "hex");
  const suppliedPasswordBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedPasswordBuf, suppliedPasswordBuf);
}

export default async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { email, password } = req.body;
    const user = await storage.getUserByEmail(email);
    if (!user || !(await comparePasswords(password, user.password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
};
