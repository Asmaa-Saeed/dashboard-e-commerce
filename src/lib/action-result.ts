/** What every Server Action returns to its form. Safe to import from client components. */
export type ActionResult = { ok: true; message: string } | { ok: false; error: string };
