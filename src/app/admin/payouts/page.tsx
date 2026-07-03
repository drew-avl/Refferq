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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import {
  Wallet,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Download,
  Plus,
  MoreHorizontal,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import { PAYOUT_METHODS, getAllowedPayoutMethod } from '@/lib/payout-methods';

type PayoutStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

interface Payout {
  id: string;
  affiliateId: string;
  affiliateName: string;
  affiliateEmail: string;
  amountCents: number;
  commissionCount: number;
  status: PayoutStatus;
  method: string;
  notes: string | null;
  createdAt: string;
  processedAt: string | null;
}

interface EligiblePayout {
  affiliateId: string;
  affiliateName: string;
  affiliateEmail: string;
  amountCents: number;
  commissionCount: number;
  commissionIds: string[];
  method: string;
}

const payoutStatuses: PayoutStatus[] = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'];

const statusConfig: Record<PayoutStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType }> = {
  PENDING: { label: 'Pending', variant: 'secondary', icon: Clock },
  PROCESSING: { label: 'Processing', variant: 'outline', icon: Loader2 },
  COMPLETED: { label: 'Completed', variant: 'default', icon: CheckCircle2 },
  FAILED: { label: 'Failed', variant: 'destructive', icon: XCircle },
};

const asPayoutStatus = (status: string): PayoutStatus =>
  payoutStatuses.includes(status as PayoutStatus) ? status as PayoutStatus : 'PENDING';

export default function PayoutsPage() {
  const router = useRouter();
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [eligiblePartners, setEligiblePartners] = useState<EligiblePayout[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedAffiliateId, setSelectedAffiliateId] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('PayPal');
  const [payoutNotes, setPayoutNotes] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [editingPayout, setEditingPayout] = useState<Payout | null>(null);
  const [editPayoutStatus, setEditPayoutStatus] = useState<PayoutStatus>('PENDING');
  const [editPayoutMethod, setEditPayoutMethod] = useState('PayPal');
  const [editPayoutNotes, setEditPayoutNotes] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchPayouts();
  }, []);

  const fetchPayouts = async () => {
    try {
      const res = await fetch('/api/admin/payouts');
      const data = await res.json();
      if (data.success) {
        setPayouts(data.payouts || []);
        setEligiblePartners(data.eligiblePartners || []);
        setCurrencySymbol(data.currencySymbol || '$');
      }
    } catch (error) {
      console.error('Failed to fetch payouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const res = await fetch('/api/admin/payouts?format=csv');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payouts-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export payouts:', error);
    }
  };

  const selectedEligible = eligiblePartners.find((partner) => partner.affiliateId === selectedAffiliateId) || null;

  const openCreateDialog = () => {
    const firstEligible = eligiblePartners[0];
    setSelectedAffiliateId(firstEligible?.affiliateId || '');
    setPayoutMethod(getAllowedPayoutMethod(firstEligible?.method));
    setPayoutNotes('');
    setShowCreateDialog(true);
  };

  const handleSelectedPartnerChange = (affiliateId: string) => {
    const partner = eligiblePartners.find((item) => item.affiliateId === affiliateId);
    setSelectedAffiliateId(affiliateId);
    setPayoutMethod(getAllowedPayoutMethod(partner?.method));
  };

  const handleCreatePayout = async () => {
    if (!selectedEligible) return;

    setCreateLoading(true);
    try {
      const res = await fetch('/api/admin/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          affiliateId: selectedEligible.affiliateId,
          commissionIds: selectedEligible.commissionIds,
          method: payoutMethod,
          notes: payoutNotes.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowCreateDialog(false);
        setPayoutNotes('');
        await fetchPayouts();
      } else {
        alert(data.error || 'Failed to create payout');
      }
    } catch (error) {
      console.error('Failed to create payout:', error);
      alert('Failed to create payout');
    } finally {
      setCreateLoading(false);
    }
  };

  const openUpdateDialog = (payout: Payout) => {
    setEditingPayout(payout);
    setEditPayoutStatus(asPayoutStatus(payout.status));
    setEditPayoutMethod(getAllowedPayoutMethod(payout.method));
    setEditPayoutNotes(payout.notes || '');
    setShowUpdateDialog(true);
  };

  const updatePayout = async (
    payout: Payout,
    updates: { status?: PayoutStatus; method?: string; notes?: string }
  ) => {
    setActionLoading(payout.id);
    try {
      const res = await fetch('/api/admin/payouts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: payout.id, ...updates }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchPayouts();
        return true;
      }

      alert(data.error || 'Failed to update payout');
    } catch (error) {
      console.error('Failed to update payout:', error);
      alert('Failed to update payout');
    } finally {
      setActionLoading(null);
    }

    return false;
  };

  const handleSavePayoutUpdates = async () => {
    if (!editingPayout) return;

    const updated = await updatePayout(editingPayout, {
      status: editPayoutStatus,
      method: editPayoutMethod,
      notes: editPayoutNotes.trim(),
    });

    if (updated) {
      setShowUpdateDialog(false);
      setEditingPayout(null);
    }
  };

  const handleDeletePayout = async (payout: Payout) => {
    if (!confirm(`Delete payout for ${payout.affiliateName}? This action cannot be undone.`)) return;

    setActionLoading(payout.id);
    try {
      const res = await fetch(`/api/admin/payouts?id=${payout.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        await fetchPayouts();
      } else {
        alert(data.error || 'Failed to delete payout');
      }
    } catch (error) {
      console.error('Failed to delete payout:', error);
      alert('Failed to delete payout');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <PayoutsSkeleton />;
  }

  const filtered = payouts.filter((p) => statusFilter === 'all' || p.status === statusFilter);

  const stats = {
    total: payouts.length,
    pending: payouts.filter((p) => p.status === 'PENDING').length,
    completed: payouts.filter((p) => p.status === 'COMPLETED').length,
    totalPaid: payouts
      .filter((p) => p.status === 'COMPLETED')
      .reduce((sum, p) => sum + p.amountCents, 0),
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payouts</h1>
        <p className="text-muted-foreground">Manage partner commission payouts</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Payouts</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
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
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
            <span className="text-sm font-bold text-muted-foreground">{currencySymbol}</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currencySymbol}{(stats.totalPaid / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Payout History</CardTitle>
              <CardDescription>All partner payout records</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={openCreateDialog} disabled={eligiblePartners.length === 0}>
                <Plus className="mr-2 h-4 w-4" />
                Create Payout
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="PROCESSING">Processing</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Wallet className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">No payouts found</h3>
              <p className="text-sm text-muted-foreground">Payouts will appear here once processed</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Commissions</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payout Date</TableHead>
                  <TableHead>Processed</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((payout) => {
                  const cfg = statusConfig[payout.status] || statusConfig.PENDING;
                  const StatusIcon = cfg.icon;
                  return (
                    <TableRow key={payout.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{payout.affiliateName}</p>
                          <p className="text-xs text-muted-foreground">{payout.affiliateEmail}</p>
                          {payout.notes && (
                            <p className="max-w-[240px] truncate text-xs text-muted-foreground">{payout.notes}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold">
                          {currencySymbol}{(payout.amountCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{payout.commissionCount}</TableCell>
                      <TableCell className="text-sm">{payout.method || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={cfg.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(payout.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {payout.processedAt
                          ? new Date(payout.processedAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={actionLoading === payout.id}
                            >
                              {actionLoading === payout.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="h-4 w-4" />
                              )}
                              <span className="sr-only">Open payout actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => router.push(`/admin/partners/${payout.affiliateId}`)}>
                              <ExternalLink className="h-4 w-4" />
                              View Partner
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openUpdateDialog(payout)}>
                              <Wallet className="h-4 w-4" />
                              Edit Payout
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {payoutStatuses.map((status) => (
                              <DropdownMenuItem
                                key={status}
                                disabled={payout.status === status}
                                onClick={() => updatePayout(payout, { status })}
                              >
                                {statusConfig[status].label}
                              </DropdownMenuItem>
                            ))}
                            {payout.status !== 'COMPLETED' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => handleDeletePayout(payout)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete Payout
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Payout</DialogTitle>
            <DialogDescription>Generate a payout from approved, unpaid commissions</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Partner</Label>
              <Select value={selectedAffiliateId} onValueChange={handleSelectedPartnerChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select partner" />
                </SelectTrigger>
                <SelectContent>
                  {eligiblePartners.map((partner) => (
                    <SelectItem key={partner.affiliateId} value={partner.affiliateId}>
                      {partner.affiliateName} - {currencySymbol}{(partner.amountCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 rounded-md border bg-muted/40 p-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Amount</p>
                <p className="text-lg font-semibold">
                  {selectedEligible
                    ? `${currencySymbol}${(selectedEligible.amountCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    : `${currencySymbol}0.00`}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Commissions</p>
                <p className="text-lg font-semibold">{selectedEligible?.commissionCount || 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Date</p>
                <p className="text-lg font-semibold">{new Date().toLocaleDateString()}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={payoutMethod} onValueChange={setPayoutMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYOUT_METHODS.map((method) => (
                    <SelectItem key={method} value={method}>{method}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={payoutNotes}
                onChange={(event) => setPayoutNotes(event.target.value)}
                placeholder="Optional payout notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreatePayout} disabled={createLoading || !selectedEligible}>
              {createLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Payout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showUpdateDialog} onOpenChange={(open) => {
        setShowUpdateDialog(open);
        if (!open) setEditingPayout(null);
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Payout</DialogTitle>
            <DialogDescription>Update payout status, payment method, and notes</DialogDescription>
          </DialogHeader>

          {editingPayout && (
            <div className="space-y-4">
              <div className="grid gap-3 rounded-md border bg-muted/40 p-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Amount</p>
                  <p className="text-lg font-semibold">
                    {currencySymbol}{(editingPayout.amountCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Commissions</p>
                  <p className="text-lg font-semibold">{editingPayout.commissionCount}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="text-lg font-semibold">
                    {new Date(editingPayout.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editPayoutStatus} onValueChange={(value) => setEditPayoutStatus(value as PayoutStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">Pending - Awaiting processing</SelectItem>
                    <SelectItem value="PROCESSING">Processing - Payment in progress</SelectItem>
                    <SelectItem value="COMPLETED">Completed - Payment successful</SelectItem>
                    <SelectItem value="FAILED">Failed - Payment failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={editPayoutMethod} onValueChange={setEditPayoutMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYOUT_METHODS.map((method) => (
                      <SelectItem key={method} value={method}>{method}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={editPayoutNotes}
                  onChange={(event) => setEditPayoutNotes(event.target.value)}
                  placeholder="Optional payout notes"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowUpdateDialog(false); setEditingPayout(null); }}>
              Cancel
            </Button>
            <Button onClick={handleSavePayoutUpdates} disabled={!editingPayout || actionLoading === editingPayout.id}>
              {editingPayout && actionLoading === editingPayout.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Payout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PayoutsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-36 mb-1" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-6 w-32 mb-1" />
              <Skeleton className="h-4 w-48" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-32" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
