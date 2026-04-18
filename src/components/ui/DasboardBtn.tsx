"use client";

import Link from "next/link";
import { Button } from "./button";
import { SparklesIcon } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

function DasboardBtn() {
  const { isLoading, canAccessDashboard } = useUserRole();

  if (!canAccessDashboard || isLoading) return null;
  return (
    <Link href="/dashboard">
      <Button className="gap-2 font-medium" variant="default" size="sm">
        <SparklesIcon className="size-4" />
        Dashboard
      </Button>
    </Link>
  );
}

export default DasboardBtn;
