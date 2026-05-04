"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Shield01Icon,
  LockIcon,
  FingerPrintIcon,
  Key01Icon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";

export default function Home() {
  const { state } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (state.status === "authenticated") router.replace("/app");
    else if (state.status === "needs-unlock") router.replace("/unlock");
  }, [state.status, router]);

  return (
    <main className="bg-dotted flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-4xl flex-col items-center gap-10 text-center">
        <Badge variant="accent" className="text-sm">
          <HugeiconsIcon icon={LockIcon} size={14} strokeWidth={2.5} />
          End-to-end encrypted
        </Badge>

        <div className="flex flex-col items-center gap-5">
          <h1 className="text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-7xl">
            Arcanis
          </h1>
          <p className="max-w-2xl text-lg font-medium text-foreground/80 sm:text-xl">
            A zero-knowledge messenger. Your messages are encrypted on your
            device — the server only ever sees ciphertext.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/register">Create an account</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/login">I already have one</Link>
          </Button>
        </div>

        <div className="grid w-full grid-cols-1 gap-4 pt-8 sm:grid-cols-3">
          <FeatureCard
            icon={Shield01Icon}
            title="Server-blind"
            body="Plaintext never leaves your browser. The backend stores encrypted blobs and forwards them — that's it."
          />
          <FeatureCard
            icon={Key01Icon}
            title="Your keys, your control"
            body="A unique RSA keypair is generated on registration. The private key is wrapped with your password and never persisted in plaintext."
          />
          <FeatureCard
            icon={FingerPrintIcon}
            title="Hybrid encryption"
            body="AES-GCM 256 for messages, RSA-OAEP for key exchange — implemented with the browser's Web Crypto API."
          />
        </div>
      </div>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: Parameters<typeof HugeiconsIcon>[0]["icon"];
  title: string;
  body: string;
}) {
  return (
    <Card className="p-5 text-left">
      <CardContent className="flex flex-col gap-3 p-0">
        <div className="flex size-11 items-center justify-center rounded-base border-2 border-border bg-primary text-primary-foreground shadow-brutal-sm">
          <HugeiconsIcon icon={icon} size={22} strokeWidth={2} />
        </div>
        <h3 className="font-bold text-lg tracking-tight">{title}</h3>
        <p className="text-sm text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}
