import { getSession } from "@/lib/auth/session";
import { getMasterPlan } from "@/lib/actions/masterPlan";
import { redirect } from "next/navigation";
import Image from "next/image";
import type { MasterPlanCategory } from "@/lib/types";

const CATEGORY_LABELS: Record<MasterPlanCategory, string> = {
  strength: "Strengths",
  technique: "Technique",
  tactics: "Tactics",
  custom: "Other",
};

const CATEGORY_BORDER_CLASSES: Record<MasterPlanCategory, string> = {
  strength: "border-l-primary",
  technique: "border-l-secondary",
  tactics: "border-l-error",
  custom: "border-l-on-surface-variant",
};

const CATEGORY_TEXT_CLASSES: Record<MasterPlanCategory, string> = {
  strength: "text-primary",
  technique: "text-secondary",
  tactics: "text-error",
  custom: "text-on-surface-variant",
};

const CATEGORY_BG_CLASSES: Record<MasterPlanCategory, string> = {
  strength: "bg-primary",
  technique: "bg-secondary",
  tactics: "bg-error",
  custom: "bg-on-surface-variant",
};

export default async function MasterPlanPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const plan = await getMasterPlan(user.id);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 glass-nav flex items-center justify-between px-6 h-16">
        <span className="text-lg font-black text-primary uppercase italic tracking-tight">
          Master Plan
        </span>
      </header>

      <main className="px-5 pt-6 pb-36 mx-auto">
        {!plan ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant opacity-30">
              sports_tennis
            </span>
            <p className="text-on-surface-variant text-sm text-center max-w-xs">
              Your trainer hasn&apos;t created a master plan for you yet.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {plan.sections.map((section) => (
              <section key={section.id}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-1 h-5 rounded-full ${CATEGORY_BG_CLASSES[section.category]}`} />
                  <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${CATEGORY_TEXT_CLASSES[section.category]}`}>
                    {CATEGORY_LABELS[section.category]}
                  </span>
                </div>
                <h2 className="text-lg font-black tracking-tight mb-3 pl-3">{section.title}</h2>

                <div className="space-y-3">
                  {section.items.map((item) => (
                    <div
                      key={item.id}
                      className={`bg-surface-card rounded-2xl overflow-hidden border-l-[3px] ${CATEGORY_BORDER_CLASSES[section.category]}`}
                    >
                      {item.image_url && (
                        <div className="relative w-full max-h-64 overflow-hidden">
                          <Image
                            src={item.image_url}
                            alt=""
                            width={800}
                            height={450}
                            className="w-full object-cover"
                            unoptimized
                          />
                        </div>
                      )}
                      <div className="p-4">
                        <p className="font-bold text-sm">{item.title}</p>
                        {item.description && (
                          <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
