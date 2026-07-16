import "server-only";

import { normalizeIanaTimezone } from "@/domain/profiles/is-iana-timezone";
import { database } from "@/server/db/client";
import { AppError } from "@/server/errors";

export interface ProfileView {
  id: string;
  displayName: string;
  timezone: string;
  motivationTone: "calm" | "friendly" | "energetic" | "minimal";
}

interface ProfileRow {
  id: string;
  display_name: string;
  timezone: string;
  motivation_tone: ProfileView["motivationTone"];
}

interface EnsureProfileInput {
  actorId: string;
  displayName: string;
  timezone: string;
}

function validateProfileDetails(input: EnsureProfileInput): {
  displayName: string;
  timezone: string;
} {
  const displayName = input.displayName.trim();
  const timezone = normalizeIanaTimezone(input.timezone);

  if (displayName.length < 1 || displayName.length > 80 || !timezone) {
    throw new TypeError("Profile details are invalid.");
  }

  return { displayName, timezone };
}

export async function ensureProfile(
  input: EnsureProfileInput,
): Promise<ProfileView> {
  const details = validateProfileDetails(input);
  const sql = database();

  await sql`
    insert into public.profiles (
      id,
      display_name,
      timezone,
      motivation_tone
    )
    values (
      ${input.actorId},
      ${details.displayName},
      ${details.timezone},
      'friendly'
    )
    on conflict (id) do nothing
  `;

  const [profile] = await sql<Array<ProfileRow>>`
    select id, display_name, timezone, motivation_tone::text as motivation_tone
    from public.profiles
    where id = ${input.actorId}
  `;

  if (!profile) {
    throw new Error("Profile recovery did not return a profile.");
  }

  if (
    profile.display_name !== details.displayName ||
    profile.timezone !== details.timezone
  ) {
    throw new AppError(
      "CONFLICT",
      "That profile already exists with different details.",
    );
  }

  return {
    id: profile.id,
    displayName: profile.display_name,
    timezone: profile.timezone,
    motivationTone: profile.motivation_tone,
  };
}
