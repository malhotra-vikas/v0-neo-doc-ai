import { Shield, Lock, CheckCircle } from "lucide-react"

export function AuthHero() {
  return (
    <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-primary-500 to-secondary-600 text-white p-16 flex-col justify-center">
      <h2 className="text-3xl font-bold mb-6">Streamline Your Nursing Home Management</h2>
      <p className="text-lg mb-8 text-white/90">
        Secure, reliable, and easy-to-use platform for healthcare professionals.
      </p>

      <div className="space-y-6">
        <FeatureItem
          icon={<Shield className="h-6 w-6 mr-4 text-white" />}
          title="Data Security"
          description="Your data is secure and protected with enterprise-grade security."
        />
        <FeatureItem
          icon={<Lock className="h-6 w-6 mr-4 text-white" />}
          title="Data Privacy"
          description="Patient information is encrypted and only accessible to authorized personnel."
        />
        <FeatureItem
          icon={<CheckCircle className="h-6 w-6 mr-4 text-white" />}
          title="Regulatory Compliance"
          description="Stay compliant with healthcare regulations and standards."
        />
      </div>
    </div>
  )
}

function FeatureItem({ icon, title, description }: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex items-start">
      {icon}
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-white/80">{description}</p>
      </div>
    </div>
  )
}