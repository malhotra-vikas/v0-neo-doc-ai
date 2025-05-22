import Link from "next/link"
import { Building } from 'lucide-react'

interface LogoProps {
    size?: "sm" | "md" | "lg"
}

export function Logo({ size = "md" }: LogoProps) {
    const sizeClasses = {
        sm: "text-lg",
        md: "text-xl",
        lg: "text-2xl",
    }

    return (
        <Link href="/dashboard" className={`flex items-center font-bold ${sizeClasses[size]}`}>
            <Building className="mr-2 h-6 w-6 text-primary-600" />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-secondary-600">
                NursingCare
            </span>
            <span className="text-gray-700">Pro</span>
        </Link>
    )
}
