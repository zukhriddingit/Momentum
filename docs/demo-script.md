# Guided Momentum Demo

Use the dedicated disposable Preview/demo environment and the demo credential
shared through the approved secret channel. Start from a freshly verified demo
fixture; do not use Production data.

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
8. Show the Focus Streak moving from **2 → 3**.
9. Show the newly earned **Momentum Three** and **Ahead of Schedule**
   achievements.
10. Read the deterministic supportive completion message. Motivation copy is
    reviewed and tone-based; AI does not decide points, performance, timing, or
    message content.
11. Dismiss the celebration with **Keep the momentum going** and return to the
    dashboard.
12. Show the persisted result: **93 total points**, **3** current streak, and
    **75%** project progress (3 of 4 tasks complete). Point activity,
    achievements, and the completion notification are also visible.
13. Open the notification center and show the supportive completion entry.
14. From a trusted operator terminal configured for this demo environment, run:

    ```bash
    pnpm demo:nudges
    ```

    Repeat it once if desired: the second scan creates no duplicate for the same
    task and exact deadline.

15. Refresh the notification center and show the due-soon notification. The job
    creates an in-app nudge only and respects the user's deadline-nudge
    preference.
16. Reload the application and verify that points, streak, achievements,
    progress, messages, and notifications persist. The same particle effect
    must not replay in the browser session.
17. Optional idempotency proof: reopen **Prepare launch brief**, complete it
    again, and return to the dashboard. The task can return to Done, but there is
    no new reward, streak transition, achievement, notification, or celebration;
    totals remain **93 points** and a **3-day streak**.

Keep the walkthrough focused on follow-through: Focus Task, visible progress,
supportive feedback, and exactly-once rewards. Public leaderboards and generic
enterprise project-management features are not part of the demo.
