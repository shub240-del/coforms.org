import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { SfAccount, User } from "../../drizzle/schema";
import { accountFromRequest } from "../auth";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  appUser: SfAccount | null;
  appSessionToken: string | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  let appUser: SfAccount | null = null;
  let appSessionToken: string | null = null;

  try {
    const appSession = await accountFromRequest(opts.req);
    appUser = appSession?.account ?? null;
    appSessionToken = appSession?.token ?? null;
  } catch (error) {
    console.error("[SpaceForm auth] Failed to resolve app session:", error);
  }

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    appUser,
    appSessionToken,
  };
}
