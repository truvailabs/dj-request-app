import type { Request, Response, NextFunction } from "express";
import { getDjUserFromToken } from "../lib/supabase.js";

export async function requireDj(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  if (!token) {
    res.status(401).json({ error: "Missing DJ token" });
    return;
  }
  const user = await getDjUserFromToken(token);
  if (!user) {
    res.status(401).json({ error: "Invalid or expired DJ token" });
    return;
  }
  next();
}
