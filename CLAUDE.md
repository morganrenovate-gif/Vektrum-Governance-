# Vektrum Claude Code Instructions

## Core Context
Use @docs/ai/MASTER_CONTEXT.md for current product state.
Use @docs/ai/BACKLOG.md for priorities.

## Session Output
Use @docs/ai/HANDOFF_NOTES_TEMPLATE.md at the end of work sessions.

## Rules
- Use test-driven development for code changes.
- Consider security implications before implementation.
- Optimize for minimal token usage.
- Inspect only relevant files.
- Do not load unnecessary context.
- Refactor when it reduces risk, duplication, or complexity.

## Default Workflow
1. Identify the task.
2. Inspect relevant files only.
3. Write or update tests first when code behavior changes.
4. Implement the smallest safe change.
5. Run relevant tests/build checks.
6. Summarize what changed.
7. Update handoff notes when requested.

## Agents & Skills (On Demand Only)

Use @docs/ai/agents/VEKTRUM_27_AGENTS.md only when agent orchestration is explicitly requested.

Use @docs/ai/skills/VEKTRUM_64_SKILLS.md only when a specialized workflow is required.

Never load all agents or skills by default.
Select only what is needed for the task.
