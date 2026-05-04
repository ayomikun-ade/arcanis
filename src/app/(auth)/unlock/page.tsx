"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { AuthGate } from "@/components/auth/auth-gate";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { PasswordInput } from "@/components/ui/password-input";
import { Spinner } from "@/components/ui/spinner";
import { useAuth, type AuthState } from "@/lib/auth";

const schema = z.object({
  password: z.string().min(1, "Required"),
});

type FormValues = z.infer<typeof schema>;

export default function UnlockPage() {
  return (
    <AuthGate expects="needs-unlock">
      <UnlockForm />
    </AuthGate>
  );
}

function UnlockForm() {
  const { state, unlock, logout } = useAuth();
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Narrowed by AuthGate, but TS doesn't know — pull `persisted` defensively.
  const persisted =
    state.status === "needs-unlock"
      ? (state as Extract<AuthState, { status: "needs-unlock" }>).persisted
      : null;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    try {
      await unlock(values.password);
      router.replace("/app");
    } catch (e) {
      setSubmitError(
        e instanceof Error ? e.message : "Couldn't unlock. Try again.",
      );
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Unlock your messages</CardTitle>
        <CardDescription>
          {persisted ? (
            <>
              Welcome back,{" "}
              <span className="font-bold text-foreground">
                {persisted.user.display_name}
              </span>
              . Enter your password to decrypt your private key on this device.
            </>
          ) : (
            "Enter your password to decrypt your private key on this device."
          )}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="flex flex-col gap-4">
          <Field
            label="Password"
            htmlFor="password"
            error={errors.password?.message}
          >
            <PasswordInput
              id="password"
              autoFocus
              autoComplete="current-password"
              {...register("password")}
            />
          </Field>
          {submitError && <Alert variant="destructive">{submitError}</Alert>}
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-3 pt-2">
          <Button type="submit" size="lg" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Spinner /> Unlocking…
              </>
            ) : (
              "Unlock"
            )}
          </Button>
          <button
            type="button"
            onClick={() => {
              void logout().then(() => router.replace("/login"));
            }}
            className="text-center text-sm font-bold text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Sign in as someone else
          </button>
        </CardFooter>
      </form>
    </Card>
  );
}
