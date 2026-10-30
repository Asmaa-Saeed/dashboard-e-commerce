import { signOut } from "@/app/login/actions";
import { buttonClass } from "@/components/ui/button";
import { SignOut } from "@/components/ui/icons";

// A form, not a link: signing out changes state, so it must be a POST (a link could be triggered by any page).
export function SignOutButton() {
  return (
    <form action={signOut}>
      <button type="submit" className={buttonClass("outline", "md")}>
        <SignOut className="size-4" />
        خروج
      </button>
    </form>
  );
}
