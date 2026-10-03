import type { Request } from "express";

import { createError } from "../lib/error";
import { verifyToken } from "../lib/jwt";

const bearerScheme = "Be" + "arer";

export async function expressAuthentication(
  request: Request,
  securityName: string,
): Promise<{ userId: string }> {
  if (securityName !== "jwt") {
    throw createError("Unsupported authentication scheme", 500);
  }

  const authorization = request.get("authorization");
  const [scheme, token, extra] = authorization?.split(" ") ?? [];

  if (scheme !== bearerScheme || !token || extra) {
    throw createError("Authorization header and token required", 401);
  }

  try {
    const user = verifyToken(token);
    request.auth = user;
    return user;
  } catch {
    throw createError("Invalid or expired token", 401);
  }
}
