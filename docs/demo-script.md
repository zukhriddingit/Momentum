# Guided Momentum Demo

Use the dedicated disposable Preview/demo environment and credentials shared
through the approved secret channel. Start from a freshly verified fixture; do
not use Production data unless this is the recorded Production smoke test.

## Five-minute cohort assignment review

This path requires two real GitHub accounts in separate browser sessions. The
owner must not already have the participant's account in the workspace. A
submitted handle is not identity proof; the second account's verified GitHub
numeric user ID is what claims the pending work.

1. In the owner session, sign in with the existing email/password path. Point
   out that GitHub OAuth is additive and password authentication remains
   available.
2. Open the workspace **Team** section, choose **Add cohort member**, and
   search for the second account's exact GitHub handle. Add the validated cohort
   result. Only an owner or admin can perform this step.
3. Create a task assigned to the new pending participant. Show that the task card
   displays the participant's **@handle** with **Waiting for GitHub sign-in**,
   keeps the task in **To Do**, and does not offer Focus, Start, or Complete
   controls.
4. Use the board's assignee filter to show only that pending participant, then
   clear the filter and confirm the task remains visible in To Do.
5. In a separate private/incognito session, choose **Continue with GitHub** and
   authenticate as that exact GitHub account. Open the claimed workspace and
   task. Explain that one atomic, idempotent server transaction converted the
   pending seat and its tasks after Supabase verified the identity.
6. As the claimed participant, select the task as today's **Focus Task**, choose
   **Start task**, and then **Complete task**. Observe the supportive message and
   celebration; trusted reward calculations still run only on the server.
7. Reload the dashboard and board. Verify that points, streak, achievement,
   project progress, completion message, and in-app notification persist.
8. Reopen and recomplete the task. Verify that no second point-ledger entry,
   reward receipt, streak transition, achievement, notification, or celebration
   is created.

Before calling the hosted path complete, repeat the key Team, task-dialog,
filter, and task-control checks at 390×844. From the claimed account, try an
unrelated workspace URL and verify the safe not-found experience. Also verify
that `/sign-up` remains open for self-service password registration.

## Seeded 52-point walkthrough

Run this exact walkthrough Monday through Friday in the demo owner's
`America/New_York` timezone. The **2 → 3** streak transition intentionally does
not run on weekends: weekends neither increment nor break a streak, and the
Preview provision/reset commands refuse before mutation. A weekend pilot can
show persisted product state, but must schedule the exact completion walkthrough
for the next workday.

1. Sign in as the demo owner.
2. Pause on the dashboard: the starting state is 41 points, a two-workday Focus
   Streak, and visible existing progress. Explain that a workday without a Focus
   selection pauses the streak, a selected-but-incomplete Focus Task breaks it,
   and weekends do neither.
3. Open the **Launch Week** project.
4. On **Prepare launch brief**, choose **Focus**. Call out that each person can
   have only one Focus Task per workday.
5. Select **Start task** and observe the short glow/pulse on the card in **In
   Progress**. It is encouragement, not a reward calculation.
6. Select **Complete task**. Observe the Momentum-color burst and flying emoji
   treatment, or the complete static treatment when reduced motion or the user's
   animation preference disables movement.
7. Explain the exact 52-point receipt: **40 base + 8 early-completion + 4 streak
   bonus = 52**. Priority did not affect the result, and a late task would still
   receive full base points.
8. Show the Focus Streak moving from **2 → 3** and the newly earned **Momentum
   Three** and **Ahead of Schedule** achievements.
9. Read the deterministic supportive completion message. Motivation copy is
   reviewed and tone-based; AI does not decide points, performance, timing, or
   message content.
10. Dismiss the celebration with **Keep the momentum going** and return to the
    dashboard.
11. Show the persisted result: **93 total points**, **3** current streak, and
    **75%** project progress (3 of 4 tasks complete). Point activity,
    achievements, and the completion notification are also visible.
12. Reload the application and verify that points, streak, achievements,
    progress, messages, and notifications persist. The same particle effect
    must not replay in the browser session.
13. Optional idempotency proof: reopen **Prepare launch brief**, complete it
    again, and return to the dashboard. Totals remain **93 points** and a
    **3-day streak**.

The protected deadline scanner remains an optional operator demonstration. Run
`pnpm demo:nudges` from a trusted terminal and repeat it to show that the same
task and exact deadline create no duplicate notification.

Keep both walkthroughs focused on follow-through: Focus Task, visible progress,
supportive feedback, and exactly-once rewards. Manual GitHub identity linking,
member removal or role-management UI, invitation delivery, GitHub organization
enforcement, public leaderboards, and generic enterprise project-management
features are not part of this demo.
