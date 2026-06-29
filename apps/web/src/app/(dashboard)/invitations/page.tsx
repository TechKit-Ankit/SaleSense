"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Check, X } from "lucide-react";

export default function MyInvitationsPage() {
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInvitations = async () => {
    try {
      const data = await apiClient.get("/invitations/my-invitations");
      setInvitations(data || []);
    } catch (e) {
      toast.error("Failed to load invitations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvitations();
  }, []);

  const respondToInvite = async (id: string, action: 'ACCEPT' | 'REJECT') => {
    try {
      await apiClient.post(`/invitations/${id}/respond`, { action });
      toast.success(`Invitation ${action.toLowerCase()}ed successfully`);
      fetchInvitations();
      
      // If accepted, they might have a new store in their list, 
      // they might need to refresh the page or we update auth context
      if (action === 'ACCEPT') {
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to respond to invitation");
    }
  };

  if (loading) return <div className="p-8">Loading invitations...</div>;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">My Invitations</h1>
        <p className="text-muted-foreground">Manage your pending store invitations.</p>
      </div>

      <div className="max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>Pending Store Invites</CardTitle>
            <CardDescription>Review and accept or reject store invitations.</CardDescription>
          </CardHeader>
          <CardContent>
            {invitations.length === 0 ? (
              <p className="text-sm text-muted-foreground">You have no pending invitations.</p>
            ) : (
              <div className="space-y-4">
                {invitations.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Store ID: {inv.storeId}</p>
                      <p className="text-sm text-muted-foreground">Invited as {inv.role}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={() => respondToInvite(inv.id, 'ACCEPT')} className="bg-green-600 hover:bg-green-700">
                        <Check className="mr-1 h-4 w-4" /> Accept
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => respondToInvite(inv.id, 'REJECT')} className="text-destructive">
                        <X className="mr-1 h-4 w-4" /> Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
