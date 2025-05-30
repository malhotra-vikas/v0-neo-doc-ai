"use client"

import { createContext, useContext, useEffect, useState } from 'react'
import { UserRole } from '@/types/enums'
import { getServerDatabase } from '@/lib/services/supabase/get-service';

interface UserContextType {
  user: { id: string; email: string } | null;
  userRole: UserRole | null;
  facilityId: string | null;
}

const UserContext = createContext<UserContextType>({
  user: null,
  userRole: null,
  facilityId: null
});

interface UserProviderProps {
  children: React.ReactNode;
  value: UserContextType;
}

export function UserProviderWrapper({ children, value }: UserProviderProps) {
  const [userData, setUserData] = useState<UserContextType>(value);

  useEffect(() => {
    async function fetchUserRole() {
      if (userData.user?.id) {
        const db = getServerDatabase();
        const { data: roleData, error } = await db.getUserRoleByUserId(userData.user.id);

        if (!error && roleData) {
          setUserData(prev => ({
            ...prev,
            userRole: roleData.role,
            facilityId: roleData.facility_id
          }));
        }
      }
    }

    fetchUserRole();
  }, [userData.user]);

  return (
    <UserContext.Provider value={userData}>
      {children}
    </UserContext.Provider>
  );
}

// Single useUser hook for the entire application
export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProviderWrapper');
  }
  return context;
}

// Export default for backwards compatibility
export default UserProviderWrapper;