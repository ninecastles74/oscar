import { createFileRoute } from "@tanstack/react-router";
import { LoginView } from "@/features/auth/login-view";
import { pageTitle } from "@/lib/brand";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: pageTitle("Sign in") }] }),
  component: LoginView,
});
