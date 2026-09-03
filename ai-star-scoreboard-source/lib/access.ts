import { eq } from "drizzle-orm";
import { ensureDatabase } from "../db/bootstrap";
import { getDb } from "../db";
import { accessRequests } from "../db/schema";
import { getAppUser, getRequestAppUser } from "./auth";

export const SITE_OWNER_EMAIL = "saintrv@hanmail.net";

export type AccessStatus = "owner" | "approved" | "pending" | "rejected" | "none";

export function isSiteAdmin(email: string) {
  const normalized = email.trim().toLowerCase();
  return normalized === SITE_OWNER_EMAIL || normalized === "preview@local";
}

export async function getAccessStatus(email: string): Promise<AccessStatus> {
  if (isSiteAdmin(email)) return "owner";

  await ensureDatabase();
  const db = await getDb();
  const [request] = await db
    .select({ status: accessRequests.status })
    .from(accessRequests)
    .where(eq(accessRequests.email, email.trim().toLowerCase()))
    .limit(1);

  if (request?.status === "approved") return "approved";
  if (request?.status === "pending") return "pending";
  if (request?.status === "rejected") return "rejected";
  return "none";
}

export async function getAuthorizedAppUser() {
  const user = await getAppUser();
  if (!user) return null;

  const accessStatus = await getAccessStatus(user.email);
  if (accessStatus !== "owner" && accessStatus !== "approved") return null;

  return {
    ...user,
    isAdmin: accessStatus === "owner",
  };
}

export async function getAuthorizedRequestUser(request: Request) {
  const user = await getRequestAppUser(request);
  if (!user) return null;

  const accessStatus = await getAccessStatus(user.email);
  if (accessStatus !== "owner" && accessStatus !== "approved") return null;

  return {
    ...user,
    isAdmin: accessStatus === "owner",
  };
}
