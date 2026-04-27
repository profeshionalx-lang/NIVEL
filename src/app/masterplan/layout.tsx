import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import BottomNav from "@/components/navigation/BottomNav";

export default async function MasterPlanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect("/login");

  return (
    <div className="relative mx-auto min-h-screen max-w-[430px] bg-background">
      {children}
      <BottomNav role={user.role} />
    </div>
  );
}
