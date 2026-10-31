import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import type { Request } from "express";

/** The local Vite proxy is allowed; remote browser origins cannot submit turns. */
@Injectable()
export class LocalOriginGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.method !== "POST" || !request.headers.origin) return true;
    let origin: URL;
    try {
      origin = new URL(request.headers.origin);
    } catch {
      throw new ForbiddenException("Invalid request origin.");
    }
    if (!["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname))
      throw new ForbiddenException("Cross-origin requests are not allowed.");
    return true;
  }
}
