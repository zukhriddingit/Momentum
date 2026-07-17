"use client";

import { useActionState } from "react";

import { MOTIVATION_TONES } from "@/domain/motivation/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  updateMotivationSettingsAction,
  type MotivationSettingsActionState,
} from "@/features/settings/actions";
import type { MotivationSettingsView } from "@/server/settings/types";

function FieldError({ errors, id }: { errors?: string[]; id: string }) {
  if (!errors?.[0]) {
    return null;
  }

  return (
    <p id={id} className="text-sm text-rose-700">
      {errors[0]}
    </p>
  );
}

function CheckboxSetting({
  defaultChecked,
  description,
  label,
  name,
}: {
  defaultChecked: boolean;
  description: string;
  label: string;
  name:
    | "deadlineNudgesEnabled"
    | "celebrationAnimationEnabled"
    | "achievementVisibilityEnabled";
}) {
  const descriptionId = `${name}-description`;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
      <input
        className="mt-1 size-4 rounded border-slate-300 accent-violet-600"
        defaultChecked={defaultChecked}
        id={name}
        name={name}
        type="checkbox"
        aria-describedby={descriptionId}
      />
      <div className="space-y-1">
        <Label htmlFor={name}>{label}</Label>
        <p id={descriptionId} className="text-sm text-slate-600">
          {description}
        </p>
      </div>
    </div>
  );
}

export function MotivationSettingsForm({
  settings,
}: {
  settings: MotivationSettingsView;
}) {
  const [state, action, pending] = useActionState<
    MotivationSettingsActionState,
    FormData
  >(updateMotivationSettingsAction, null);
  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={action} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="tone">Message tone</Label>
        <Select
          id="tone"
          name="tone"
          defaultValue={settings.tone}
          disabled={pending}
          aria-describedby={fieldErrors?.tone ? "tone-error" : "tone-help"}
          aria-invalid={fieldErrors?.tone ? true : undefined}
        >
          {MOTIVATION_TONES.map((tone) => (
            <option key={tone} value={tone}>
              {tone[0]?.toUpperCase()}
              {tone.slice(1)}
            </option>
          ))}
        </Select>
        <p id="tone-help" className="text-xs text-slate-500">
          Choose how supportive messages should sound.
        </p>
        <FieldError id="tone-error" errors={fieldErrors?.tone} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="settings-timezone">Timezone</Label>
        <Input
          id="settings-timezone"
          name="timezone"
          type="text"
          autoComplete="off"
          defaultValue={settings.timezone}
          disabled={pending}
          required
          aria-describedby={`settings-timezone-help${
            fieldErrors?.timezone ? " settings-timezone-error" : ""
          }`}
          aria-invalid={fieldErrors?.timezone ? true : undefined}
        />
        <p id="settings-timezone-help" className="text-xs text-slate-500">
          Use an IANA timezone such as America/New_York, Asia/Tokyo, or UTC.
        </p>
        <FieldError
          id="settings-timezone-error"
          errors={fieldErrors?.timezone}
        />
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-900">
          Motivation experience
        </legend>
        <CheckboxSetting
          name="deadlineNudgesEnabled"
          label="Deadline nudges"
          description="Create supportive in-app reminders when assigned work is due soon or overdue."
          defaultChecked={settings.deadlineNudgesEnabled}
        />
        <CheckboxSetting
          name="celebrationAnimationEnabled"
          label="Celebration animation"
          description="Celebrate a new completion with a brief burst and playful emojis."
          defaultChecked={settings.celebrationAnimationEnabled}
        />
        <CheckboxSetting
          name="achievementVisibilityEnabled"
          label="Show achievements"
          description="Display earned achievements and prioritize them in future completion messages."
          defaultChecked={settings.achievementVisibilityEnabled}
        />
      </fieldset>

      {state ? (
        <p
          className={
            state.ok
              ? "rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"
              : "rounded-xl bg-rose-50 p-3 text-sm text-rose-800"
          }
          role={state.ok ? "status" : "alert"}
          aria-live="polite"
        >
          {state.ok
            ? "Preferences saved. Future messages will use these choices."
            : state.message}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Saving preferences…" : "Save preferences"}
      </Button>
    </form>
  );
}
