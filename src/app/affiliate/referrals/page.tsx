'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Users,
  Plus,
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Ban,
  Search,
  Download,
  Pencil,
} from 'lucide-react';

interface Referral {
  id: string;
  leadName: string;
  leadEmail: string;
  leadPhone: string | null;
  address: string;
  address2: string;
  moveInDate: string;
  program?: Program | null;
  company?: string;
  notes?: string | null;
  status: string;
  createdAt: string;
}

interface Program {
  id: string;
  name: string;
  referralPayoutCents: number;
  currency: string;
  isDefault: boolean;
}

const CLOSED_REFERRAL_STATUSES = ['SOLD', 'COMPLETED'];
type LeadTab = 'all' | 'active' | 'closed' | 'rejected';
const STATUS_PRIORITY: Record<string, number> = {
  NEW: 0,
  PENDING: 1,
  SOLD: 2,
  COMPLETED: 3,
  REJECTED: 4,
};

export default function ReferralsPage() {
  const { user, loading: authLoading } = useAuth();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editingReferral, setEditingReferral] = useState<Referral | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [leadTab, setLeadTab] = useState<LeadTab>('active');
  const [submitForm, setSubmitForm] = useState({
    leadName: '',
    leadEmail: '',
    leadPhone: '',
    programId: '',
    address: '',
    address2: '',
    moveInDate: '',
    notes: '',
  });
  const [editForm, setEditForm] = useState({
    leadName: '',
    leadEmail: '',
    leadPhone: '',
    programId: '',
    address: '',
    address2: '',
    moveInDate: '',
    notes: '',
  });

  useEffect(() => {
    if (!authLoading && user) fetchReferrals();
  }, [authLoading, user]);

  useEffect(() => {
    if (programs.length > 0 && !submitForm.programId) {
      const defaultProgram = programs.find((program) => program.isDefault) || programs[0];
      setSubmitForm((current) => ({ ...current, programId: defaultProgram.id }));
    }
  }, [programs, submitForm.programId]);

  const fetchReferrals = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/affiliate/referrals');
      const data = await res.json();
      if (data.success) {
        setReferrals(data.referrals || []);
        setPrograms(data.programs || []);
      }
    } catch (error) {
      console.error('Failed to fetch referrals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    try {
      const res = await fetch('/api/affiliate/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadName: submitForm.leadName,
          leadEmail: submitForm.leadEmail,
          leadPhone: submitForm.leadPhone,
          programId: submitForm.programId || undefined,
          address: submitForm.address,
          address2: submitForm.address2,
          moveInDate: submitForm.moveInDate,
          notes: submitForm.notes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification('success', 'Lead added successfully.');
        setShowSubmitModal(false);
        setSubmitForm({
          leadName: '',
          leadEmail: '',
          leadPhone: '',
          programId: '',
          address: '',
          address2: '',
          moveInDate: '',
          notes: '',
        });
        fetchReferrals();
      } else {
        showNotification('error', data.error || 'Failed to submit lead');
      }
    } catch {
      showNotification('error', 'An error occurred while submitting lead');
    } finally {
      setSubmitLoading(false);
    }
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const getStatusBadge = (status: string) => {
    const map: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType }> = {
      NEW: { variant: 'outline', icon: Clock },
      SOLD: { variant: 'outline', icon: CheckCircle2 },
      COMPLETED: { variant: 'default', icon: CheckCircle2 },
      PENDING: { variant: 'secondary', icon: Clock },
      REJECTED: { variant: 'destructive', icon: Ban },
    };
    const { variant, icon: Icon } = map[status] || { variant: 'outline' as const, icon: Clock };
    return (
      <Badge variant={variant} className="gap-1 text-xs">
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  const normalizeReferralStatus = (status: string) => (status || '').trim().toUpperCase();
  const isClosedReferral = (status: string) => CLOSED_REFERRAL_STATUSES.includes(normalizeReferralStatus(status));
  const isRejectedReferral = (status: string) => normalizeReferralStatus(status) === 'REJECTED';
  const getStatusPriority = (status: string) => STATUS_PRIORITY[normalizeReferralStatus(status)] ?? 5;
  const searchTerm = searchQuery.trim().toLowerCase();
  const matchesSearch = (r: Referral) =>
    !searchTerm ||
    r.leadName.toLowerCase().includes(searchTerm) ||
    r.leadEmail.toLowerCase().includes(searchTerm) ||
    (r.leadPhone || '').toLowerCase().includes(searchTerm) ||
    (r.address || '').toLowerCase().includes(searchTerm);
  const sortedReferrals = [...referrals].sort((a, b) => {
    const statusDiff = getStatusPriority(a.status) - getStatusPriority(b.status);
    if (statusDiff !== 0) {
      return statusDiff;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  const allReferrals = sortedReferrals.filter(matchesSearch);
  const activeReferrals = sortedReferrals
    .filter((r) => !isClosedReferral(r.status) && !isRejectedReferral(r.status))
    .filter(matchesSearch);
  const closedReferrals = sortedReferrals.filter((r) => isClosedReferral(r.status)).filter(matchesSearch);
  const rejectedReferrals = sortedReferrals.filter((r) => isRejectedReferral(r.status)).filter(matchesSearch);
  const filteredReferrals =
    leadTab === 'all'
      ? allReferrals
      : leadTab === 'closed'
        ? closedReferrals
        : leadTab === 'rejected'
          ? rejectedReferrals
          : activeReferrals;

  const stats = {
    total: referrals.length,
    new: referrals.filter((r) => r.status === 'NEW').length,
    pending: referrals.filter((r) => r.status === 'PENDING').length,
    sold: referrals.filter((r) => r.status === 'SOLD').length,
    completed: referrals.filter((r) => r.status === 'COMPLETED').length,
    rejected: referrals.filter((r) => r.status === 'REJECTED').length,
  };

  const openEditLead = (referral: Referral) => {
    setEditingReferral(referral);
    setEditForm({
      leadName: referral.leadName,
      leadEmail: referral.leadEmail,
      leadPhone: referral.leadPhone || '',
      programId: referral.program?.id || '',
      address: referral.address || '',
      address2: referral.address2 || '',
      moveInDate: referral.moveInDate || '',
      notes: referral.notes || '',
    });
    setShowEditModal(true);
  };

  const handleUpdateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReferral) return;

    setEditLoading(true);
    try {
      const res = await fetch('/api/affiliate/referrals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingReferral.id,
          leadName: editForm.leadName,
          leadEmail: editForm.leadEmail,
          leadPhone: editForm.leadPhone,
          programId: editForm.programId || undefined,
          address: editForm.address,
          address2: editForm.address2,
          moveInDate: editForm.moveInDate,
          notes: editForm.notes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification('success', 'Lead updated successfully!');
        setShowEditModal(false);
        setEditingReferral(null);
        await fetchReferrals();
      } else {
        showNotification('error', data.error || 'Failed to update lead');
      }
    } catch {
      showNotification('error', 'An error occurred while updating lead');
    } finally {
      setEditLoading(false);
    }
  };

  const exportCSV = () => {
    const headers = ['Name', 'Email', 'Phone', 'Program', 'Address', 'Unit / Apartment', 'Move-In Date', 'Notes', 'Status', 'Date'];
    const rows = filteredReferrals.map((r) => [
      r.leadName,
      r.leadEmail,
      r.leadPhone || '',
      r.program?.name || '',
      r.address || '',
      r.address2 || '',
      r.moveInDate || '',
      r.notes || '',
      r.status,
      formatDate(r.createdAt),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsvValue).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const escapeCsvValue = (value: string) => {
    const safeValue = /^[=+\-@]/.test(value) ? `'${value}` : value;
    return /[",\r\n]/.test(safeValue) ? `"${safeValue.replace(/"/g, '""')}"` : safeValue;
  };

  if (authLoading || loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {notification && (
        <Alert variant={notification.type === 'error' ? 'destructive' : 'default'}>
          {notification.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <AlertDescription>{notification.message}</AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lead Queue</h1>
          <p className="text-muted-foreground">Search, update, and export the leads you have submitted</p>
        </div>
        <Button onClick={() => setShowSubmitModal(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add Lead
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Sold</p>
            <p className="text-2xl font-bold text-blue-600">{stats.sold}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">New</p>
            <p className="text-2xl font-bold text-slate-600">{stats.new}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Completed</p>
            <p className="text-2xl font-bold text-emerald-600">{stats.completed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Rejected</p>
            <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, email, phone, or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center justify-between gap-3 sm:items-start">
          <Tabs
            value={leadTab}
            onValueChange={(value) => setLeadTab(value as LeadTab)}
            className="w-full md:max-w-3xl"
          >
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all" className="text-xs sm:text-sm">
                All Leads ({allReferrals.length})
              </TabsTrigger>
              <TabsTrigger value="active" className="text-xs sm:text-sm">
                Active ({activeReferrals.length})
              </TabsTrigger>
              <TabsTrigger value="closed" className="text-xs sm:text-sm">
                Closed ({closedReferrals.length})
              </TabsTrigger>
              <TabsTrigger value="rejected" className="text-xs sm:text-sm">
                Rejected ({rejectedReferrals.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" onClick={exportCSV} className="gap-1.5 shrink-0">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {filteredReferrals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="font-medium">No leads found</p>
            <p className="mt-1 text-sm text-muted-foreground">
                {referrals.length === 0 ? 'Add your first resident lead when you are ready' : 'Try adjusting your filters'}
              </p>
              {referrals.length === 0 && (
                <Button className="mt-4" onClick={() => setShowSubmitModal(true)}>Add your first lead</Button>
              )}
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Program</TableHead>
                      <TableHead>Move-In</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReferrals.map((ref) => (
                      <TableRow key={ref.id}>
                        <TableCell className="font-medium">{ref.leadName}</TableCell>
                        <TableCell className="text-muted-foreground">{ref.leadEmail}</TableCell>
                        <TableCell className="text-muted-foreground">{ref.leadPhone || '-'}</TableCell>
                        <TableCell className="text-muted-foreground">{ref.program?.name || '-'}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{ref.moveInDate ? formatDate(ref.moveInDate) : '-'}</TableCell>
                        <TableCell>{getStatusBadge(ref.status)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{formatDate(ref.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          {(ref.status === 'NEW' || ref.status === 'PENDING' || ref.status === 'SOLD') && (
                            <Button variant="ghost" size="sm" onClick={() => openEditLead(ref)}>
                              <Pencil className="mr-1 h-3.5 w-3.5" />
                              Edit
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="divide-y md:hidden">
                {filteredReferrals.map((ref) => (
                  <div key={ref.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{ref.leadName}</p>
                        <p className="truncate text-sm text-muted-foreground">{ref.leadEmail}</p>
                        <p className="text-sm text-muted-foreground">{ref.leadPhone || 'No phone'}</p>
                      </div>
                      {getStatusBadge(ref.status)}
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>{[ref.address, ref.address2].filter(Boolean).join(', ') || 'No address'}</p>
                      <p>{ref.program?.name || 'No lead source'} · Move-in {ref.moveInDate ? formatDate(ref.moveInDate) : 'not set'}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">Submitted {formatDate(ref.createdAt)}</p>
                      {(ref.status === 'NEW' || ref.status === 'PENDING' || ref.status === 'SOLD') && (
                        <Button variant="outline" size="sm" onClick={() => openEditLead(ref)}>
                          <Pencil className="mr-1 h-3.5 w-3.5" />
                          Edit
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add Lead Modal */}
      <Dialog open={showSubmitModal} onOpenChange={setShowSubmitModal}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Add Lead</DialogTitle>
            <DialogDescription>
              Add the details the team needs for quick follow-up.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitLead} className="space-y-4">
            {programs.length > 0 && (
              <div className="space-y-2">
                <Label>Lead Source *</Label>
                <Select
                  value={submitForm.programId}
                  onValueChange={(value) => setSubmitForm({ ...submitForm, programId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select property, business, or location" />
                  </SelectTrigger>
                  <SelectContent>
                    {programs.map((program) => (
                      <SelectItem key={program.id} value={program.id}>
                        {program.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Lead&apos;s Name *</Label>
              <Input
                required
                value={submitForm.leadName}
                onChange={(e) => setSubmitForm({ ...submitForm, leadName: e.target.value })}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-2">
              <Label>Contact Email *</Label>
              <Input
                type="email"
                required
                value={submitForm.leadEmail}
                onChange={(e) => setSubmitForm({ ...submitForm, leadEmail: e.target.value })}
                placeholder="email@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone Number *</Label>
              <Input
                type="tel"
                required
                value={submitForm.leadPhone}
                onChange={(e) => setSubmitForm({ ...submitForm, leadPhone: e.target.value })}
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="space-y-2">
              <Label>Address *</Label>
              <Input
                required
                value={submitForm.address}
                onChange={(e) => setSubmitForm({ ...submitForm, address: e.target.value })}
                placeholder="Street address"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Unit / Apartment</Label>
                <Input
                  value={submitForm.address2}
                  onChange={(e) => setSubmitForm({ ...submitForm, address2: e.target.value })}
                  placeholder="Unit 4B"
                />
              </div>
              <div className="space-y-2">
                <Label>Move-In Date *</Label>
                <Input
                  type="date"
                  required
                  value={submitForm.moveInDate}
                  onChange={(e) => setSubmitForm({ ...submitForm, moveInDate: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Lead Notes</Label>
              <Textarea
                value={submitForm.notes}
                onChange={(e) => setSubmitForm({ ...submitForm, notes: e.target.value })}
                placeholder="Add access instructions, preferences, source details, or anything the team should know."
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowSubmitModal(false)}>Cancel</Button>
              <Button type="submit" disabled={submitLoading}>
                {submitLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Lead
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Lead Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Lead</DialogTitle>
            <DialogDescription>
              Update lead details before the team completes the review.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateLead} className="space-y-4">
            {programs.length > 0 && (
              <div className="space-y-2">
                <Label>Lead Source *</Label>
                <Select
                  value={editForm.programId}
                  onValueChange={(value) => setEditForm({ ...editForm, programId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select property, business, or location" />
                  </SelectTrigger>
                  <SelectContent>
                    {programs.map((program) => (
                      <SelectItem key={program.id} value={program.id}>
                        {program.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Lead&apos;s Name *</Label>
              <Input
                required
                value={editForm.leadName}
                onChange={(e) => setEditForm({ ...editForm, leadName: e.target.value })}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-2">
              <Label>Contact Email *</Label>
              <Input
                type="email"
                required
                value={editForm.leadEmail}
                onChange={(e) => setEditForm({ ...editForm, leadEmail: e.target.value })}
                placeholder="email@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone Number *</Label>
              <Input
                type="tel"
                required
                value={editForm.leadPhone}
                onChange={(e) => setEditForm({ ...editForm, leadPhone: e.target.value })}
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="space-y-2">
              <Label>Address *</Label>
              <Input
                required
                value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                placeholder="Street address"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Unit / Apartment</Label>
                <Input
                  value={editForm.address2}
                  onChange={(e) => setEditForm({ ...editForm, address2: e.target.value })}
                  placeholder="Unit 4B"
                />
              </div>
              <div className="space-y-2">
                <Label>Move-In Date *</Label>
                <Input
                  type="date"
                  required
                  value={editForm.moveInDate}
                  onChange={(e) => setEditForm({ ...editForm, moveInDate: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Lead Notes</Label>
              <Textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="Add access instructions, preferences, source details, or anything the team should know."
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>Cancel</Button>
              <Button type="submit" disabled={editLoading}>
                {editLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
