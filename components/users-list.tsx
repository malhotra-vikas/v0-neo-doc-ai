"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Mail, UserCircle } from "lucide-react";
import { CreateUserForm } from "./create-user-form";
import { useToast } from "@/hooks/use-toast";
import { UserRole } from "@/types/enums";
import { useUser } from "./providers/user-provider";
import { getClientDatabase } from "@/lib/services/supabase";
import { UserRoleWithUser } from "@/types";


interface UsersListProps {
  facilityId?: string;
  facilityName?: string;
  isSuperAdminView?: boolean;
}

export function UsersList({ 
  facilityId, 
  facilityName,
  isSuperAdminView = false 
}: UsersListProps) {
  const { user, userRole } = useUser();
  const db = getClientDatabase()
  const [users, setUsers] = useState<UserRoleWithUser[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const isSuperAdmin = userRole === UserRole.SUPER_ADMIN;
  const inviteUserRole = isSuperAdminView ? UserRole.SUPER_ADMIN : 
    (isSuperAdmin ? UserRole.FACILITY_ADMIN : UserRole.FACILITY_USER);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      if (isSuperAdminView) {
        const { data } = await db.getUsersWithRole(null, UserRole.SUPER_ADMIN,user?.id)
        setUsers(data || []);
      } else {
        // Fetch facility users
        const { data } = await db.getUsersWithRole(facilityId!, isSuperAdmin ? null : inviteUserRole)
        setUsers(data || []);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to refresh users list",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [facilityId]);

  const handleSuccess = async () => {
    setIsCreateDialogOpen(false);
    await fetchUsers();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>
            {isSuperAdminView ? "Super Administrators" : `Users - ${facilityName}`}
          </CardTitle>
          <CardDescription>
            {isSuperAdminView 
              ? "Manage system super administrators"
              : "Manage facility users and their access"
            }
          </CardDescription>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {isSuperAdminView ? "Add Super Admin" : "Add User"}
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center">
                  {isLoading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-800" />
                    </div>
                  ) : (
                    "No users found. Add your first one!"
                  )}
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4" />
                      <span>{Array.isArray(user.users) ? user.users[0].email : user.users.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <UserCircle className="mr-2 h-4 w-4" />
                      {Array.isArray(user.users) ? user.users[0].status : user.users.status}
                      {user.role && (
                        <span className="ml-2 text-sm text-muted-foreground">
                          ({user.role})
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(user.created_at).toLocaleDateString("en-GB")}
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm">
                      Manage Access
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isSuperAdminView ? "Add Super Administrator" : "Add New User"}
            </DialogTitle>
            <DialogDescription>
              {isSuperAdminView 
                ? "Invite a new super administrator to the system"
                : `Invite a new user to ${facilityName}`
              }
            </DialogDescription>
          </DialogHeader>
          <CreateUserForm 
            facilityId={isSuperAdminView ? undefined : facilityId} 
            onSuccess={handleSuccess}
            role={inviteUserRole}
            isInsertSuperAdmin={isSuperAdminView}
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
}
