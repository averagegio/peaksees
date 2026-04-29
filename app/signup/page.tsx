import { AuthPageHeader } from "@/app/components/AuthPageHeader";
import { SignupForm } from "@/app/components/AuthForm";

export default function SignupPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-zinc-100 to-zinc-200 dark:from-zinc-950 dark:to-zinc-900">
      <AuthPageHeader crumb="Sign up" />
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Create your account</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Join peaksees to track your profile
          </p>
        </div>
        <SignupForm />
      </div>
    </div>
  );
}
