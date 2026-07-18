import { Button } from "@/components/ui/button";
import { startGitHubOAuthAction } from "@/features/auth/actions";

export function GitHubOAuthButton() {
  return (
    <form action={startGitHubOAuthAction}>
      <Button type="submit" variant="outline" className="w-full" size="lg">
        Continue with GitHub
      </Button>
    </form>
  );
}
