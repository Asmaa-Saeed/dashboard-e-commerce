import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ protocol: /^https?$/ }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(20)
    .refine((key) => !key.startsWith("sb_secret_"), "Use the publishable key, never the secret key"),
});

// NEXT_PUBLIC_* values are inlined at build time, so they must be read by their full name.
const parsed = schema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});

if (!parsed.success) {
  throw new Error(
    `Missing or invalid environment variables: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}. See .env.example.`,
  );
}

export const env = parsed.data;
