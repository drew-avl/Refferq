'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  User,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Save,
  Trash2,
  FileText,
  Shield,
  Loader2,
  ShoppingBag,
} from 'lucide-react';

interface Referral {
  id: string;
  leadEmail: string;
  leadName: string;
  leadPhone: string | null;
  address: string;
  address2: string;
  moveInDate: string;
  status: string;
  notes: string | null;
  createdAt: string;
  company: string;
  program: {
    id: string;
    name: string;
    referralPayoutCents: number;
    currency: string;
  } | null;
  referralPayoutCents: number | null;
  statusHistory?: ReferralStatusHistoryItem[];
  affiliate: {
    id: string;
    name: string;
    email: string;
    commissionRate: number;
  };
}

interface ReferralStatusHistoryItem {
  id: string;
  fromStatus: string | null;
  toStatus: string | null;
  reviewNotes: string | null;
  source: string | null;
  actorName: string | null;
  actorEmail: string | null;
  createdAt: string;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType }> = {
  NEW: { label: 'New', variant: 'outline', icon: Clock },
  PENDING: { label: 'Pending', variant: 'secondary', icon: Clock },
  SOLD: { label: 'Sold', variant: 'outline', icon: ShoppingBag },
  COMPLETED: { label: 'Completed', variant: 'default', icon: CheckCircle2 },
  REJECTED: { label: 'Rejected', variant: 'destructive', icon: XCircle },
};

const formatProgramPayout = (cents: number, currency = 'USD') => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch (_error) {
    return `${currency} ${(cents / 100).toLocaleString(undefined, {
      minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })}`;
  }
};

const formatDateTime = (date: string) => {
  const value = new Date(date);
  return {
    date: value.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
    time: value.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
};

const formatStatusLabel = (status: string | null) =>
  status ? statusConfig[status]?.label || status : 'Unknown';

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [referral, setReferral] = useState<Referral | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Editable fields
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editAddress2, setEditAddress2] = useState('');
  const [editMoveInDate, setEditMoveInDate] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');

  useEffect(() => {
    fetchReferral();
  }, [id]);

  const fetchReferral = async () => {
    try {
      const res = await fetch('/api/admin/referrals');
      const data = await res.json();
      if (data.success) {
        const found = data.referrals.find((r: Referral) => r.id === id);
        if (found) {
          setReferral(found);
          setEditName(found.leadName);
          setEditEmail(found.leadEmail);
          setEditPhone(found.leadPhone || '');
          setEditAddress(found.address || '');
          setEditAddress2(found.address2 || '');
          setEditMoveInDate(found.moveInDate || '');
        }
      }
    } catch (error) {
      console.error('Failed to fetch referral:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/referrals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadName: editName,
          leadEmail: editEmail,
          leadPhone: editPhone,
          address: editAddress,
          address2: editAddress2,
          moveInDate: editMoveInDate,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        await fetchReferral();
      }
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (action: 'pending' | 'sell' | 'complete' | 'reject') => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/referrals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reviewNotes: reviewNotes || undefined }),
      });
      if (res.ok) {
        await fetchReferral();
        setReviewNotes('');
      }
    } catch (error) {
      console.error('Failed to process action:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/referrals/${id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/admin/customers');
      }
    } catch (error) {
      console.error('Failed to delete:', error);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-[400px] md:col-span-2" />
          <Skeleton className="h-[400px]" />
        </div>
      </div>
    );
  }

  if (!referral) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.push('/admin/customers')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Leads
        </Button>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <User className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">Lead not found</h3>
          <p className="text-sm text-muted-foreground">This referral lead may have been deleted</p>
        </div>
      </div>
    );
  }

  const cfg = statusConfig[referral.status] || statusConfig.PENDING;
  const StatusIcon = cfg.icon;
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/admin/customers')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 text-lg">
                {referral.leadName?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{referral.leadName}</h1>
              <p className="text-sm text-muted-foreground">{referral.leadEmail}</p>
            </div>
          </div>
          <Badge variant={cfg.variant} className="ml-2">
            <StatusIcon className="mr-1 h-3 w-3" />
            {cfg.label}
          </Badge>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this referral lead?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete <strong>{referral.leadName}</strong> and all associated
                conversions and commissions. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column - Details & Edit */}
        <div className="space-y-6 md:col-span-2">
          {/* Lead Details Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Lead Details
                  </CardTitle>
                  <CardDescription>View and edit lead information</CardDescription>
                </div>
                <Button onClick={handleSave} disabled={saving} size="sm">
                  {saved ? (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                      Saved
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      {saving ? 'Saving...' : 'Save'}
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="leadName">Full Name</Label>
                  <Input
                    id="leadName"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="leadEmail">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="leadEmail"
                      type="email"
                      className="pl-9"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Phone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Company</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9" value={referral.company || '—'} readOnly disabled />
                  </div>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="address2">Unit / Apartment</Label>
                  <Input
                    id="address2"
                    value={editAddress2}
                    onChange={(e) => setEditAddress2(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="moveInDate">Move-In Date</Label>
                <Input
                  id="moveInDate"
                  type="date"
                  value={editMoveInDate}
                  onChange={(e) => setEditMoveInDate(e.target.value)}
                />
              </div>
              {referral.notes && (
                <div className="grid gap-2">
                  <Label>Notes</Label>
                  <div className="rounded-md border bg-muted/50 p-3 text-sm">{referral.notes}</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Review Actions Card */}
          {(referral.status === 'NEW' || referral.status === 'PENDING' || referral.status === 'SOLD' || referral.status === 'COMPLETED') && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  {referral.status === 'COMPLETED'
                    ? 'Adjust Completed Lead'
                    : referral.status === 'SOLD'
                    ? 'Confirm Installation'
                    : referral.status === 'NEW'
                      ? 'Start Review'
                      : 'Review Lead'}
                </CardTitle>
                <CardDescription>
                  {referral.status === 'COMPLETED'
                    ? 'Use this only when a completed lead needs to be reversed because of a chargeback, cancellation, or invalid install.'
                    : referral.status === 'SOLD'
                    ? 'Mark completed only after service is installed. Completed referrals are eligible for payout.'
                    : referral.status === 'NEW'
                      ? 'Move this lead to pending when review starts, or reject it if it is not viable.'
                      : 'Mark this lead sold or reject it after review.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="reviewNotes">Review Notes (optional)</Label>
                  <Textarea
                    id="reviewNotes"
                    placeholder="Add notes about this review decision..."
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  {referral.status === 'NEW' && (
                    <>
                      <Button
                        onClick={() => handleAction('pending')}
                        disabled={actionLoading}
                      >
                        {actionLoading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Clock className="mr-2 h-4 w-4" />
                        )}
                        Move to Pending
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => handleAction('reject')}
                        disabled={actionLoading}
                      >
                        {actionLoading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <XCircle className="mr-2 h-4 w-4" />
                        )}
                        Reject Lead
                      </Button>
                    </>
                  )}
                  {referral.status === 'PENDING' && (
                    <>
                      <Button
                        onClick={() => handleAction('sell')}
                        disabled={actionLoading}
                      >
                        {actionLoading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <ShoppingBag className="mr-2 h-4 w-4" />
                        )}
                        Mark Sold
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => handleAction('reject')}
                        disabled={actionLoading}
                      >
                        {actionLoading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <XCircle className="mr-2 h-4 w-4" />
                        )}
                        Reject Lead
                      </Button>
                    </>
                  )}
                  {referral.status === 'SOLD' && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => handleAction('pending')}
                        disabled={actionLoading}
                      >
                        {actionLoading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Clock className="mr-2 h-4 w-4" />
                        )}
                        Move Back to Pending
                      </Button>
                      <Button
                        onClick={() => handleAction('complete')}
                        disabled={actionLoading}
                      >
                        {actionLoading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                        )}
                        Mark Completed
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => handleAction('reject')}
                        disabled={actionLoading}
                      >
                        {actionLoading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <XCircle className="mr-2 h-4 w-4" />
                        )}
                        Reject Lead
                      </Button>
                    </>
                  )}
                  {referral.status === 'COMPLETED' && (
                    <Button
                      variant="destructive"
                      onClick={() => handleAction('reject')}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="mr-2 h-4 w-4" />
                      )}
                      Reject / Chargeback
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Sidebar Info */}
        <div className="space-y-6">
          {/* Partner Terms Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Partner Terms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Lead Source</span>
                <span className="font-semibold text-right">{referral.program?.name || 'Not selected'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Referral Payout</span>
                <span className="font-semibold">
                  {referral.referralPayoutCents !== null
                    ? formatProgramPayout(referral.referralPayoutCents, referral.program?.currency)
                    : 'Not set'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Referring Partner Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4" />
                Referring Partner
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                    {referral.affiliate.name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{referral.affiliate.name}</p>
                  <p className="text-xs text-muted-foreground">{referral.affiliate.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Timeline
              </CardTitle>
              <CardDescription>Status changes are recorded from the audit log.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-full bg-blue-100 p-1">
                    <FileText className="h-3 w-3 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Lead Submitted</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(referral.createdAt).date} at {formatDateTime(referral.createdAt).time}
                    </p>
                  </div>
                </div>
                {(referral.statusHistory || []).length > 0 ? (
                  referral.statusHistory!.map((event) => {
                    const eventStatus = event.toStatus || 'PENDING';
                    const eventConfig = statusConfig[eventStatus] || statusConfig.PENDING;
                    const EventIcon = eventConfig.icon;
                    const eventDate = formatDateTime(event.createdAt);
                    return (
                      <div key={event.id} className="flex items-start gap-3">
                        <div className={`mt-0.5 rounded-full p-1 ${
                          eventStatus === 'COMPLETED'
                            ? 'bg-green-100'
                            : eventStatus === 'SOLD'
                              ? 'bg-blue-100'
                              : eventStatus === 'REJECTED'
                                ? 'bg-red-100'
                                : eventStatus === 'NEW'
                                  ? 'bg-slate-100'
                                  : 'bg-yellow-100'
                        }`}>
                          <EventIcon className={`h-3 w-3 ${
                            eventStatus === 'COMPLETED'
                              ? 'text-green-600'
                              : eventStatus === 'SOLD'
                                ? 'text-blue-600'
                                : eventStatus === 'REJECTED'
                                  ? 'text-red-600'
                                  : eventStatus === 'NEW'
                                    ? 'text-slate-600'
                                    : 'text-yellow-600'
                          }`} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {formatStatusLabel(event.fromStatus)}{' -> '}{formatStatusLabel(event.toStatus)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {eventDate.date} at {eventDate.time}
                            {event.actorName ? ` by ${event.actorName}` : ''}
                          </p>
                          {event.reviewNotes && (
                            <p className="mt-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                              {event.reviewNotes}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-md border border-dashed p-3">
                    <p className="text-xs text-muted-foreground">
                      No status changes have been recorded in the audit log yet. Future status changes will appear here in order.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
