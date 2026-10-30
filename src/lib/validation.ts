import { z } from "zod";

export const id = z.uuid();

/** Optional text from a form: trimmed, empty becomes null. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional()
    .transform((value) => value ?? null);

export const requiredText = (max: number) => z.string().trim().min(1).max(max);

/** HTML checkboxes send "on" when ticked and nothing when not. */
export const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.undefined()])
  .transform((value) => value !== undefined);

export const money = z.coerce.number().min(0).max(1_000_000).multipleOf(0.01);

export const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => value === "" || /^https:\/\/[^\s]+$/i.test(value), "يجب أن يبدأ الرابط بـ https://")
  .transform((value) => (value === "" ? null : value));

export const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

/** Phone or WhatsApp number: digits only, optional leading +. */
export const phone = z
  .string()
  .trim()
  .max(20)
  .refine((value) => value === "" || /^\+?[0-9]{7,15}$/.test(value.replace(/[\s-]/g, "")), "رقم غير صحيح")
  .transform((value) => (value === "" ? null : value.replace(/[\s-]/g, "")));

/** Comma or new-line separated list, e.g. town names. */
export const textList = (maxItems: number, maxLength: number) =>
  z
    .string()
    .max(maxItems * (maxLength + 2))
    .transform((value) =>
      value
        .split(/[,،\n]/)
        .map((item) => item.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().max(maxLength)).max(maxItems));
