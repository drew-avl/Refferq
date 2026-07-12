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
  customerType: 'RESIDENTIAL' | 'BUSINESS';
  businessName?: string | null;
  leadName: string;
  leadEmail: string;
  leadPhone: string | null;
  address: string;
  address2: string;
  moveInDate: string;
  desiredInstallDate: string;
  requestedServices: string[];
  orderConsent: boolean;
  marketingSmsConsent: boolean;
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

type LeadTab = 'new' | 'pending' | 'sold' | 'completed' | 'rejected' | 'all';
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
  const [leadTab, setLeadTab] = useState<LeadTab>('new');
  const [submitForm, setSubmitForm] = useState({
    customerType: 'RESIDENTIAL' as 'RESIDENTIAL' | 'BUSINESS',
    businessName: '',
    leadName: '',
    leadEmail: '',
    leadPhone: '',
    programId: '',
    address: '',
    address2: '',
    moveInDate: '',
    desiredInstallDate: '',
    requestedServices: [] as string[],
    orderConsent: false,
    marketingSmsConsent: false,
    notes: '',
  });
  const [editForm, setEditForm] = useState({
    customerType: 'RESIDENTIAL' as 'RESIDENTIAL' | 'BUSINESS',
    businessName: '',
    leadName: '',
    leadEmail: '',
    leadPhone: '',
    programId: '',
    address: '',
    address2: '',
    moveInDate: '',
    desiredInstallDate: '',
    requestedServices: [] as string[],
    orderConsent: false,
    marketingSmsConsent: false,
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
          customerType: submitForm.customerType,
          businessName: submitForm.businessName,
          leadName: submitForm.leadName,
          leadEmail: submitForm.leadEmail,
          leadPhone: submitForm.leadPhone,
          programId: submitForm.programId || undefined,
          address: submitForm.address,
          address2: submitForm.address2,
          moveInDate: submitForm.moveInDate,
          desiredInstallDate: submitForm.desiredInstallDate,
          requestedServices: submitForm.requestedServices,
          orderConsent: submitForm.orderConsent,
          marketingSmsConsent: submitForm.marketingSmsConsent,
          notes: submitForm.notes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification('success', 'Lead added successfully.');
        setShowSubmitModal(false);
        setSubmitForm({
          customerType: 'RESIDENTIAL',
          businessName: '',
          leadName: '',
          leadEmail: '',
          leadPhone: '',
          programId: '',
          address: '',
          address2: '',
          moveInDate: '',
          desiredInstallDate: '',
          requestedServices: [],
          orderConsent: false,
          marketingSmsConsent: false,
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
  const newReferrals = allReferrals.filter((r) => normalizeReferralStatus(r.status) === 'NEW');
  const pendingReferrals = allReferrals.filter((r) => normalizeReferralStatus(r.status) === 'PENDING');
  const soldReferrals = allReferrals.filter((r) => normalizeReferralStatus(r.status) === 'SOLD');
  const completedReferrals = allReferrals.filter((r) => normalizeReferralStatus(r.status) === 'COMPLETED');
  const rejectedReferrals = allReferrals.filter((r) => normalizeReferralStatus(r.status) === 'REJECTED');
  const filteredReferrals = {
    new: newReferrals,
    pending: pendingReferrals,
    sold: soldReferrals,
    completed: completedReferrals,
    rejected: rejectedReferrals,
    all: allReferrals,
  }[leadTab];

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
      customerType: referral.customerType || 'RESIDENTIAL',
      businessName: referral.businessName || referral.company || '',
      leadName: referral.leadName,
      leadEmail: referral.leadEmail,
      leadPhone: referral.leadPhone || '',
      programId: referral.program?.id || '',
      address: referral.address || '',
      address2: referral.address2 || '',
      moveInDate: referral.moveInDate || '',
      desiredInstallDate: referral.desiredInstallDate || '',
      requestedServices: referral.requestedServices || [],
      orderConsent: referral.orderConsent || false,
      marketingSmsConsent: referral.marketingSmsConsent || false,
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
          customerType: editForm.customerType,
          businessName: editForm.businessName,
          id: editingReferral.id,
          leadName: editForm.leadName,
          leadEmail: editForm.leadEmail,
          leadPhone: editForm.leadPhone,
          programId: editForm.programId || undefined,
          address: editForm.address,
          address2: editForm.address2,
          moveInDate: editForm.moveInDate,
          desiredInstallDate: editForm.desiredInstallDate,
          requestedServices: editForm.requestedServices,
          orderConsent: editForm.orderConsent,
          marketingSmsConsent: editForm.marketingSmsConsent,
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
    const headers = ['Customer Type', 'Business', 'Name', 'Email', 'Phone', 'Program', 'Address', 'Unit / Apartment', 'Move-In Date', 'Desired Install Date', 'Requested Services', 'Notes', 'Status', 'Date'];
    const rows = filteredReferrals.map((r) => [
      r.customerType,
      r.businessName || '',
      r.leadName,
      r.leadEmail,
      r.leadPhone || '',
      r.program?.name || '',
      r.address || '',
      r.address2 || '',
      r.moveInDate || '',
      r.desiredInstallDate || '',
      (r.requestedServices || []).join('; '),
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
            <p className="text-sm text-muted-foreground">New</p>
            <p className="text-2xl font-bold text-slate-600">{stats.new}</p>
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
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
              <TabsTrigger value="new" className="text-xs sm:text-sm">
                New ({newReferrals.length})
              </TabsTrigger>
              <TabsTrigger value="pending" className="text-xs sm:text-sm">
                Pending ({pendingReferrals.length})
              </TabsTrigger>
              <TabsTrigger value="sold" className="text-xs sm:text-sm">
                Sold ({soldReferrals.length})
              </TabsTrigger>
              <TabsTrigger value="completed" className="text-xs sm:text-sm">
                Completed ({completedReferrals.length})
              </TabsTrigger>
              <TabsTrigger value="rejected" className="text-xs sm:text-sm">
                Rejected ({rejectedReferrals.length})
              </TabsTrigger>
              <TabsTrigger value="all" className="text-xs sm:text-sm">
                All Leads ({allReferrals.length})
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
            <div className="space-y-2">
              <Label>Customer Type *</Label>
              <Select
                value={submitForm.customerType}
                onValueChange={(value: 'RESIDENTIAL' | 'BUSINESS') => setSubmitForm({ ...submitForm, customerType: value })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="RESIDENTIAL">Residential</SelectItem>
                  <SelectItem value="BUSINESS">Business</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
            {submitForm.customerType === 'BUSINESS' && (
              <div className="space-y-2">
                <Label>Business Name *</Label>
                <Input required value={submitForm.businessName} onChange={(e) => setSubmitForm({ ...submitForm, businessName: e.target.value })} />
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
              <Label>Contact Email</Label>
              <Input
                type="email"
                value={submitForm.leadEmail}
                onChange={(e) => setSubmitForm({ ...submitForm, leadEmail: e.target.value })}
                placeholder="email@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input
                type="tel"
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
                <Label>{submitForm.customerType === 'BUSINESS' ? 'Desired Install Date' : 'Move-In Date'}</Label>
                <Input
                  type="date"
                  value={submitForm.customerType === 'BUSINESS' ? submitForm.desiredInstallDate : submitForm.moveInDate}
                  onChange={(e) => setSubmitForm(submitForm.customerType === 'BUSINESS'
                    ? { ...submitForm, desiredInstallDate: e.target.value }
                    : { ...submitForm, moveInDate: e.target.value })}
                />
              </div>
            </div>
            {submitForm.customerType === 'BUSINESS' && (
              <div className="space-y-2">
                <Label>Requested Services</Label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    ['PRIMARY_INTERNET', 'Primary internet'],
                    ['BACKUP_INTERNET', 'Backup internet'],
                    ['VOICE', 'Voice'],
                  ].map(([value, label]) => (
                    <label key={value} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                      <input
                        type="checkbox"
                        checked={submitForm.requestedServices.includes(value)}
                        onChange={(event) => setSubmitForm({
                          ...submitForm,
                          requestedServices: event.target.checked
                            ? [...submitForm.requestedServices, value]
                            : submitForm.requestedServices.filter((item) => item !== value),
                        })}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-2 rounded-md border p-3">
              <Label>Consent</Label>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={submitForm.orderConsent} onChange={(e) => setSubmitForm({ ...submitForm, orderConsent: e.target.checked })} />
                Customer consented to order-related contact.
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={submitForm.marketingSmsConsent} onChange={(e) => setSubmitForm({ ...submitForm, marketingSmsConsent: e.target.checked })} />
                Customer consented to marketing SMS messages.
              </label>
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
            <div className="space-y-2">
              <Label>Customer Type *</Label>
              <Select value={editForm.customerType} onValueChange={(value: 'RESIDENTIAL' | 'BUSINESS') => setEditForm({ ...editForm, customerType: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="RESIDENTIAL">Residential</SelectItem>
                  <SelectItem value="BUSINESS">Business</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
            {editForm.customerType === 'BUSINESS' && (
              <div className="space-y-2">
                <Label>Business Name *</Label>
                <Input required value={editForm.businessName} onChange={(e) => setEditForm({ ...editForm, businessName: e.target.value })} />
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
              <Label>Contact Email</Label>
              <Input
                type="email"
                value={editForm.leadEmail}
                onChange={(e) => setEditForm({ ...editForm, leadEmail: e.target.value })}
                placeholder="email@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input
                type="tel"
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
                <Label>{editForm.customerType === 'BUSINESS' ? 'Desired Install Date' : 'Move-In Date'}</Label>
                <Input
                  type="date"
                  value={editForm.customerType === 'BUSINESS' ? editForm.desiredInstallDate : editForm.moveInDate}
                  onChange={(e) => setEditForm(editForm.customerType === 'BUSINESS'
                    ? { ...editForm, desiredInstallDate: e.target.value }
                    : { ...editForm, moveInDate: e.target.value })}
                />
              </div>
            </div>
            {editForm.customerType === 'BUSINESS' && (
              <div className="space-y-2">
                <Label>Requested Services</Label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    ['PRIMARY_INTERNET', 'Primary internet'],
                    ['BACKUP_INTERNET', 'Backup internet'],
                    ['VOICE', 'Voice'],
                  ].map(([value, label]) => (
                    <label key={value} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                      <input
                        type="checkbox"
                        checked={editForm.requestedServices.includes(value)}
                        onChange={(event) => setEditForm({
                          ...editForm,
                          requestedServices: event.target.checked
                            ? [...editForm.requestedServices, value]
                            : editForm.requestedServices.filter((item) => item !== value),
                        })}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-2 rounded-md border p-3">
              <Label>Consent</Label>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={editForm.orderConsent} onChange={(e) => setEditForm({ ...editForm, orderConsent: e.target.checked })} />
                Customer consented to order-related contact.
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={editForm.marketingSmsConsent} onChange={(e) => setEditForm({ ...editForm, marketingSmsConsent: e.target.checked })} />
                Customer consented to marketing SMS messages.
              </label>
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
