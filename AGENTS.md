# Project Working Agreement

## Product

This repository contains Momentum, a motivation-first project-management
platform. Its central workflow is:

create task -> choose Focus Task -> complete task -> award points ->
update streak -> generate encouragement -> update team progress.

Do not turn the application into a general-purpose enterprise project
management suite.

## Technical conventions

- Use TypeScript with strict type checking.
- Prefer server-side authorization checks.
- Keep domain logic outside React components.
- Use small, testable pure functions for points, streaks, achievements,
  and motivation-message selection.
- Never calculate trusted reward values in the browser.
- Use immutable point-ledger records.
- All reward operations must be idempotent.
- Validate all external input.
- Keep notification providers behind adapter interfaces.
- Do not add production dependencies without documenting why they are needed.
- Do not expose secret keys to client-side code.

## User experience

- Use supportive language rather than guilt or punishment.
- Do not introduce a public leaderboard by default.
- Do not penalize users with negative points.
- External notifications must respect user preferences and quiet hours.
- Keep the primary dashboard focused on today's work and visible progress.
- Maintain keyboard accessibility and responsive layouts.

## Testing

- Add unit tests for domain logic.
- Add integration tests for task completion and point awarding.
- Add an end-to-end test for the main happy path.
- Verify that reopening and recompleting a task cannot award points twice.
- Run type checking, linting, unit tests, and relevant end-to-end tests
  before declaring work complete.

## Commands

Before finishing a task, run the repository's documented commands for:

1. formatting;
2. linting;
3. type checking;
4. unit tests;
5. relevant end-to-end tests.

## Change discipline

- Inspect existing code before editing.
- State the implementation plan before making substantial changes.
- Keep changes within the requested scope.
- Do not silently rewrite unrelated files.
- Update documentation when behavior or setup changes.
- Summarize changed files, validation performed, and remaining limitations.
