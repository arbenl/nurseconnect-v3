import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest } from "next/server";
const req = {} as NextRequest;
getSessionCookie(req);
