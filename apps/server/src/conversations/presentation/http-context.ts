import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { UuidSchema } from "@bazak/shared";

export interface OwnerRequest extends Request {
  ownerId: string;
}
export function httpContext(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  response.setHeader("cache-control", "no-store");
  response.setHeader("x-content-type-options", "nosniff");
  const cookie = request.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("bazak_owner="))
    ?.slice("bazak_owner=".length);
  const parsed = UuidSchema.safeParse(cookie);
  const owner = parsed.success ? parsed.data : randomUUID();
  (request as OwnerRequest).ownerId = owner;
  if (!parsed.success)
    response.setHeader(
      "set-cookie",
      `bazak_owner=${owner}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000`,
    );
  next();
}
