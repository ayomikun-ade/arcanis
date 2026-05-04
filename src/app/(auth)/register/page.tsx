"use client";

import Link from "next/link";
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
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { PasswordInput } from "@/components/ui/password-input";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/lib/auth";

const schema = z
  .object({
    username: z
      .string()
      .min(3, "At least 3 characters")
      .max(32, "Max 32 characters")
      .regex(
        /^[a-zA-Z0-9_-]+$/,
        "Letters, digits, hyphens and underscores only",
      ),
    display_name: z
      .string()
      .min(1, "Required")
      .max(64, "Max 64 characters"),
    password: z
      .string()
      .min(8, "At least 8 characters")
      .max(128, "Max 128 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  return (
    <AuthGate expects="anonymous">
      <RegisterForm />
    </AuthGate>
  );
}

function RegisterForm() {
  const { register: registerAccount } = useAuth();
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      username: "",
      display_name: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    try {
      await registerAccount({
        username: values.username,
        display_name: values.display_name,
        password: values.password,
      });
      router.replace("/app");
    } catch (e) {
      setSubmitError(
        e instanceof Error ? e.message : "Registration failed. Try again.",
      );
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>
          Your encryption keys are generated on this device. The server never
          sees your password.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="flex flex-col gap-4">
          <Field
            label="Username"
            htmlFor="username"
            error={errors.username?.message}
            hint="3–32 chars · letters, digits, _, -"
          >
            <Input
              id="username"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              {...register("username")}
            />
          </Field>
          <Field
            label="Display name"
            htmlFor="display_name"
            error={errors.display_name?.message}
          >
            <Input
              id="display_name"
              autoComplete="nickname"
              {...register("display_name")}
            />
          </Field>
          <Field
            label="Password"
            htmlFor="password"
            error={errors.password?.message}
            hint="8+ characters. This unlocks your private key on every device — pick a strong one."
          >
            <PasswordInput
              id="password"
              autoComplete="new-password"
              {...register("password")}
            />
          </Field>
          <Field
            label="Confirm password"
            htmlFor="confirmPassword"
            error={errors.confirmPassword?.message}
          >
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              {...register("confirmPassword")}
            />
          </Field>
          {submitError && <Alert variant="destructive">{submitError}</Alert>}
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-3 pt-2">
          <Button type="submit" size="lg" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Spinner /> Generating keys…
              </>
            ) : (
              "Create account"
            )}
          </Button>
          <p className="text-center text-sm font-medium">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-bold underline underline-offset-2"
            >
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
