"use client";

import { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
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
import { useToast } from "@/components/ui/use-toast";

interface User {
  id: string;
  email: string;
  created_at: string;
  status: string;
  user_roles: {
    role: string;
    facility_id: string;
  }[];
}

interface UsersListProps {
  facilityId: string;
  facilityName: string;
}

export function UsersList({ facilityId, facilityName }: UsersListProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClientComponentClient();
  const { toast } = useToast();

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("users")
        .select(
          `
    id,
    email,
    created_at,
    status,
    user_roles:user_roles!user_roles_user_id_fkey (
      role,
      facility_id
    )
  `
        )
        .eq("user_roles.facility_id", facilityId)
        .not("user_roles", "is", null);

      if (error) {
        console.error("Error fetching users:", error);
        throw error;
      }

      setUsers(data || []);
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
          <CardTitle>Users - {facilityName}</CardTitle>
          <CardDescription>
            Manage facility users and their access
          </CardDescription>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add User
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
                      <span>{user.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <UserCircle className="mr-2 h-4 w-4" />
                      {user.status}
                      {user.user_roles[0]?.role && (
                        <span className="ml-2 text-sm text-muted-foreground">
                          ({user.user_roles[0].role})
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
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Invite a new user to {facilityName}
            </DialogDescription>
          </DialogHeader>
          <CreateUserForm facilityId={facilityId} onSuccess={handleSuccess} />
        </DialogContent>
      </Dialog>
    </Card>
  );
}
