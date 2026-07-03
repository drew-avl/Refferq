'use client';

import React, { useState, useEffect } from 'react';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Layers, Plus, Star, Banknote, Clock, Globe, Edit, Trash2,
} from 'lucide-react';
import { PROGRAM_DEFAULTS } from '@/lib/program-defaults';

interface Program {
  id: string;
  name: string;
  slug: string;
  description?: string;
  referralPayoutCents: number;
  commissionRate: number;
  commissionType: string;
  cookieDuration: number;
  currency: string;
  isActive: boolean;
  isDefault: boolean;
  autoApprove: boolean;
  minPayoutCents: number;
  payoutFrequency: string;
  termsUrl?: string;
  logoUrl?: string;
  brandColor?: string;
  assignedAffiliates?: AssignedAffiliate[];
  createdAt: string;
}

interface AssignedAffiliate {
  id: string;
  name: string;
  email: string;
  status?: string;
}

interface Affiliate {
  id: string;
  user: {
    name: string;
    email: string;
    status: string;
  };
}

interface ProgramForm {
  name: string;
  slug: string;
  description: string;
  referralPayoutDollars: string;
  cookieDuration: string;
  currency: string;
  autoApprove: boolean;
  minPayoutCents: string;
  payoutFrequency: string;
  termsUrl: string;
  logoUrl: string;
  brandColor: string;
  assignedAffiliateIds: string[];
}

const emptyForm: ProgramForm = {
  name: '', slug: '', description: '', referralPayoutDollars: String(PROGRAM_DEFAULTS.referralPayoutCents / 100),
  cookieDuration: String(PROGRAM_DEFAULTS.cookieDurationDays), currency: PROGRAM_DEFAULTS.currency, autoApprove: PROGRAM_DEFAULTS.autoApprove, minPayoutCents: String(PROGRAM_DEFAULTS.minPayoutCents),
  payoutFrequency: PROGRAM_DEFAULTS.payoutFrequency, termsUrl: '', logoUrl: '', brandColor: PROGRAM_DEFAULTS.brandColor,
  assignedAffiliateIds: [] as string[],
};

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { fetchPrograms(); }, []);

  const fetchPrograms = async () => {
    try {
      const [programsRes, affiliatesRes] = await Promise.all([
        fetch('/api/admin/programs'),
        fetch('/api/admin/affiliates'),
      ]);
      const [programsData, affiliatesData] = await Promise.all([
        programsRes.json(),
        affiliatesRes.json(),
      ]);
      if (programsData.success) setPrograms(programsData.programs || []);
      if (affiliatesData.success) setAffiliates(affiliatesData.affiliates || []);
    } catch (error) {
      console.error('Failed to fetch programs:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (p: Program) => {
    setEditing(p);
    setForm({
      name: p.name, slug: p.slug, description: p.description || '',
      referralPayoutDollars: String((p.referralPayoutCents || 0) / 100),
      cookieDuration: String(p.cookieDuration), currency: p.currency,
      autoApprove: p.autoApprove, minPayoutCents: String(p.minPayoutCents),
      payoutFrequency: p.payoutFrequency, termsUrl: p.termsUrl || '',
      logoUrl: p.logoUrl || '', brandColor: p.brandColor || PROGRAM_DEFAULTS.brandColor,
      assignedAffiliateIds: p.assignedAffiliates?.map((affiliate) => affiliate.id) || [],
    });
    setDialogOpen(true);
  };

  const toggleAssignedAffiliate = (affiliateId: string) => {
    setForm((current) => ({
      ...current,
      assignedAffiliateIds: current.assignedAffiliateIds.includes(affiliateId)
        ? current.assignedAffiliateIds.filter((id) => id !== affiliateId)
        : [...current.assignedAffiliateIds, affiliateId],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: any = {
        name: form.name, slug: form.slug, description: form.description || null,
        referralPayoutCents: Math.round((parseFloat(form.referralPayoutDollars) || 0) * 100),
        commissionRate: PROGRAM_DEFAULTS.commissionRate, commissionType: PROGRAM_DEFAULTS.commissionType,
        cookieDuration: parseInt(form.cookieDuration), currency: form.currency,
        autoApprove: form.autoApprove, minPayoutCents: parseInt(form.minPayoutCents),
        payoutFrequency: form.payoutFrequency,
        termsUrl: form.termsUrl || null, logoUrl: form.logoUrl || null,
        brandColor: form.brandColor || null,
        affiliateIds: form.assignedAffiliateIds,
      };
      if (editing) body.id = editing.id;

      const res = await fetch('/api/admin/programs', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        await fetchPrograms();
        setDialogOpen(false);
      } else {
        alert(data.error || 'Failed to save lead source');
      }
    } catch (error) {
      console.error('Failed to save program:', error);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      await fetch('/api/admin/programs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive }),
      });
      await fetchPrograms();
    } catch (error) { console.error('Failed to toggle program:', error); }
  };

  const setDefault = async (id: string) => {
    try {
      await fetch('/api/admin/programs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isDefault: true }),
      });
      // Unset all others locally — API should handle this too
      await fetchPrograms();
    } catch (error) { console.error('Failed to set default:', error); }
  };

  const deleteProgram = async (id: string) => {
    if (!confirm('Delete this lead source? This cannot be undone.')) return;
    try {
      await fetch(`/api/admin/programs?id=${id}`, { method: 'DELETE' });
      await fetchPrograms();
    } catch (error) { console.error('Failed to delete program:', error); }
  };

  const formatCurrency = (cents: number, currency: string = 'USD') => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
      }).format(cents / 100);
    } catch (_error) {
      return `${currency} ${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
    }
  };

  const stats = {
    total: programs.length,
    active: programs.filter(p => p.isActive).length,
    defaultProgram: programs.find(p => p.isDefault),
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lead Sources</h1>
          <p className="text-muted-foreground">Separate referrals by property, business, location, or partner channel</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Create Lead Source
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Sources</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Globe className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.active}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Default Source</CardTitle>
            <Star className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent><div className="text-lg font-bold truncate">{stats.defaultProgram?.name || 'Not set'}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Lead Sources</CardTitle>
          <CardDescription>Configure payout amounts, tracking windows, and assigned reps per source</CardDescription>
        </CardHeader>
        <CardContent>
          {programs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Layers className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">No lead sources yet</h3>
              <p className="text-sm text-muted-foreground">Create your first property, business, or location source</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead Source</TableHead>
                  <TableHead>Referral Payout</TableHead>
                  <TableHead>Cookie</TableHead>
                  <TableHead>Min Payout</TableHead>
                  <TableHead>Assigned Reps</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Auto-Approve</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {programs.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {p.brandColor && (
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: p.brandColor }} />
                        )}
                        <div>
                          <p className="font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">/{p.slug}</p>
                        </div>
                        {p.isDefault && <Badge variant="secondary" className="text-xs">Default</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Banknote className="h-3 w-3 text-muted-foreground" />
                        <span className="font-semibold">{formatCurrency(p.referralPayoutCents || 0, p.currency)}</span>
                        <span className="text-xs text-muted-foreground">per completed referral</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {p.cookieDuration}d
                      </div>
                    </TableCell>
                    <TableCell>{formatCurrency(p.minPayoutCents, p.currency)}</TableCell>
                    <TableCell>
                      {p.assignedAffiliates && p.assignedAffiliates.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {p.assignedAffiliates.slice(0, 3).map((affiliate) => (
                            <Badge key={affiliate.id} variant="secondary" className="text-xs">
                              {affiliate.name}
                            </Badge>
                          ))}
                          {p.assignedAffiliates.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{p.assignedAffiliates.length - 3}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">No reps assigned</span>
                      )}
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{p.payoutFrequency}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={p.autoApprove ? 'default' : 'outline'} className="text-xs">
                        {p.autoApprove ? 'Yes' : 'Manual'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch checked={p.isActive} onCheckedChange={v => toggleActive(p.id, v)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {!p.isDefault && (
                          <Button variant="ghost" size="sm" onClick={() => setDefault(p.id)}>
                            <Star className="h-3 w-3 mr-1" />Set Default
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        {!p.isDefault && (
                          <Button variant="ghost" size="icon" onClick={() => deleteProgram(p.id)}>
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

      {/* Create/Edit Lead Source Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Lead Source' : 'Create Lead Source'}</DialogTitle>
            <DialogDescription>{editing ? 'Update source configuration' : 'Set up a new property, business, or location source'}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Source Name *</Label>
                <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="The Elm Apartments" />
              </div>
              <div className="grid gap-2">
                <Label>Slug *</Label>
                <Input value={form.slug} onChange={e => setForm({...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')})} placeholder="premium-partners" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Describe this property, business, or source..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Referral Payout ({form.currency})</Label>
                <Input type="number" min="0" step="0.01" value={form.referralPayoutDollars} onChange={e => setForm({...form, referralPayoutDollars: e.target.value})} />
              </div>
              <div className="grid gap-2">
                <Label>Cookie Duration (days)</Label>
                <Input type="number" value={form.cookieDuration} onChange={e => setForm({...form, cookieDuration: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>Currency</Label>
                <Select value={form.currency} onValueChange={v => setForm({...form, currency: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INR">INR</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (\u20AC)</SelectItem>
                    <SelectItem value="GBP">GBP (\u00A3)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Min Payout (cents)</Label>
                <Input type="number" value={form.minPayoutCents} onChange={e => setForm({...form, minPayoutCents: e.target.value})} />
              </div>
              <div className="grid gap-2">
                <Label>Payout Frequency</Label>
                <Select value={form.payoutFrequency} onValueChange={v => setForm({...form, payoutFrequency: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WEEKLY">Weekly</SelectItem>
                    <SelectItem value="BIWEEKLY">Bi-Weekly</SelectItem>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                    <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Brand Color</Label>
                <div className="flex gap-2">
                  <Input type="color" value={form.brandColor} onChange={e => setForm({...form, brandColor: e.target.value})} className="w-14 h-10 p-1" />
                  <Input value={form.brandColor} onChange={e => setForm({...form, brandColor: e.target.value})} className="flex-1 font-mono" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Logo URL</Label>
                <Input value={form.logoUrl} onChange={e => setForm({...form, logoUrl: e.target.value})} placeholder="https://..." />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Terms URL</Label>
              <Input value={form.termsUrl} onChange={e => setForm({...form, termsUrl: e.target.value})} placeholder="https://yoursite.com/terms" />
            </div>
            <div className="grid gap-2">
              <Label>Assigned Reps</Label>
              <div className="max-h-48 overflow-y-auto rounded-md border p-3">
                {affiliates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No reps available yet</p>
                ) : (
                  <div className="space-y-3">
                    {affiliates.map((affiliate) => (
                      <label key={affiliate.id} className="flex cursor-pointer items-start gap-3">
                        <Checkbox
                          checked={form.assignedAffiliateIds.includes(affiliate.id)}
                          onCheckedChange={() => toggleAssignedAffiliate(affiliate.id)}
                        />
                        <span className="grid gap-0.5 text-sm leading-none">
                          <span className="font-medium">{affiliate.user.name}</span>
                          <span className="text-xs text-muted-foreground">{affiliate.user.email}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Reps only see lead sources assigned here when submitting or editing leads.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.autoApprove as boolean} onCheckedChange={v => setForm({...form, autoApprove: v})} />
              <Label>Auto-approve new referral partners</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name || !form.slug}>
              {saving ? 'Saving...' : editing ? 'Update Source' : 'Create Source'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
