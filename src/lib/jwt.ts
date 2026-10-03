import dotenv from "dotenv";
import jwt from "jsonwebtoken";

dotenv.config();

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET must be configured");
  }
  return secret;
}

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, getJwtSecret(), { expiresIn: "7d" });
}

export function verifyToken(token: string): { userId: string } {
  const payload = jwt.verify(token, getJwtSecret());
  if (typeof payload !== "object" || payload === null || typeof payload.userId !== "string") {
    throw new Error("Invalid token payload");
  }
  return { userId: payload.userId };
}
