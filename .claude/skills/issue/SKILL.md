---
name: issue
description: Use when the user wants to autonomously work a NIVEL `ready-for-agent` GitHub issue end-to-end (claim → branch → code from plan → PR → label transitions → completion comment). Invoke as `/issue <N>` to target a specific issue, or `/issue` to pick the next eligible one (all deps closed).
---

# issue

You are executing the standard NIVEL autonomous-issue flow. Same flow the nightly routines use, just running interactively in this session.

## Determine target issue

- If user passed an issue number as argument → target = that number. Skip the next-eligible search.
- If no argument → run the "Next-issue selection" block below to find the first eligible issue. If none → tell user "Нет подходящих ready-for-agent issues" and stop.

## Per-issue workflow

1. **Read context**
   - `cat CLAUDE.md AGENTS.md`
   - `gh issue view <N>` — note the plan file path and line range it references
   - Read that range from the plan file via Read tool

2. **Claim**
   - Skip if user explicitly invoked with an issue number — assume intent is clear.
   - Otherwise (auto-pick): post a claim comment, sleep briefly, re-fetch, verify your comment is the earliest `🔒 Claimed`. If not — pick the next candidate.
   - When claimed: `gh issue edit <N> --add-label in-progress --remove-label ready-for-agent`

3. **Branch**
   - `git checkout main && git pull && git checkout -b feat/<N>-<slug>`
   - Slug = ≤4 kebab words from issue title

4. **Implement**
   - Copy code verbatim from the plan section. The plan contains complete code — do not improvise.
   - For migrations: apply via Supabase Management API. Token + project ref in `MEMORY.md` → `supabase_access.md`.

5. **Verify**
   - `npx tsc --noEmit` must pass
   - For migrations: run a `SELECT` from `information_schema` to confirm schema change
   - Run any acceptance steps the issue body lists

6. **Commit + PR**
   - Single commit OK. Push.
   - `gh pr create` with title `feat(#<N>): <short>` and body containing:
     - `Closes #<N>`
     - `## Что сделано` — bullets
     - `## Файлы` — list
     - `## Проверка` — acceptance steps run

7. **Close out**
   - `gh issue edit <N> --add-label in_review --remove-label in-progress`
   - `gh issue comment <N>` with detailed completion comment:
     ```
     ✅ Готово.

     **PR:** <url>

     **Что сделано:**
     - …

     **Файлы:**
     - …

     **Как проверить:**
     - …
     ```

8. **If blocked**
   - `gh issue edit <N> --add-label blocked --remove-label in-progress`
   - Post comment explaining what you tried and what's unclear
   - Stop (don't move on — surface the block to the user)

## Next-issue selection (when no arg)

1. `gh issue list --label ready-for-agent --state open --limit 50 --json number,title,body`
2. Sort by issue number ascending
3. For each candidate, parse the "Зависимости" / "Depends on" section of its body for `#N` references
4. For each dep, check `gh issue view <DEP> --json state` — if all closed → eligible
5. Pick the first eligible

## Hard rules

- **NEVER push directly to main.** Always feature branch + PR.
- **Trust the plan code verbatim.** If the plan is unclear or contradictory → stop and ask the user, do not improvise.
- **TypeScript must compile** before PR.
- **Don't edit** `CLAUDE.md`, `AGENTS.md`, or files in `docs/plans/` unless the issue explicitly says so.
- **Stay within the targeted issue.** Don't expand scope.

## Project context (cheat sheet)

- Repo: `profeshionalx-lang/NIVEL` · Next.js 16 App Router · Supabase Postgres · Firebase Auth via Grechka.one
- Supabase project ref: `gqcyaxxhvyvpzuhoysis`
- Supabase Management API token (migrations only): in user memory at `supabase_access.md`
- Auth flow: Гречка → Firebase ID token → HMAC JWT cookie `__session`
- Plans live in `docs/plans/2026-05-12-*.md`
