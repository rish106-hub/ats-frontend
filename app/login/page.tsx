import { Suspense } from "react";
import { AuthPanel } from "@/components/auth-panel";

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#f5f2ea]" />}>
      <AuthPanel mode="login" />
    </Suspense>
  );
}
