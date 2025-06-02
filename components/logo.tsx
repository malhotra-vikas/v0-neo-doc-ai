"use client";
import Link from "next/link";
import Image from "next/image";
import { Building } from "lucide-react";
import { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useAuth } from "./providers/auth-provider";
import { UserRole } from "@/types/enums";
import { StorageService } from "@/lib/services/supabase/storage";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  facilityName?: string;
  facilityLogoUrl?: string | null;
}

export function Logo({
  size = "md",
  facilityName,
  facilityLogoUrl,
}: LogoProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const { userRole } = useAuth();

  const supabase = createClientComponentClient();
  const storageService = new StorageService();

  const sizeClasses = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl",
  };

  useEffect(() => {
    const fetchLogo = async () => {
      if (!facilityLogoUrl) return;

      try {
        const objectUrl =await storageService.getFacilityLogoUrl(facilityLogoUrl);
        setLogoUrl(objectUrl);
      } catch (error) {
        console.log("Error loading logo:", error);
      }
    };

    fetchLogo();

    // Cleanup
    return () => {
      if (logoUrl) {
        URL.revokeObjectURL(logoUrl);
      }
    };
  }, [facilityLogoUrl, supabase]);

  return (
    <Link
      href="/dashboard"
      className={`flex items-center font-bold ${sizeClasses[size]}`}
    >
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt={`${facilityName || "Facility"} Logo`}
          width={40}
          height={40}
          className="mr-2 h-8 w-auto object-contain"
          priority
          onError={() => {
            setLogoUrl(null);
            console.error("Error loading logo image");
          }}
        />
      ) : (
        <>
          {userRole === UserRole.SUPER_ADMIN && (
            <Building className="mr-2 h-6 w-6 text-primary-600" />
          )}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-secondary-600">
            {facilityName || "NursingCare"}
          </span>
          {!facilityName && <span className="text-gray-700">Pro</span>}
        </>
      )}
    </Link>
  );
}
