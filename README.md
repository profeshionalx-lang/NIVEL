# Nivel — Coaching Platform

Платформа коучинга для падел-тенниса. Тренер планирует занятия, ученик видит прогресс.

## Tech Stack

- Next.js 16 (App Router, TypeScript)
- Supabase (Auth, PostgreSQL, RLS)
- Tailwind CSS v4
- Vercel (deploy)

## Setup

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Enable Google OAuth in Supabase → Authentication → Providers
3. Run SQL migrations from `supabase/migrations/` in order
4. Copy `.env.local` and fill in your Supabase credentials

```bash
npm install
npm run dev
```

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Roles

- **Student**: any Google account (auto-assigned)
- **Trainer**: profeshionalx@gmail.com (auto-detected on signup)
