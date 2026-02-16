import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

// Next.js App Router handler.
export const { GET, POST } = toNextJsHandler(auth);
