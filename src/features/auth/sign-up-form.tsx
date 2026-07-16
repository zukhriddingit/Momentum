"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUpAction } from "@/features/auth/actions";

function FieldError({ errors, id }: { errors?: string[]; id: string }) {
  if (!errors?.length) {
    return null;
  }

  return (
    <p id={id} className="text-sm text-rose-700">
      {errors[0]}
    </p>
  );
}

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUpAction, null);
  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={action} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="displayName">Display name</Label>
        <Input
          id="displayName"
          name="displayName"
          type="text"
          autoComplete="name"
          maxLength={80}
          required
          aria-describedby={
            fieldErrors?.displayName ? "displayName-error" : undefined
          }
          aria-invalid={fieldErrors?.displayName ? true : undefined}
        />
        <FieldError id="displayName-error" errors={fieldErrors?.displayName} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-describedby={
            fieldErrors?.email ? "signup-email-error" : undefined
          }
          aria-invalid={fieldErrors?.email ? true : undefined}
        />
        <FieldError id="signup-email-error" errors={fieldErrors?.email} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
          aria-describedby={`password-help${
            fieldErrors?.password ? " signup-password-error" : ""
          }`}
          aria-invalid={fieldErrors?.password ? true : undefined}
        />
        <p id="password-help" className="text-xs text-slate-500">
          Use at least 12 characters.
        </p>
        <FieldError id="signup-password-error" errors={fieldErrors?.password} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="timezone">Timezone</Label>
        <Input
          id="timezone"
          name="timezone"
          type="text"
          autoComplete="off"
          placeholder="America/New_York"
          required
          aria-describedby={`timezone-help${
            fieldErrors?.timezone ? " timezone-error" : ""
          }`}
          aria-invalid={fieldErrors?.timezone ? true : undefined}
        />
        <p id="timezone-help" className="text-xs text-slate-500">
          Use an IANA timezone such as America/New_York, Asia/Tokyo, or UTC.
        </p>
        <FieldError id="timezone-error" errors={fieldErrors?.timezone} />
      </div>

      {state && !state.ok ? (
        <p
          className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800"
          role="alert"
          aria-live="polite"
        >
          {state.message}
        </p>
      ) : null}

      <Button className="w-full" size="lg" disabled={pending}>
        {pending ? "Creating your account…" : "Create my Momentum account"}
      </Button>
    </form>
  );
}
