import { database } from "@/server/db/client";

interface AuthUserFixtureInput {
  id: string;
  email: string;
  displayName: string;
  timezone: string;
  password?: string;
}

export function selfServiceUuid(sequence: number): string {
  if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > 999_999) {
    throw new RangeError("Fixture UUID sequence must be between 1 and 999999.");
  }

  return `70000000-0000-4000-8000-${sequence.toString().padStart(12, "0")}`;
}

export async function insertAuthUser({
  id,
  email,
  displayName,
  timezone,
  password = "momentum-pass-2026",
}: AuthUserFixtureInput): Promise<void> {
  await database()`
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      ${id},
      'authenticated',
      'authenticated',
      ${email},
      extensions.crypt(${password}, extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      ${database().json({ display_name: displayName, timezone })},
      now(),
      now(),
      '',
      '',
      '',
      ''
    )
  `;
}
