'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Target,
  Users,
  Plus,
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Ban,
  TrendingUp,
  ArrowRight,
  Banknote,
  ShoppingBag,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface AffiliateStats {
  totalEarnings: number;
  pendingEarnings: number;
  totalSold: number;
  totalLeads: number;
  totalReferredCustomers: number;
  totalConversions: number;
  conversionRate: number;
  currencySymbol: string;
  nextMaturesAt: string | null;
}

interface Program {
  id: string;
  name: string;
  referralPayoutCents: number;
  currency: string;
  isDefault: boolean;
}

interface Referral {
  id: string;
  leadName: string;
  leadEmail: string;
  leadPhone: string | null;
  address: string;
  address2: string;
  moveInDate: string;
  company?: string;
  program?: Program | null;
  notes?: string | null;
  status: string;
  createdAt: string;
}

export default function AffiliateDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Referral form state
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
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

  useEffect(() => {
    if (!authLoading && user) {
      loadDashboardData();
    }
  }, [authLoading, user]);

  useEffect(() => {
    if (programs.length > 0 && !submitForm.programId) {
      const defaultProgram = programs.find((program) => program.isDefault) || programs[0];
      setSubmitForm((current) => ({ ...current, programId: defaultProgram.id }));
    }
  }, [programs, submitForm.programId]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/affiliate/profile');
      const data = await response.json();

      if (data.success) {
        setStats({
          totalEarnings: data.stats?.totalEarnings || 0,
          pendingEarnings: data.stats?.pendingEarnings || 0,
          totalSold: data.stats?.totalSold || 0,
          totalLeads: data.referrals?.length || 0,
          totalReferredCustomers: data.referrals?.filter((r: any) => r.status === 'COMPLETED').length || 0,
          totalConversions: data.stats?.totalConversions || 0,
          conversionRate: data.stats?.conversionRate || 0,
          currencySymbol: data.currencySymbol || '$',
          nextMaturesAt: data.stats?.nextMaturesAt || null,
        });
        setReferrals(data.referrals || []);
        setPrograms(data.programs || []);
        setCurrencySymbol(data.currencySymbol || '$');
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);

    try {
      const response = await fetch('/api/affiliate/referrals', {
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

      const data = await response.json();

      if (data.success) {
        showNotification('success', 'Lead submitted successfully! Waiting for admin review.');
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
        loadDashboardData();
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
    new Date(date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });

  const formatCurrency = (cents: number) =>
    `${currencySymbol}${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const getStatusBadge = (status: string) => {
    const map: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType }> = {
      COMPLETED: { variant: 'default', icon: CheckCircle2 },
      PAID: { variant: 'default', icon: CheckCircle2 },
      SOLD: { variant: 'outline', icon: ShoppingBag },
      PENDING: { variant: 'secondary', icon: Clock },
      PROCESSING: { variant: 'secondary', icon: Loader2 },
      REJECTED: { variant: 'destructive', icon: Ban },
      FAILED: { variant: 'destructive', icon: AlertCircle },
    };
    const { variant, icon: Icon } = map[status] || { variant: 'outline' as const, icon: Clock };
    return (
      <Badge variant={variant} className="gap-1 text-xs">
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  if (authLoading || loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Notification */}
      {notification && (
        <Alert variant={notification.type === 'error' ? 'destructive' : 'default'}>
          {notification.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertDescription>{notification.message}</AlertDescription>
        </Alert>
      )}

      {/* Commission Banner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 text-white border-0 shadow-lg overflow-hidden relative group">
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl -translate-x-full group-hover:translate-x-full" />
          <CardContent className="flex items-center justify-between p-6 relative z-10">
            <div className="flex items-center gap-5">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md shadow-inner">
                <span className="text-2xl font-bold">{currencySymbol}</span>
              </div>
              <div>
                <p className="text-sm text-white/90 font-medium tracking-wide">Submit qualified leads by property program</p>
                <p className="text-xl font-bold mt-1 tracking-tight">Payouts unlock after service is installed and marked completed.</p>
              </div>
            </div>
            <Button variant="secondary" onClick={() => setShowSubmitModal(true)} className="gap-2 hidden sm:flex bg-white text-emerald-700 hover:bg-emerald-50 border-0 shadow-md transform transition hover:scale-105 active:scale-95">
              <Plus className="h-4 w-4" />
              Submit Lead
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
        {[
          {
            label: 'Available Balance',
            value: formatCurrency(stats?.totalEarnings || 0),
            icon: Banknote,
            color: 'text-emerald-600',
            bg: 'bg-emerald-500/10',
            description: 'Ready for payout'
          },
          {
            label: 'Pending Balance',
            value: formatCurrency(stats?.pendingEarnings || 0),
            icon: Clock,
            color: 'text-amber-600',
            bg: 'bg-amber-500/10',
            description: stats?.nextMaturesAt
              ? `Next maturity: ${new Date(stats.nextMaturesAt).toLocaleDateString()}`
              : 'Held for refund period'
          },
          { label: 'Total Sold', value: stats?.totalSold || 0, icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-500/10' },
          { label: 'Total Leads', value: stats?.totalLeads || 0, icon: Target, color: 'text-rose-600', bg: 'bg-rose-500/10' },
          { label: 'Conv. Rate', value: `${stats?.conversionRate?.toFixed(1) || '0.0'}%`, icon: TrendingUp, color: 'text-violet-600', bg: 'bg-violet-500/10' },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.1 }}
            whileHover={{ y: -5 }}
          >
            <Card className="border bg-card shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${stat.bg} backdrop-blur-sm transition-transform group-hover:scale-110`}>
                    {stat.icon === Banknote ? (
                      <span className={`text-lg font-bold ${stat.color}`}>{currencySymbol}</span>
                    ) : (
                      <stat.icon className={`h-5 w-5 ${stat.color}`} />
                    )}
                  </div>
                  <div>
                    <p className={`text-2xl font-bold ${stat.color}`}>
                      {stat.value}
                    </p>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{stat.label}</p>
                    {stat.description && (
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5 italic">{stat.description}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Recent Referrals */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Recent Referrals</CardTitle>
            <CardDescription>Latest 5 referrals</CardDescription>
          </div>
          {referrals.length > 5 && (
            <Button variant="ghost" size="sm" asChild>
              <a href="/affiliate/referrals" className="gap-1">
                View All <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {referrals.length === 0 ? (
            <EmptyState icon={Users} message="No referrals yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Move-In</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referrals.slice(0, 5).map((ref) => (
                  <TableRow key={ref.id}>
                    <TableCell className="font-medium">{ref.leadName}</TableCell>
                    <TableCell className="text-muted-foreground">{ref.leadEmail}</TableCell>
                    <TableCell className="text-muted-foreground">{ref.leadPhone || '-'}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {ref.moveInDate ? formatDate(ref.moveInDate) : '-'}
                    </TableCell>
                    <TableCell>{getStatusBadge(ref.status)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{formatDate(ref.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => window.location.href = '/affiliate/referrals'}>
          <CardContent className="p-5 flex items-center gap-3">
            <Users className="h-5 w-5 text-blue-600" />
            <div>
              <p className="font-medium">Manage Referrals</p>
              <p className="text-xs text-muted-foreground">View all your submissions</p>
            </div>
            <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => window.location.href = '/affiliate/reports'}>
          <CardContent className="p-5 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="font-medium">View Reports</p>
              <p className="text-xs text-muted-foreground">Analyze your performance</p>
            </div>
            <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => window.location.href = '/affiliate/resources'}>
          <CardContent className="p-5 flex items-center gap-3">
            <Target className="h-5 w-5 text-violet-600" />
            <div>
              <p className="font-medium">Resources</p>
              <p className="text-xs text-muted-foreground">Marketing materials</p>
            </div>
            <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      {/* Submit Lead Modal */}
      <Dialog open={showSubmitModal} onOpenChange={setShowSubmitModal}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Submit Lead</DialogTitle>
            <DialogDescription>
              Enter the details below to submit a lead. Ensure all information is accurate for proper tracking.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitLead} className="space-y-4">
            {programs.length > 0 && (
              <div className="space-y-2">
                <Label>Property Program *</Label>
                <Select
                  value={submitForm.programId}
                  onValueChange={(value) => setSubmitForm({ ...submitForm, programId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select property" />
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
              <Button type="button" variant="outline" onClick={() => setShowSubmitModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitLoading}>
                {submitLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Lead
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon className="h-10 w-10 text-muted-foreground/40 mb-3" />
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-20 w-full rounded-xl" />
      <Skeleton className="h-10 w-full max-w-md" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div>
                  <Skeleton className="h-7 w-20 mb-1" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-6 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
