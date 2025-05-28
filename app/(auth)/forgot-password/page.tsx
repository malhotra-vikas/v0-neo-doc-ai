import { Logo } from "@/components/logo"
import { AuthHero } from "@/components/auth-hero"
import { ForgotPasswordForm } from "@/components/forgot-password-form"

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen flex-col">
      <div className="flex-1 flex flex-col md:flex-row">
        <div className="w-full md:w-1/2 flex flex-col items-center justify-center p-8 md:p-16">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <Logo size="lg" />
              <h1 className="mt-6 text-3xl font-bold text-gray-900">Reset Password</h1>
              <p className="mt-2 text-gray-600">
                Enter your email address and we'll send you a link to reset your password.
              </p>
            </div>
            <ForgotPasswordForm />
          </div>
        </div>
        <AuthHero />
      </div>
    </main>
  )
}