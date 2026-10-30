"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-redirect";

export type SignInState = { error: string; email: string } | null;

const schema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(200),
  next: z.string().max(500).optional(),
});

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  const email = String(formData.get("email") ?? "").slice(0, 254);
  if (!parsed.success) return { error: "أدخل البريد الإلكتروني وكلمة المرور بشكل صحيح.", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error) {
    // Same message for a wrong email or a wrong password, so accounts can't be discovered.
    const tooMany = error.status === 429;
    return { error: tooMany ? "محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى." : "البريد الإلكتروني أو كلمة المرور غير صحيحة.", email };
  }

  redirect(safeNextPath(parsed.data.next));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
