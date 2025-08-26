import LoginForm from "@/components/login-form"
import { Logo } from "@/components/logo"
import { AuthHero } from "@/components/auth-hero"
import Image from "next/image"

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col">
      <div className="flex-1 flex flex-col md:flex-row">
        <div className="w-full md:w-1/2 flex flex-col items-center justify-center p-8 md:p-16">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <Image
                src="/logo.png"
                alt="Puzzle Healthcare"
                width={180}
                height={60}
                priority
              />

              <h1 className="mt-6 text-3xl font-bold text-gray-900">Welcome back</h1>
              <p className="mt-2 text-gray-600">Sign in to access your dashboard</p>
            </div>
            <LoginForm />
          </div>
        </div>
        <AuthHero />
      </div>
    </main>
  )
}