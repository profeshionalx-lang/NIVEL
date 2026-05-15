import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ token: string }>;
};

type InviteState =
  | { kind: "ok"; fullName: string; token: string }
  | { kind: "invalid" }
  | { kind: "expired" }
  | { kind: "claimed" };

async function loadInvite(token: string): Promise<InviteState> {
  if (!token || token.length < 16) return { kind: "invalid" };

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("full_name, claim_expires_at, claimed_at")
    .eq("claim_token", token)
    .maybeSingle();

  if (!data) return { kind: "invalid" };
  if (data.claimed_at) return { kind: "claimed" };
  if (
    data.claim_expires_at &&
    new Date(data.claim_expires_at).getTime() < Date.now()
  ) {
    return { kind: "expired" };
  }
  return { kind: "ok", fullName: data.full_name ?? "", token };
}

export default async function InvitePage({ params }: PageProps) {
  const { token } = await params;
  const state = await loadInvite(token);

  if (state.kind !== "ok") {
    const msg =
      state.kind === "expired"
        ? "Срок действия приглашения истёк. Попросите тренера выпустить новую ссылку."
        : state.kind === "claimed"
        ? "Это приглашение уже использовано. Войдите обычным способом."
        : "Ссылка-приглашение недействительна.";
    return (
      <main className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-2xl font-semibold mb-4">Приглашение недоступно</h1>
        <p className="text-neutral-600 mb-6">{msg}</p>
        <Link href="/login" className="underline">
          На страницу входа
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-2xl font-semibold mb-2">
        Привет{state.fullName ? `, ${state.fullName}` : ""}!
      </h1>
      <p className="text-neutral-600 mb-6">
        Ваш тренер уже создал для вас профиль в Nivel. Войдите через Гречку,
        чтобы привязать его к вашему аккаунту.
      </p>
      <a
        href={`/api/auth/grechka?claim=${encodeURIComponent(state.token)}`}
        className="inline-block rounded-md bg-black text-white px-6 py-3 font-medium"
      >
        Войти через Гречку
      </a>
    </main>
  );
}
