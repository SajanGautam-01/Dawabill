import { redirect } from "next/navigation";

export default function AuthPage() {
  // Gracefully redirect users from /auth to /auth/login
  redirect("/auth/login");
}
