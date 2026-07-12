'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Search,
  UserCheck,
  Clock,
  CheckCircle2,
  XCircle,
  Building2,
  Mail,
  Phone,
  Eye,
  ShoppingBag,
} from 'lucide-react';

interface Referral {
  id: string;
  customerType: 'RESIDENTIAL' | 'BUSINESS';
  businessName: string | null;
  leadEmail: string;
  leadName: string;
  leadPhone: string | null;
  address: string;
  address2: string;
  moveInDate: string;
  desiredInstallDate: string;
  requestedServices: string[];
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
  affiliate: {
    id: string;
    name: string;
    email: string;
    commissionRate: number;
  };
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  NEW: { label: 'New', variant: 'outline' },
  PENDING: { label: 'Pending', variant: 'secondary' },
  SOLD: { label: 'Sold', variant: 'outline' },
  COMPLETED: { label: 'Completed', variant: 'default' },
  REJECTED: { label: 'Rejected', variant: 'destructive' },
};

type LeadTab = 'new' | 'pending' | 'sold' | 'completed' | 'rejected' | 'all';
const STATUS_PRIORITY: Record<string, number> = {
  NEW: 0,
  PENDING: 1,
  SOLD: 2,
  COMPLETED: 3,
  REJECTED: 4,
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

export default function CustomersPage() {
  const router = useRouter();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [leadTab, setLeadTab] = useState<LeadTab>('new');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchReferrals();
  }, []);

  const fetchReferrals = async () => {
    try {
      const res = await fetch('/api/admin/referrals');
      const data = await res.json();
      if (data.success) {
        setReferrals(data.referrals);
      }
    } catch (error) {
      console.error('Failed to fetch referrals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (referralIds: string[], action: 'pending' | 'sell' | 'complete' | 'reject') => {
    setActionLoading(referralIds[0]);
    try {
      const res = await fetch('/api/admin/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referralIds, action }),
      });
      const data = await res.json();
      if (data.success) {
        fetchReferrals();
      }
    } catch (error) {
      console.error('Action failed:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const normalizeReferralStatus = (status: string) => (status || '').trim().toUpperCase();
  const getStatusPriority = (status: string) => STATUS_PRIORITY[normalizeReferralStatus(status)] ?? 5;
  const searchTerm = searchQuery.trim().toLowerCase();
  const matchesSearch = (r: Referral) =>
    !searchTerm ||
    r.leadName.toLowerCase().includes(searchTerm) ||
    r.leadEmail.toLowerCase().includes(searchTerm) ||
    (r.leadPhone || '').toLowerCase().includes(searchTerm) ||
    r.address.toLowerCase().includes(searchTerm) ||
    r.company.toLowerCase().includes(searchTerm) ||
    (r.businessName || '').toLowerCase().includes(searchTerm);
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
  const filtered = {
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

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
        <p className="text-muted-foreground">Review new referrals and move qualified leads through the queue</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">New</CardTitle>
            <Clock className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.new}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Sold</CardTitle>
            <ShoppingBag className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.sold}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.rejected}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="space-y-3">
            <div>
              <CardTitle>Lead Review Queue</CardTitle>
              <CardDescription>Review referral leads from leasing teams, businesses, and field partners</CardDescription>
            </div>
            <div className="flex flex-col gap-3">
              <div className="relative w-full">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search name, contact, address, or source..."
                  className="w-full pl-8 sm:w-72"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Tabs
                value={leadTab}
                onValueChange={(value) => setLeadTab(value as LeadTab)}
                className="w-full"
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
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <UserCheck className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">No leads found</h3>
              <p className="text-sm text-muted-foreground">Leads submitted by your partners will appear here</p>
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Referred By</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((referral) => (
                      <TableRow key={referral.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs bg-primary/10">
                                {referral.leadName?.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">{referral.leadName}</p>
                              <Badge variant="outline" className="mt-1 text-[10px]">{referral.customerType === 'BUSINESS' ? 'Business' : 'Residential'}</Badge>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                {referral.leadEmail}
                              </div>
                              {referral.leadPhone && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Phone className="h-3 w-3" />
                                  {referral.leadPhone}
                                </div>
                              )}
                              <div className="text-xs text-muted-foreground">
                                {[referral.address, referral.address2].filter(Boolean).join(', ') || 'No address'}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {referral.customerType === 'BUSINESS' ? 'Desired install' : 'Move-in'}: {(referral.customerType === 'BUSINESS' ? referral.desiredInstallDate : referral.moveInDate) ? new Date(referral.customerType === 'BUSINESS' ? referral.desiredInstallDate : referral.moveInDate).toLocaleDateString() : 'not set'}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {referral.businessName || referral.company ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                              {referral.businessName || referral.company}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {referral.program ? (
                            <div className="text-sm">
                              <p className="font-medium">{referral.program.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatProgramPayout(referral.referralPayoutCents || 0, referral.program.currency)} payout
                              </p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">No source</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p className="font-medium">{referral.affiliate.name}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusConfig[referral.status]?.variant || 'outline'}>
                            {statusConfig[referral.status]?.label || referral.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(referral.createdAt).toLocaleDateString('en-US', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          <LeadActions
                            referral={referral}
                            actionLoading={actionLoading}
                            onView={() => router.push(`/admin/customers/${referral.id}`)}
                            onAction={handleAction}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="divide-y md:hidden">
                {filtered.map((referral) => (
                  <div key={referral.id} className="space-y-4 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{referral.leadName}</p>
                        <p className="truncate text-sm text-muted-foreground">{referral.leadEmail}</p>
                        <p className="text-sm text-muted-foreground">{referral.leadPhone || 'No phone'}</p>
                      </div>
                      <Badge variant={statusConfig[referral.status]?.variant || 'outline'}>
                        {statusConfig[referral.status]?.label || referral.status}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>{[referral.address, referral.address2].filter(Boolean).join(', ') || 'No address'}</p>
                      <p>{referral.customerType === 'BUSINESS' ? 'Desired install' : 'Move-in'}: {(referral.customerType === 'BUSINESS' ? referral.desiredInstallDate : referral.moveInDate) ? new Date(referral.customerType === 'BUSINESS' ? referral.desiredInstallDate : referral.moveInDate).toLocaleDateString() : 'not set'}</p>
                      <p>Source: {referral.program?.name || referral.company || 'No source'}</p>
                      <p>Referred by {referral.affiliate.name}</p>
                    </div>
                    <LeadActions
                      referral={referral}
                      actionLoading={actionLoading}
                      onView={() => router.push(`/admin/customers/${referral.id}`)}
                      onAction={handleAction}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LeadActions({
  referral,
  actionLoading,
  onView,
  onAction,
}: {
  referral: Referral;
  actionLoading: string | null;
  onView: () => void;
  onAction: (referralIds: string[], action: 'pending' | 'sell' | 'complete' | 'reject') => void;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-1">
      <Button size="sm" variant="ghost" onClick={onView}>
        <Eye className="mr-1 h-3.5 w-3.5" />
        View
      </Button>
      {referral.status === 'NEW' && (
        <>
          <Button
            size="sm"
            variant="default"
            onClick={(e) => { e.stopPropagation(); onAction([referral.id], 'pending'); }}
            disabled={actionLoading === referral.id}
          >
            <Clock className="mr-1 h-3.5 w-3.5" />
            Pending
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={(e) => { e.stopPropagation(); onAction([referral.id], 'reject'); }}
            disabled={actionLoading === referral.id}
          >
            <XCircle className="mr-1 h-3.5 w-3.5" />
            Reject
          </Button>
        </>
      )}
      {referral.status === 'PENDING' && (
        <>
          <Button
            size="sm"
            variant="default"
            onClick={(e) => { e.stopPropagation(); onAction([referral.id], 'sell'); }}
            disabled={actionLoading === referral.id}
          >
            <ShoppingBag className="mr-1 h-3.5 w-3.5" />
            Sold
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={(e) => { e.stopPropagation(); onAction([referral.id], 'reject'); }}
            disabled={actionLoading === referral.id}
          >
            <XCircle className="mr-1 h-3.5 w-3.5" />
            Reject
          </Button>
        </>
      )}
      {referral.status === 'SOLD' && (
        <>
          <Button
            size="sm"
            variant="default"
            onClick={(e) => { e.stopPropagation(); onAction([referral.id], 'complete'); }}
            disabled={actionLoading === referral.id}
          >
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
            Completed
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={(e) => { e.stopPropagation(); onAction([referral.id], 'reject'); }}
            disabled={actionLoading === referral.id}
          >
            <XCircle className="mr-1 h-3.5 w-3.5" />
            Reject
          </Button>
        </>
      )}
    </div>
  );
}
