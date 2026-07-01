// src/components/dashboard/SubscriptionCard.tsx
import { t, type Locale } from "@/lib/i18n";
import type { DashboardSubscription } from "@/lib/dashboard/data";

interface Props {
  subscription: DashboardSubscription;
  locale: Locale;
}

export default function SubscriptionCard({ subscription, locale }: Props) {
  const { total, completed, planned, remaining } = subscription;
  const percent = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;

  return (
    <section className="bg-surface-low rounded-3xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">
          {t(locale, "subscription.title")}
        </p>
        <span className="material-symbols-outlined text-primary text-base fill-icon">
          confirmation_number
        </span>
      </div>

      {/* Остаток крупно */}
      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-4xl font-black tracking-tighter kinetic-text leading-none">
          {remaining}
        </span>
        <span className="text-sm font-bold text-on-surface-variant">
          {t(locale, "subscription.of")} {total}
        </span>
        <span className="ml-auto text-xs font-black uppercase tracking-wider text-on-surface-variant">
          {t(locale, "subscription.remaining")}
        </span>
      </div>

      {/* Прогресс проведённых */}
      <div className="h-1.5 w-full rounded-full bg-surface-elevated relative overflow-hidden mb-3">
        <div
          className="absolute inset-y-0 left-0 h-full kinetic-gradient bar-glow-primary transition-all duration-500"
          style={{ width: `${percent}%`, borderRadius: "0 9999px 9999px 0" }}
        />
      </div>

      {/* Разбивка */}
      <div className="flex items-center gap-4 text-[11px] text-on-surface-variant">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          {t(locale, "subscription.completed")}: <b className="text-on-surface">{completed}</b>
        </span>
        {planned > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary opacity-70" />
            {t(locale, "subscription.planned")}: <b className="text-on-surface">{planned}</b>
          </span>
        )}
      </div>
    </section>
  );
}
