import { getServerSession } from "next-auth";
import type { Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";

const ROLE_ORDER: Record<Role, number> = {
  FIELD: 1,
  MANAGER: 2,
  ADMIN: 3,
};

export class SecurityError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function requireRole(minRole: Role) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new SecurityError(401, "Unauthorized");
  }

  const role = (session.user.role ?? "FIELD") as Role;
  if (ROLE_ORDER[role] < ROLE_ORDER[minRole]) {
    throw new SecurityError(403, "Forbidden");
  }

  return session;
}

export async function requireManager() {
  return requireRole("MANAGER");
}

export async function requireAdmin() {
  return requireRole("ADMIN");
}
