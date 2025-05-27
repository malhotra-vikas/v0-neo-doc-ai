import LoginForm from "@/components/login-form"
import { Logo } from "@/components/logo"
import { Shield, Lock, CheckCircle } from "lucide-react"

export default function LoginPage() {
  return (
     <main className="flex min-h-screen flex-col">
       <div className="flex-1 flex flex-col md:flex-row">
         {/* Left side - Login form */}
         <div className="w-full md:w-1/2 flex flex-col items-center justify-center p-8 md:p-16">
           <div className="w-full max-w-md">
             <div className="mb-8">
               <Logo size="lg" />
               <h1 className="mt-6 text-3xl font-bold text-gray-900">Welcome back</h1>
               <p className="mt-2 text-gray-600">Sign in to access your dashboard</p>
             </div>
             <LoginForm />
           </div>
         </div>
 
         {/* Right side - Hero image and features */}
         <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-primary-500 to-secondary-600 text-white p-16 flex-col justify-center">
           <h2 className="text-3xl font-bold mb-6">Streamline Your Nursing Home Management</h2>
           <p className="text-lg mb-8 text-white/90">
             Secure, reliable, and easy-to-use platform for healthcare professionals.
           </p>
 
           <div className="space-y-6">
             <div className="flex items-start">
               <Shield className="h-6 w-6 mr-4 text-white" />
               <div>
                 <h3 className="font-semibold">HIPAA Compliant</h3>
                 <p className="text-white/80">Your data is secure and protected with enterprise-grade security.</p>
               </div>
             </div>
 
             <div className="flex items-start">
               <Lock className="h-6 w-6 mr-4 text-white" />
               <div>
                 <h3 className="font-semibold">Data Privacy</h3>
                 <p className="text-white/80">
                   Patient information is encrypted and only accessible to authorized personnel.
                 </p>
               </div>
             </div>
 
             <div className="flex items-start">
               <CheckCircle className="h-6 w-6 mr-4 text-white" />
               <div>
                 <h3 className="font-semibold">Regulatory Compliance</h3>
                 <p className="text-white/80">Stay compliant with healthcare regulations and standards.</p>
               </div>
             </div>
           </div>
         </div>
       </div>
     </main>
   )
}