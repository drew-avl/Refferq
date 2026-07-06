'use client';

import React, { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Mail,
  Shield,
  Trash2,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  UserX,
} from 'lucide-react';

interface AssignablePartner {
  id: string;
  name: string;
  email: string;
  status: string;
}

interface TeamMember {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  permissions: unknown;
  invitedBy: string;
  userId?: string;
  assignedPartnerIds: string[];
  assignedPartners: AssignablePartner[];
  createdAt: string;
  updatedAt: string;
}

const ROLES = [
  { value: 'STAFF', label: 'Staff', description: 'Assigned partners and their leads only' },
  { value: 'ADMIN', label: 'Admin', description: 'Full admin access' },
];

const emptyForm = {
  email: '',
  name: '',
  password: '',
  role: 'STAFF',
  assignedAffiliateIds: [] as string[],
};

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [assignablePartners, setAssignablePartners] = useState<AssignablePartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [selectedPartnerIds, setSelectedPartnerIds] = useState<string[]>([]);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/team');
      const data = await res.json();
      if (data.success) {
        setMembers(data.members || []);
        setAssignablePartners(data.assignablePartners || []);
      }
    } catch (error) {
      console.error('Failed to fetch team members:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFormPartner = (partnerId: string) => {
    setForm((current) => ({
      ...current,
      assignedAffiliateIds: current.assignedAffiliateIds.includes(partnerId)
        ? current.assignedAffiliateIds.filter((id) => id !== partnerId)
        : [...current.assignedAffiliateIds, partnerId],
    }));
  };

  const toggleAccessPartner = (partnerId: string) => {
    setSelectedPartnerIds((current) =>
      current.includes(partnerId)
        ? current.filter((id) => id !== partnerId)
        : [...current, partnerId]
    );
  };

  const handleCreateMember = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/admin/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        await fetchMembers();
        setDialogOpen(false);
        setForm(emptyForm);
        if (data.temporaryPassword) {
          alert(`Staff login created.\n\nTemporary password: ${data.temporaryPassword}`);
        }
      } else {
        alert(data.error || 'Failed to create team member');
      }
    } catch (error) {
      console.error('Failed to create team member:', error);
      alert('Failed to create team member');
    } finally {
      setSaving(false);
    }
  };

  const updateMember = async (id: string, updates: Partial<TeamMember>) => {
    try {
      const res = await fetch('/api/admin/team', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      });
      const data = await res.json();
      if (!data.success) alert(data.error || 'Failed to update team member');
      await fetchMembers();
    } catch (error) {
      console.error('Failed to update member:', error);
      alert('Failed to update team member');
    }
  };

  const deleteMember = async (id: string) => {
    if (!confirm('Remove this team member and revoke their staff access?')) return;
    try {
      const res = await fetch(`/api/admin/team?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) alert(data.error || 'Failed to remove team member');
      await fetchMembers();
    } catch (error) {
      console.error('Failed to delete member:', error);
      alert('Failed to remove team member');
    }
  };

  const openAccessDialog = (member: TeamMember) => {
    setEditingMember(member);
    setSelectedPartnerIds(member.assignedPartnerIds || []);
    setAccessDialogOpen(true);
  };

  const saveAccess = async () => {
    if (!editingMember) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/team', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingMember.id,
          assignedAffiliateIds: selectedPartnerIds,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAccessDialogOpen(false);
        setEditingMember(null);
        await fetchMembers();
      } else {
        alert(data.error || 'Failed to update partner access');
      }
    } catch (error) {
      console.error('Failed to update partner access:', error);
      alert('Failed to update partner access');
    } finally {
      setSaving(false);
    }
  };

  const getRoleBadge = (role: string) => {
    const map: Record<string, 'default' | 'secondary' | 'outline'> = {
      OWNER: 'default',
      ADMIN: 'default',
      STAFF: 'secondary',
      MANAGER: 'secondary',
      VIEWER: 'outline',
    };
    return <Badge variant={map[role] || 'outline'}>{role}</Badge>;
  };

  const getStatusBadge = (status: string) => (
    <Badge variant={status === 'ACTIVE' ? 'default' : status === 'PENDING' ? 'secondary' : 'destructive'} className="gap-1 text-xs">
      {status === 'ACTIVE' ? <UserCheck className="h-3 w-3" /> : status === 'PENDING' ? <Mail className="h-3 w-3" /> : <UserX className="h-3 w-3" />}
      {status}
    </Badge>
  );

  const stats = {
    total: members.length,
    active: members.filter((member) => member.status === 'ACTIVE').length,
    staff: members.filter((member) => member.role === 'STAFF').length,
    admins: members.filter((member) => ['OWNER', 'ADMIN'].includes(member.role)).length,
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team Members</h1>
          <p className="text-muted-foreground">Manage staff logins and partner access</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Create Staff Login
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <UserCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.active}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Staff</CardTitle>
            <UserCog className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.staff}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Admins</CardTitle>
            <Shield className="h-4 w-4 text-violet-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.admins}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Members</CardTitle>
          <CardDescription>Staff can only access partners assigned here</CardDescription>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground/50" />
              <h2 className="mt-4 text-lg font-semibold">No team members</h2>
              <p className="text-sm text-muted-foreground">Create a staff login to delegate partner management</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned Partners</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.name}</TableCell>
                    <TableCell className="text-muted-foreground">{member.email}</TableCell>
                    <TableCell>{getRoleBadge(member.role)}</TableCell>
                    <TableCell>{getStatusBadge(member.status)}</TableCell>
                    <TableCell className="max-w-sm">
                      {member.role === 'STAFF' ? (
                        <p className="truncate text-sm text-muted-foreground">
                          {member.assignedPartners.length > 0
                            ? member.assignedPartners.map((partner) => partner.name).join(', ')
                            : 'No partners assigned'}
                        </p>
                      ) : (
                        <span className="text-sm text-muted-foreground">All partners</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {member.role === 'STAFF' && (
                          <Button variant="ghost" size="sm" onClick={() => openAccessDialog(member)}>
                            Partner Access
                          </Button>
                        )}
                        {member.status === 'ACTIVE' && member.role !== 'OWNER' && (
                          <Button variant="ghost" size="sm" onClick={() => updateMember(member.id, { status: 'DEACTIVATED' })}>
                            Deactivate
                          </Button>
                        )}
                        {member.status !== 'ACTIVE' && member.role !== 'OWNER' && (
                          <Button variant="ghost" size="sm" onClick={() => updateMember(member.id, { status: 'ACTIVE' })}>
                            Activate
                          </Button>
                        )}
                        {member.role !== 'OWNER' && (
                          <Button variant="ghost" size="icon" onClick={() => deleteMember(member.id)} aria-label={`Remove ${member.name}`}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Team Login</DialogTitle>
            <DialogDescription>Staff users can access only the partners assigned to them.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateMember} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="Taylor Morgan"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  placeholder="staff@example.com"
                  required
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(value) => setForm({ ...form, role: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        <div>
                          <span className="font-medium">{role.label}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{role.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Temporary Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  placeholder="Auto-generated if blank"
                />
              </div>
            </div>

            {form.role === 'STAFF' && (
              <div className="space-y-2">
                <Label>Assigned Partners</Label>
                <div className="max-h-56 overflow-y-auto rounded-md border p-3">
                  {assignablePartners.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No partners are available yet</p>
                  ) : (
                    <div className="space-y-3">
                      {assignablePartners.map((partner) => (
                        <label key={partner.id} className="flex cursor-pointer items-start gap-3">
                          <Checkbox
                            checked={form.assignedAffiliateIds.includes(partner.id)}
                            onCheckedChange={() => toggleFormPartner(partner.id)}
                          />
                          <span className="grid gap-1 text-sm leading-none">
                            <span className="font-medium">{partner.name}</span>
                            <span className="text-xs text-muted-foreground">{partner.email}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !form.email || !form.name}>
                {saving ? 'Creating...' : 'Create Login'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={accessDialogOpen} onOpenChange={setAccessDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Partner Access</DialogTitle>
            <DialogDescription>
              {editingMember ? `Choose which partners ${editingMember.name} can view and manage.` : 'Choose assigned partners.'}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-72 overflow-y-auto rounded-md border p-3">
            {assignablePartners.length === 0 ? (
              <p className="text-sm text-muted-foreground">No partners are available yet</p>
            ) : (
              <div className="space-y-3">
                {assignablePartners.map((partner) => (
                  <label key={partner.id} className="flex cursor-pointer items-start gap-3">
                    <Checkbox
                      checked={selectedPartnerIds.includes(partner.id)}
                      onCheckedChange={() => toggleAccessPartner(partner.id)}
                    />
                    <span className="grid gap-1 text-sm leading-none">
                      <span className="font-medium">{partner.name}</span>
                      <span className="text-xs text-muted-foreground">{partner.email}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAccessDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveAccess} disabled={saving}>
              {saving ? 'Saving...' : 'Save Access'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
