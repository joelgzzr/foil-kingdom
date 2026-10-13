import type { Metadata } from "next";
import Link from "next/link";

import SignupForm from "@/components/auth/SignupForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { es } from "@/lib/i18n/es";

export const metadata: Metadata = { title: es.auth.signupTitle };

export default function SignupPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{es.auth.signupTitle}</CardTitle>
        <CardDescription>{es.auth.signupSubtitle}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <SignupForm />
        <p className="text-center text-sm text-muted-foreground">
          {es.auth.haveAccount}{" "}
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            {es.nav.login}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
