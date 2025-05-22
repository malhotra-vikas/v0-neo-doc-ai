import Link from "next/link"
import { Logo } from "./logo"

export function Footer() {
    const currentYear = new Date().getFullYear()

    return (
        <footer className="border-t bg-gray-50">
            <div className="container mx-auto py-8 px-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    <div className="space-y-4">
                        <Logo size="sm" />
                        <p className="text-sm text-gray-600 max-w-xs">
                            Secure, reliable nursing home management software for healthcare professionals.
                        </p>
                    </div>

                    <div>
                        <h4 className="font-semibold text-sm mb-4 text-gray-900">Product</h4>
                        <ul className="space-y-2 text-sm">
                            <li>
                                <Link href="#" className="text-gray-600 hover:text-primary-600">
                                    Features
                                </Link>
                            </li>
                            <li>
                                <Link href="#" className="text-gray-600 hover:text-primary-600">
                                    Pricing
                                </Link>
                            </li>
                            <li>
                                <Link href="#" className="text-gray-600 hover:text-primary-600">
                                    Testimonials
                                </Link>
                            </li>
                            <li>
                                <Link href="#" className="text-gray-600 hover:text-primary-600">
                                    FAQ
                                </Link>
                            </li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-semibold text-sm mb-4 text-gray-900">Resources</h4>
                        <ul className="space-y-2 text-sm">
                            <li>
                                <Link href="#" className="text-gray-600 hover:text-primary-600">
                                    Documentation
                                </Link>
                            </li>
                            <li>
                                <Link href="#" className="text-gray-600 hover:text-primary-600">
                                    Guides
                                </Link>
                            </li>
                            <li>
                                <Link href="#" className="text-gray-600 hover:text-primary-600">
                                    Support
                                </Link>
                            </li>
                            <li>
                                <Link href="#" className="text-gray-600 hover:text-primary-600">
                                    API
                                </Link>
                            </li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-semibold text-sm mb-4 text-gray-900">Company</h4>
                        <ul className="space-y-2 text-sm">
                            <li>
                                <Link href="#" className="text-gray-600 hover:text-primary-600">
                                    About
                                </Link>
                            </li>
                            <li>
                                <Link href="#" className="text-gray-600 hover:text-primary-600">
                                    Blog
                                </Link>
                            </li>
                            <li>
                                <Link href="#" className="text-gray-600 hover:text-primary-600">
                                    Careers
                                </Link>
                            </li>
                            <li>
                                <Link href="#" className="text-gray-600 hover:text-primary-600">
                                    Contact
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="border-t mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
                    <p className="text-sm text-gray-600">&copy; {currentYear} NursingCare Pro. All rights reserved.</p>
                    <div className="flex space-x-6 mt-4 md:mt-0">
                        <Link href="#" className="text-sm text-gray-600 hover:text-primary-600">
                            Privacy Policy
                        </Link>
                        <Link href="#" className="text-sm text-gray-600 hover:text-primary-600">
                            Terms of Service
                        </Link>
                        <Link href="#" className="text-sm text-gray-600 hover:text-primary-600">
                            HIPAA Compliance
                        </Link>
                    </div>
                </div>
            </div>
        </footer>
    )
}
