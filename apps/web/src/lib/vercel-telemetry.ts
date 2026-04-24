export function shouldEnableVercelClientTelemetry(
  env: { NODE_ENV?: string; VERCEL_ENV?: string } = process.env as {
    NODE_ENV?: string;
    VERCEL_ENV?: string;
  },
) {
  return env.VERCEL_ENV === "production";
}
