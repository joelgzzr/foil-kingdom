import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import LoginForm from "@/components/auth/LoginForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { es } from "@/lib/i18n/es";

export const metadata: Metadata = { title: es.auth.loginTitle };

async function LoginCard({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { next, error } = await searchParams; // Next.js 16: searchParams is a Promise
  return (
    <>
      {error === "callback" ? (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {es.auth.callbackError}
        </p>
      ) : null}
      <LoginForm next={typeof next === "string" ? next : undefined} />
    </>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{es.auth.loginTitle}</CardTitle>
        <CardDescription>{es.auth.loginSubtitle}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Suspense fallback={<div className="h-48" aria-hidden />}>
          <LoginCard searchParams={searchParams} />
        </Suspense>
        <p className="text-center text-sm text-muted-foreground">
          {es.auth.noAccount}{" "}
          <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
            {es.nav.signup}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
