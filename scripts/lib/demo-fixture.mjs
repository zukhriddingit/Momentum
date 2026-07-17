import postgres from "postgres";

export const DEMO_FIXTURE_IDS = Object.freeze({
  workspace: "20000000-0000-4000-8000-000000000001",
  project: "30000000-0000-4000-8000-000000000001",
  candidateTask: "40000000-0000-4000-8000-000000000001",
  dueSoonTask: "40000000-0000-4000-8000-000000000002",
  firstHistoryTask: "40000000-0000-4000-8000-000000000003",
  secondHistoryTask: "40000000-0000-4000-8000-000000000004",
  firstFocus: "50000000-0000-4000-8000-000000000001",
  secondFocus: "50000000-0000-4000-8000-000000000002",
  firstCompletion: "60000000-0000-4000-8000-000000000001",
  secondCompletion: "60000000-0000-4000-8000-000000000002",
  firstLedger: "70000000-0000-4000-8000-000000000001",
  secondLedger: "70000000-0000-4000-8000-000000000002",
  streakLedger: "70000000-0000-4000-8000-000000000003",
  firstStepGrant: "80000000-0000-4000-8000-000000000001",
  focusedFinishGrant: "80000000-0000-4000-8000-000000000002",
  representativeNotification: "90000000-0000-4000-8000-000000000001",
});

export const EXPECTED_DEMO_FIXTURE_SUMMARY = Object.freeze({
  userCount: 2,
  membershipRoles: Object.freeze(["member", "owner"]),
  workspaceCount: 1,
  projectCount: 1,
  taskStatuses: Object.freeze({ todo: 1, inProgress: 1, done: 2 }),
  currentStreak: 2,
  longestStreak: 2,
  hasCurrentFocus: false,
  initialPoints: 41,
  achievementCodes: Object.freeze(["first_step", "focused_finish"]),
  notificationCount: 1,
  dueSoonCount: 1,
  expectedCompletionPoints: 52,
  expectedPostCompletionStreak: 3,
  expectedProgressPercent: 75,
});

const DEMO_TIMEZONE = "America/New_York";

function localDateParts(instant) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DEMO_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const value = (type) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

function isWeekend(cursor) {
  return cursor.getUTCDay() === 0 || cursor.getUTCDay() === 6;
}

function previousWorkday(cursor) {
  const result = new Date(cursor);
  do {
    result.setUTCDate(result.getUTCDate() - 1);
  } while (isWeekend(result));
  return result;
}

function workDate(cursor) {
  return cursor.toISOString().slice(0, 10);
}

export function demoFixtureDates(now = new Date()) {
  const parts = localDateParts(now);
  const current = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, 17),
  );
  while (isWeekend(current)) {
    current.setUTCDate(current.getUTCDate() + 1);
  }
  const second = previousWorkday(current);
  const first = previousWorkday(second);
  const demoNow = new Date(`${workDate(current)}T17:00:00.000Z`);
  const firstCompletedAt = new Date(`${workDate(first)}T20:00:00.000Z`);
  const secondCompletedAt = new Date(`${workDate(second)}T20:00:00.000Z`);
  return {
    currentWorkDate: workDate(current),
    firstWorkDate: workDate(first),
    secondWorkDate: workDate(second),
    demoNow,
    firstCompletedAt,
    secondCompletedAt,
    candidateDueAt: new Date(demoNow.getTime() + 10 * 24 * 60 * 60 * 1000),
    dueSoonAt: new Date(demoNow.getTime() + 12 * 60 * 60 * 1000),
  };
}

export async function readDemoFixtureSummary({
  databaseUrl,
  ownerId,
  teammateId,
  now,
}) {
  const sql = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    const dates = demoFixtureDates(now);
    const [row] = await sql`
      select
        (select count(*)::integer from public.profiles where id in (${ownerId}, ${teammateId})) as user_count,
        (select array_agg(role::text order by role::text) from public.workspace_memberships where workspace_id = ${DEMO_FIXTURE_IDS.workspace}) as membership_roles,
        (select count(*)::integer from public.workspaces where id = ${DEMO_FIXTURE_IDS.workspace}) as workspace_count,
        (select count(*)::integer from public.projects where id = ${DEMO_FIXTURE_IDS.project}) as project_count,
        (select count(*)::integer from public.tasks where project_id = ${DEMO_FIXTURE_IDS.project} and status = 'todo') as todo_count,
        (select count(*)::integer from public.tasks where project_id = ${DEMO_FIXTURE_IDS.project} and status = 'in_progress') as in_progress_count,
        (select count(*)::integer from public.tasks where project_id = ${DEMO_FIXTURE_IDS.project} and status = 'done') as done_count,
        (select current_count from public.focus_streaks where user_id = ${ownerId}) as current_streak,
        (select longest_count from public.focus_streaks where user_id = ${ownerId}) as longest_streak,
        exists(select 1 from public.focus_selections where user_id = ${ownerId} and work_date = ${dates.currentWorkDate}) as has_current_focus,
        (select coalesce(sum(points), 0)::integer from public.point_ledger where user_id = ${ownerId}) as initial_points,
        (select array_agg(achievement_code order by achievement_code) from public.achievement_grants where user_id = ${ownerId}) as achievement_codes,
        (select count(*)::integer from public.notifications where user_id = ${ownerId}) as notification_count,
        (select count(*)::integer from public.tasks where assignee_id = ${ownerId} and status <> 'done' and due_at > ${dates.demoNow} and due_at <= ${dates.demoNow} + interval '24 hours') as due_soon_count
    `;

    return {
      userCount: row.user_count,
      membershipRoles: row.membership_roles,
      workspaceCount: row.workspace_count,
      projectCount: row.project_count,
      taskStatuses: {
        todo: row.todo_count,
        inProgress: row.in_progress_count,
        done: row.done_count,
      },
      currentStreak: row.current_streak,
      longestStreak: row.longest_streak,
      hasCurrentFocus: row.has_current_focus,
      initialPoints: row.initial_points,
      achievementCodes: row.achievement_codes,
      notificationCount: row.notification_count,
      dueSoonCount: row.due_soon_count,
      expectedCompletionPoints:
        EXPECTED_DEMO_FIXTURE_SUMMARY.expectedCompletionPoints,
      expectedPostCompletionStreak:
        EXPECTED_DEMO_FIXTURE_SUMMARY.expectedPostCompletionStreak,
      expectedProgressPercent:
        EXPECTED_DEMO_FIXTURE_SUMMARY.expectedProgressPercent,
    };
  } finally {
    await sql.end();
  }
}

export async function provisionDemoData({
  databaseUrl,
  ownerId,
  teammateId,
  now,
}) {
  const dates = demoFixtureDates(now);
  const sql = postgres(databaseUrl, { max: 1, prepare: false });

  const taskRows = [
    {
      id: DEMO_FIXTURE_IDS.candidateTask,
      title: "Prepare launch brief",
      assigneeId: ownerId,
      status: "todo",
      effort: "medium",
      dueAt: dates.candidateDueAt,
    },
    {
      id: DEMO_FIXTURE_IDS.dueSoonTask,
      title: "Review onboarding copy",
      assigneeId: ownerId,
      status: "in_progress",
      effort: "small",
      dueAt: dates.dueSoonAt,
    },
    {
      id: DEMO_FIXTURE_IDS.firstHistoryTask,
      title: "Outline launch goals",
      assigneeId: ownerId,
      status: "done",
      effort: "small",
      dueAt: null,
      firstCompletedAt: dates.firstCompletedAt,
    },
    {
      id: DEMO_FIXTURE_IDS.secondHistoryTask,
      title: "Collect customer quotes",
      assigneeId: ownerId,
      status: "done",
      effort: "small",
      dueAt: null,
      firstCompletedAt: dates.secondCompletedAt,
    },
  ];

  const focusRows = [
    {
      id: DEMO_FIXTURE_IDS.firstFocus,
      taskId: DEMO_FIXTURE_IDS.firstHistoryTask,
      workDate: dates.firstWorkDate,
      selectedAt: new Date(
        dates.firstCompletedAt.getTime() - 3 * 60 * 60 * 1000,
      ),
      completedAt: dates.firstCompletedAt,
    },
    {
      id: DEMO_FIXTURE_IDS.secondFocus,
      taskId: DEMO_FIXTURE_IDS.secondHistoryTask,
      workDate: dates.secondWorkDate,
      selectedAt: new Date(
        dates.secondCompletedAt.getTime() - 3 * 60 * 60 * 1000,
      ),
      completedAt: dates.secondCompletedAt,
    },
  ];

  const completionRows = [
    {
      id: DEMO_FIXTURE_IDS.firstCompletion,
      taskId: DEMO_FIXTURE_IDS.firstHistoryTask,
      focusId: DEMO_FIXTURE_IDS.firstFocus,
      completedAt: dates.firstCompletedAt,
      basePoints: 20,
      timingMultiplier: 1,
      streakMultiplier: 1,
      preStreak: 0,
      postStreak: 1,
      finalPoints: 20,
      taskTitle: "Outline launch goals",
    },
    {
      id: DEMO_FIXTURE_IDS.secondCompletion,
      taskId: DEMO_FIXTURE_IDS.secondHistoryTask,
      focusId: DEMO_FIXTURE_IDS.secondFocus,
      completedAt: dates.secondCompletedAt,
      basePoints: 20,
      timingMultiplier: 1,
      streakMultiplier: 1.04,
      preStreak: 1,
      postStreak: 2,
      finalPoints: 21,
      taskTitle: "Collect customer quotes",
    },
  ];

  const ledgerRows = [
    {
      id: DEMO_FIXTURE_IDS.firstLedger,
      completionId: DEMO_FIXTURE_IDS.firstCompletion,
      kind: "base",
      points: 20,
      createdAt: dates.firstCompletedAt,
    },
    {
      id: DEMO_FIXTURE_IDS.secondLedger,
      completionId: DEMO_FIXTURE_IDS.secondCompletion,
      kind: "base",
      points: 20,
      createdAt: dates.secondCompletedAt,
    },
    {
      id: DEMO_FIXTURE_IDS.streakLedger,
      completionId: DEMO_FIXTURE_IDS.secondCompletion,
      kind: "streak_bonus",
      points: 1,
      createdAt: dates.secondCompletedAt,
    },
  ];

  const grantRows = [
    {
      id: DEMO_FIXTURE_IDS.firstStepGrant,
      code: "first_step",
    },
    {
      id: DEMO_FIXTURE_IDS.focusedFinishGrant,
      code: "focused_finish",
    },
  ];

  try {
    await sql.begin(async (transaction) => {
      const [existing] = await transaction`
        select exists(
          select 1 from public.workspaces where id = ${DEMO_FIXTURE_IDS.workspace}
        ) as exists
      `;
      if (existing.exists) {
        throw new Error(
          "Demo fixture already exists; reset the dedicated demo database first.",
        );
      }

      await transaction`
        insert into public.profiles (id, display_name, timezone, motivation_tone)
        values
          (${ownerId}, 'Maya Chen', 'America/New_York', 'friendly'),
          (${teammateId}, 'Alex Rivera', 'America/New_York', 'friendly')
        on conflict (id) do update set
          display_name = excluded.display_name,
          timezone = excluded.timezone,
          motivation_tone = excluded.motivation_tone,
          updated_at = now()
      `;
      await transaction`
        insert into public.motivation_preferences (user_id)
        values (${ownerId}), (${teammateId})
        on conflict (user_id) do nothing
      `;
      await transaction`
        insert into public.workspaces (id, name, created_by)
        values (${DEMO_FIXTURE_IDS.workspace}, 'Momentum Demo Team', ${ownerId})
      `;
      await transaction`
        insert into public.workspace_memberships (workspace_id, user_id, role)
        values
          (${DEMO_FIXTURE_IDS.workspace}, ${ownerId}, 'owner'),
          (${DEMO_FIXTURE_IDS.workspace}, ${teammateId}, 'member')
      `;
      await transaction`
        insert into public.projects (id, workspace_id, name, description, created_by)
        values (
          ${DEMO_FIXTURE_IDS.project},
          ${DEMO_FIXTURE_IDS.workspace},
          'Launch Week',
          'A focused demonstration project for the Momentum happy path.',
          ${ownerId}
        )
      `;

      for (const task of taskRows) {
        await transaction`
          insert into public.tasks (
            id, project_id, title, description, assignee_id, status,
            effort, due_at, first_completed_at, created_by
          ) values (
            ${task.id}, ${DEMO_FIXTURE_IDS.project}, ${task.title}, null,
            ${task.assigneeId}, ${task.status}, ${task.effort},
            ${task.dueAt}, ${task.firstCompletedAt ?? null}, ${ownerId}
          )
        `;
      }

      for (const focus of focusRows) {
        await transaction`
          insert into public.focus_selections (
            id, user_id, task_id, work_date, selected_at, completed_at
          ) values (
            ${focus.id}, ${ownerId}, ${focus.taskId}, ${focus.workDate},
            ${focus.selectedAt}, ${focus.completedAt}
          )
        `;
      }

      await transaction`
        insert into public.focus_streaks (
          user_id, current_count, longest_count, last_completed_work_date
        ) values (${ownerId}, 2, 2, ${dates.secondWorkDate})
      `;

      for (const completion of completionRows) {
        await transaction`
          insert into public.task_completions (
            id, task_id, workspace_id, project_id, recipient_id, actor_id,
            focus_selection_id, completed_at, base_points, timing_multiplier,
            streak_multiplier, pre_completion_streak, post_completion_streak,
            final_points, task_title, message_event, message_tone,
            message_template_key, message_title, message_body
          ) values (
            ${completion.id}, ${completion.taskId},
            ${DEMO_FIXTURE_IDS.workspace}, ${DEMO_FIXTURE_IDS.project},
            ${ownerId}, ${ownerId}, ${completion.focusId},
            ${completion.completedAt}, ${completion.basePoints},
            ${completion.timingMultiplier}, ${completion.streakMultiplier},
            ${completion.preStreak}, ${completion.postStreak},
            ${completion.finalPoints}, ${completion.taskTitle},
            'focus_task_completed', 'friendly', 'seed-history-v1',
            'Focus task complete',
            'A focused step moved the project forward.'
          )
        `;
      }

      for (const ledger of ledgerRows) {
        await transaction`
          insert into public.point_ledger (
            id, completion_id, workspace_id, project_id, user_id,
            entry_kind, points, created_at
          ) values (
            ${ledger.id}, ${ledger.completionId},
            ${DEMO_FIXTURE_IDS.workspace}, ${DEMO_FIXTURE_IDS.project},
            ${ownerId}, ${ledger.kind}, ${ledger.points}, ${ledger.createdAt}
          )
        `;
      }

      for (const grant of grantRows) {
        await transaction`
          insert into public.achievement_grants (
            id, user_id, achievement_code, completion_id, granted_at
          ) values (
            ${grant.id}, ${ownerId}, ${grant.code},
            ${DEMO_FIXTURE_IDS.firstCompletion}, ${dates.firstCompletedAt}
          )
        `;
      }

      await transaction`
        insert into public.notifications (
          id, user_id, workspace_id, project_id, task_id, event_type,
          source_id, tone, template_key, title, body, read_at, created_at
        ) values (
          ${DEMO_FIXTURE_IDS.representativeNotification}, ${ownerId},
          ${DEMO_FIXTURE_IDS.workspace}, ${DEMO_FIXTURE_IDS.project},
          ${DEMO_FIXTURE_IDS.secondHistoryTask}, 'focus_task_completed',
          ${DEMO_FIXTURE_IDS.secondCompletion}, 'friendly', 'seed-history-v1',
          'Focus task complete',
          'A focused step moved the project forward.',
          ${dates.secondCompletedAt}, ${dates.secondCompletedAt}
        )
      `;
    });
  } finally {
    await sql.end();
  }

  return readDemoFixtureSummary({
    databaseUrl,
    ownerId,
    teammateId,
    now,
  });
}
