export const FOCUS_COMPLETE_MESSAGE = {
  key: "focus-complete-friendly-v1",
  title: "Focus task complete",
  body: "Nice work — you followed through on today’s focus and built real momentum.",
} as const;

export function selectFocusCompletionMessage(): typeof FOCUS_COMPLETE_MESSAGE {
  return FOCUS_COMPLETE_MESSAGE;
}
