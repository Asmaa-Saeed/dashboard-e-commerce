import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { PostgrestError } from "@supabase/supabase-js";
import type { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { AccessDeniedError } from "@/lib/auth/dal";

export type { ActionResult };

export const ok = (message: string): ActionResult => ({ ok: true, message });
export const fail = (error: string): ActionResult => ({ ok: false, error });

const GENERIC_ERROR = "حدثت مشكلة، حاول مرة أخرى.";

/** Reads a submitted form into a zod schema. Unknown fields are ignored. */
export function parseForm<T extends z.ZodType>(schema: T, formData: FormData): z.infer<T> | null {
  const raw: Record<string, FormDataEntryValue | FormDataEntryValue[]> = {};
  for (const key of new Set(formData.keys())) {
    const values = formData.getAll(key);
    raw[key] = values.length > 1 ? values : values[0];
  }
  const result = schema.safeParse(raw);
  return result.success ? result.data : null;
}

// Database messages are never shown to users as-is; known rules get a clear Arabic message.
const KNOWN_DB_ERRORS: Array<[RegExp, string]> = [
  [/Order status cannot change/i, "لا يمكن نقل الطلب إلى هذه الحالة من حالته الحالية."],
  [/must keep at least one owner/i, "يجب أن يبقى للمتجر صاحب واحد على الأقل."],
  [/No user with email/i, "لا يوجد حساب بهذا البريد. يجب إنشاء الحساب أولًا."],
  [/Only the platform admin/i, "يتغير هذا الإعداد من إدارة المنصة فقط."],
  [/duplicate key/i, "يوجد عنصر بالاسم أو الرقم نفسه من قبل."],
  [/Locked fields/i, "لا يمكن تعديل هذا الحقل من هنا."],
  [/row-level security|permission denied|Access denied|cannot move to another store/i, "ليست لديك صلاحية لهذا الإجراء."],
];

export function dbError(error: PostgrestError | null, context: string): ActionResult {
  if (error) console.error(`[${context}]`, error.code, error.message);
  const known = KNOWN_DB_ERRORS.find(([pattern]) => error && pattern.test(error.message));
  return fail(known ? known[1] : GENERIC_ERROR);
}

/** Wraps a Server Action body so access errors and surprises never leak details to the browser. */
export async function runAction(context: string, body: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await body();
  } catch (error) {
    // redirect() and notFound() work by throwing; let them through
    unstable_rethrow(error);
    if (error instanceof AccessDeniedError) return fail("ليست لديك صلاحية لهذا الإجراء.");
    console.error(`[${context}]`, error);
    return fail(GENERIC_ERROR);
  }
}
