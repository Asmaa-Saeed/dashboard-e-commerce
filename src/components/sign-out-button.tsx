"use client";

import { signOut } from "@/app/login/actions";
import { buttonClass } from "@/components/ui/button";
import { SignOut } from "@/components/ui/icons";
import { stopPushOnThisDevice } from "@/components/pwa/use-push";

// A form, not a link: signing out changes state, so it must be a POST (a link could be triggered by any page).
// It also stops phone notifications on this device, so a shared phone doesn't keep getting them.
export function SignOutButton() {
  async function action() {
    await stopPushOnThisDevice();
    await signOut();
  }

  return (
    <form action={action}>
      <button type="submit" className={buttonClass("outline", "md")}>
        <SignOut className="size-4" />
        خروج
      </button>
    </form>
  );
}
