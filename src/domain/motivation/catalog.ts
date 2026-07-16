import type {
  MotivationEvent,
  MotivationTemplate,
  MotivationTone,
} from "@/domain/motivation/types";

const pair = (
  first: MotivationTemplate,
  second: MotivationTemplate,
): readonly [MotivationTemplate, MotivationTemplate] => [first, second];

export const MESSAGE_CATALOG = {
  task_completed: {
    calm: pair(
      {
        key: "task_completed-calm-v1",
        title: "Task complete",
        body: "A steady step forward is now recorded.",
      },
      {
        key: "task_completed-calm-v2",
        title: "Progress saved",
        body: "This task is finished, and your progress is in place.",
      },
    ),
    friendly: pair(
      {
        key: "task_completed-friendly-v1",
        title: "Task complete",
        body: "Nice work — another task moved forward.",
      },
      {
        key: "task_completed-friendly-v2",
        title: "Progress made",
        body: "You wrapped this up and made the next step clearer.",
      },
    ),
    energetic: pair(
      {
        key: "task_completed-energetic-v1",
        title: "Task complete",
        body: "Great finish — this task is done.",
      },
      {
        key: "task_completed-energetic-v2",
        title: "Progress unlocked",
        body: "You closed the loop and moved the project forward.",
      },
    ),
    minimal: pair(
      {
        key: "task_completed-minimal-v1",
        title: "Task complete",
        body: "Progress recorded.",
      },
      {
        key: "task_completed-minimal-v2",
        title: "Done",
        body: "Task completion saved.",
      },
    ),
  },
  completed_early: {
    calm: pair(
      {
        key: "completed_early-calm-v1",
        title: "Finished ahead",
        body: "You completed this with time to spare.",
      },
      {
        key: "completed_early-calm-v2",
        title: "Early progress",
        body: "This task is complete ahead of its deadline.",
      },
    ),
    friendly: pair(
      {
        key: "completed_early-friendly-v1",
        title: "Ahead of schedule",
        body: "Nice work — you finished with room before the deadline.",
      },
      {
        key: "completed_early-friendly-v2",
        title: "Early finish",
        body: "You wrapped this up early and moved things forward.",
      },
    ),
    energetic: pair(
      {
        key: "completed_early-energetic-v1",
        title: "Early finish",
        body: "Strong timing — this task landed ahead of schedule.",
      },
      {
        key: "completed_early-energetic-v2",
        title: "Ahead and done",
        body: "You finished early and cleared the way for what is next.",
      },
    ),
    minimal: pair(
      {
        key: "completed_early-minimal-v1",
        title: "Completed early",
        body: "Finished at least 24 hours ahead.",
      },
      {
        key: "completed_early-minimal-v2",
        title: "Ahead of schedule",
        body: "Task completed early.",
      },
    ),
  },
  focus_task_completed: {
    calm: pair(
      {
        key: "focus_task_completed-calm-v1",
        title: "Focus complete",
        body: "Today’s chosen task is complete. Your attention carried it through.",
      },
      {
        key: "focus_task_completed-calm-v2",
        title: "Focused progress",
        body: "You followed through on today’s focus.",
      },
    ),
    friendly: pair(
      {
        key: "focus_task_completed-friendly-v1",
        title: "Focus task complete",
        body: "Nice work — you followed through on today’s focus and built real momentum.",
      },
      {
        key: "focus_task_completed-friendly-v2",
        title: "Focused finish",
        body: "You chose one priority and carried it through.",
      },
    ),
    energetic: pair(
      {
        key: "focus_task_completed-energetic-v1",
        title: "Focus complete",
        body: "You picked the priority and brought it home.",
      },
      {
        key: "focus_task_completed-energetic-v2",
        title: "Focused win",
        body: "Today’s Focus Task is complete and progress is moving.",
      },
    ),
    minimal: pair(
      {
        key: "focus_task_completed-minimal-v1",
        title: "Focus complete",
        body: "Today’s Focus Task is done.",
      },
      {
        key: "focus_task_completed-minimal-v2",
        title: "Focused progress",
        body: "Selected task completed.",
      },
    ),
  },
  streak_extended: {
    calm: pair(
      {
        key: "streak_extended-calm-v1",
        title: "Streak extended",
        body: "Another focused workday is now part of your streak.",
      },
      {
        key: "streak_extended-calm-v2",
        title: "Steady momentum",
        body: "Your Focus Streak grew by one workday.",
      },
    ),
    friendly: pair(
      {
        key: "streak_extended-friendly-v1",
        title: "Streak extended",
        body: "You followed through again and added another focused day.",
      },
      {
        key: "streak_extended-friendly-v2",
        title: "Momentum growing",
        body: "Another Focus Task complete, another day in your streak.",
      },
    ),
    energetic: pair(
      {
        key: "streak_extended-energetic-v1",
        title: "Streak extended",
        body: "Another focused day is on the board.",
      },
      {
        key: "streak_extended-energetic-v2",
        title: "Momentum up",
        body: "You completed the focus and grew the streak.",
      },
    ),
    minimal: pair(
      {
        key: "streak_extended-minimal-v1",
        title: "Streak extended",
        body: "Focus Streak increased by one.",
      },
      {
        key: "streak_extended-minimal-v2",
        title: "Streak updated",
        body: "Another focused workday recorded.",
      },
    ),
  },
  achievement_unlocked: {
    calm: pair(
      {
        key: "achievement_unlocked-calm-v1",
        title: "Achievement unlocked",
        body: "This milestone reflects the progress you have built.",
      },
      {
        key: "achievement_unlocked-calm-v2",
        title: "Milestone reached",
        body: "Your completed work added a new achievement.",
      },
    ),
    friendly: pair(
      {
        key: "achievement_unlocked-friendly-v1",
        title: "Achievement unlocked",
        body: "Nice work — your progress earned a new milestone.",
      },
      {
        key: "achievement_unlocked-friendly-v2",
        title: "New milestone",
        body: "You reached an achievement through work you completed.",
      },
    ),
    energetic: pair(
      {
        key: "achievement_unlocked-energetic-v1",
        title: "Achievement unlocked",
        body: "A new milestone just joined your progress.",
      },
      {
        key: "achievement_unlocked-energetic-v2",
        title: "Milestone reached",
        body: "Your completed work unlocked something new.",
      },
    ),
    minimal: pair(
      {
        key: "achievement_unlocked-minimal-v1",
        title: "Achievement unlocked",
        body: "New milestone recorded.",
      },
      {
        key: "achievement_unlocked-minimal-v2",
        title: "Milestone reached",
        body: "Achievement added.",
      },
    ),
  },
  deadline_approaching: {
    calm: pair(
      {
        key: "deadline_approaching-calm-v1",
        title: "Deadline approaching",
        body: "This task is due within 24 hours. A clear next step may help.",
      },
      {
        key: "deadline_approaching-calm-v2",
        title: "Due soon",
        body: "There is still time to choose a manageable next step.",
      },
    ),
    friendly: pair(
      {
        key: "deadline_approaching-friendly-v1",
        title: "Due soon",
        body: "This task is due within 24 hours. What is the smallest useful next step?",
      },
      {
        key: "deadline_approaching-friendly-v2",
        title: "A deadline is close",
        body: "A quick next step can make this task easier to finish.",
      },
    ),
    energetic: pair(
      {
        key: "deadline_approaching-energetic-v1",
        title: "Due soon",
        body: "This task is within 24 hours. Pick one clear next move.",
      },
      {
        key: "deadline_approaching-energetic-v2",
        title: "Next step ready",
        body: "The deadline is close, and one focused action can move it forward.",
      },
    ),
    minimal: pair(
      {
        key: "deadline_approaching-minimal-v1",
        title: "Due soon",
        body: "Deadline is within 24 hours.",
      },
      {
        key: "deadline_approaching-minimal-v2",
        title: "Deadline approaching",
        body: "Choose the next task step.",
      },
    ),
  },
  overdue_recovery: {
    calm: pair(
      {
        key: "overdue_recovery-calm-v1",
        title: "Ready for a next step",
        body: "This task is overdue. A small next action can restart progress.",
      },
      {
        key: "overdue_recovery-calm-v2",
        title: "Progress can restart",
        body: "The deadline has passed, and the next manageable step still matters.",
      },
    ),
    friendly: pair(
      {
        key: "overdue_recovery-friendly-v1",
        title: "Let’s get this moving",
        body: "This task is overdue, and one small next step can help.",
      },
      {
        key: "overdue_recovery-friendly-v2",
        title: "A fresh next step",
        body: "The deadline passed, but progress can restart from here.",
      },
    ),
    energetic: pair(
      {
        key: "overdue_recovery-energetic-v1",
        title: "Start the next step",
        body: "This task is overdue. Choose one action and move it forward.",
      },
      {
        key: "overdue_recovery-energetic-v2",
        title: "Back into motion",
        body: "The deadline passed, and a clear next move can restart progress.",
      },
    ),
    minimal: pair(
      {
        key: "overdue_recovery-minimal-v1",
        title: "Next step",
        body: "Task is overdue. Choose one action.",
      },
      {
        key: "overdue_recovery-minimal-v2",
        title: "Resume progress",
        body: "Deadline passed. Progress can restart.",
      },
    ),
  },
} as const satisfies Record<
  MotivationEvent,
  Record<MotivationTone, readonly [MotivationTemplate, MotivationTemplate]>
>;
