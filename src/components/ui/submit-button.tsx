"use client";

import { useFormStatus } from "react-dom";
import type { ComponentProps } from "react";
import { Button } from "./button";

/** A submit button that shows a spinner while its form's Server Action runs. */
export function SubmitButton(props: Omit<ComponentProps<typeof Button>, "type" | "loading">) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending} {...props} />;
}
