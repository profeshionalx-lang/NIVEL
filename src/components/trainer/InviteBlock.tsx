// src/components/trainer/InviteBlock.tsx
import { getStudentInvite } from "@/lib/actions/students";
import InviteBlockClient from "./InviteBlockClient";

export default async function InviteBlock({ studentId }: { studentId: string }) {
  const invite = await getStudentInvite(studentId);
  if (!invite) return null;

  const baseUrl = process.env.NEXT_PUBLIC_NIVEL_URL ?? "http://localhost:3000";
  const claimUrl = `${baseUrl}/claim/${invite.token}`;

  return (
    <InviteBlockClient
      studentId={studentId}
      claimUrl={claimUrl}
      status={invite.status}
      claimedAt={invite.claimed_at}
    />
  );
}
