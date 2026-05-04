import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { HugeiconsIcon } from "@hugeicons/react";
import { LockIcon } from "@hugeicons/core-free-icons";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="bg-dotted flex flex-1 flex-col items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <Link href="/" className="flex flex-col items-center gap-3">
          <Badge variant="accent" className="text-xs">
            <HugeiconsIcon icon={LockIcon} size={12} strokeWidth={2.5} />
            End-to-end encrypted
          </Badge>
          <h1 className="text-3xl font-black uppercase tracking-tight">
            Arcanis
          </h1>
        </Link>
        {children}
      </div>
    </main>
  );
}
