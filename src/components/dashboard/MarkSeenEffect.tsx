"use client";

import { useEffect } from "react";
import { markDashboardSeen } from "@/lib/actions/dashboard";

interface Props {
  userId: string;
}

/**
 * Fire-and-forget: after the student has had the dashboard open for 3s,
 * mark skill points and goals as "seen" so NEW badges / deltas reset
 * on the next visit. Renders nothing.
 */
export default function MarkSeenEffect({ userId }: Props) {
  useEffect(() => {
    const timer = setTimeout(() => {
      void markDashboardSeen(userId);
    }, 3000);
    return () => clearTimeout(timer);
  }, [userId]);

  return null;
}
