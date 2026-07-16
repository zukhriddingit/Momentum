import { Button } from "@/components/ui/button";
import { signOutAction } from "@/features/auth/actions";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <Button variant="ghost" size="sm">
        Sign out
      </Button>
    </form>
  );
}
