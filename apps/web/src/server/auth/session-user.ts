import {
  resolveSessionUser,
  type ResolvedSessionUser,
} from "@nurseconnect/domain-identity";

import { getSession } from "./get-session";

export type { ResolvedSessionUser } from "@nurseconnect/domain-identity";

export async function resolveCurrentSessionUser(): Promise<ResolvedSessionUser | null> {
  return resolveSessionUser(await getSession());
}
