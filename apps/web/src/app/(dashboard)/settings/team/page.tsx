"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { apiClient } from "@/lib/api-client/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { UserPlus, UserMinus, Shield } from "lucide-react";

export default function TeamSettingsPage() {
  const { activeStore } = useAuth();
  const [team, setTeam] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTeam = async () => {
    if (!activeStore?.id) return;
    try {
      const data = await apiClient.get(`/stores/${activeStore.id}/users`);
      setTeam(data || []);
      const invData = await apiClient.get(`/stores/${activeStore.id}/invitations`);
      setInvitations(invData || []);
    } catch (e) {
      toast.error("Failed to load team data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, [activeStore?.id]);

  const removeUser = async (userId: string) => {
    try {
      await apiClient.delete(`/stores/${activeStore!.id}/users/${userId}`);
      toast.success("User removed");
      fetchTeam();
    } catch (e: any) {
      toast.error(e.message || "Failed to remove user");
    }
  };

  if (loading) return <div>Loading team...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Team Management</h3>
        <p className="text-sm text-muted-foreground">
          Manage who has access to your store.
        </p>
      </div>
      
      <div className="flex justify-end">
        <Button onClick={() => toast.info("Invite feature coming soon in this demo!")}>
          <UserPlus className="mr-2 h-4 w-4" />
          Invite User
        </Button>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Active Members</CardTitle>
            <CardDescription>Users who currently have access.</CardDescription>
          </CardHeader>
          <CardContent>
            {team.length === 0 ? (
              <p className="text-sm text-muted-foreground">No team members found.</p>
            ) : (
              <div className="space-y-4">
                {team.map((member) => (
                  <div key={member.userId} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{member.user.name}</p>
                      <p className="text-sm text-muted-foreground">{member.user.email || member.user.phone}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1 text-sm bg-muted px-2 py-1 rounded">
                        <Shield className="h-3 w-3" />
                        {member.role}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeUser(member.userId)} className="text-destructive">
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {invitations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Pending Invitations</CardTitle>
              <CardDescription>Sent invitations awaiting response.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {invitations.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{inv.invitedEmail || inv.invitedPhone}</p>
                      <p className="text-sm text-muted-foreground">Invited as {inv.role}</p>
                    </div>
                    <div className="text-sm bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                      {inv.status}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
