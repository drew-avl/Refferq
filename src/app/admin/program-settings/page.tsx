'use client';

import React, { useState, useEffect } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Settings2,
  Save,
  Plus,
  Pencil,
  Trash2,
  Percent,
  CheckCircle2,
  Globe,
  Clock,
} from 'lucide-react';

interface ProgramSettings {
  id: string;
  programId: string;
  productName: string;
  programName: string;
  websiteUrl: string;
  currency: string;
  portalSubdomain: string;
  companyName?: string;
  companyLogo?: string;
  favicon?: string;
  brandBackgroundColor: string;
  brandButtonColor: string;
  brandTextColor: string;
  minimumPayoutThreshold: number;
  payoutTerm: string;
  commissionHoldDays: number;
  commissionRules: CommissionRule[];
}

interface CommissionRule {
  id: string;
  name: string;
  type: string;
  value: number;
  conditions: Record<string, unknown>;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
}

export default function ProgramSettingsPage() {
  const [settings, setSettings] = useState<ProgramSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Commission rule dialog
  const [ruleDialog, setRuleDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<CommissionRule | null>(null);
  const [ruleForm, setRuleForm] = useState({
    name: '',
    type: 'PERCENTAGE',
    value: '',
    isDefault: false,
  });
  const [savingRule, setSavingRule] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: settings.productName,
          programName: settings.programName,
          websiteUrl: settings.websiteUrl,
          currency: settings.currency,
          portalSubdomain: settings.portalSubdomain,
          companyName: settings.companyName || '',
          companyLogo: settings.companyLogo || '',
          favicon: settings.favicon || '',
          brandBackgroundColor: settings.brandBackgroundColor,
          brandButtonColor: settings.brandButtonColor,
          brandTextColor: settings.brandTextColor,
          minimumPayoutThreshold: settings.minimumPayoutThreshold,
          payoutTerm: settings.payoutTerm,
          commissionHoldDays: settings.commissionHoldDays,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRule = async () => {
    setSavingRule(true);
    try {
      const action = editingRule ? 'update' : 'create';
      const ruleData = editingRule
        ? { id: editingRule.id, name: ruleForm.name, type: ruleForm.type, value: parseFloat(ruleForm.value), isDefault: ruleForm.isDefault }
        : { name: ruleForm.name, type: ruleForm.type, value: parseFloat(ruleForm.value), isDefault: ruleForm.isDefault };

      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ruleData }),
      });
      if (res.ok) {
        await fetchSettings();
        setRuleDialog(false);
        setEditingRule(null);
        setRuleForm({ name: '', type: 'PERCENTAGE', value: '', isDefault: false });
      }
    } catch (error) {
      console.error('Failed to save rule:', error);
    } finally {
      setSavingRule(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('Delete this commission rule?')) return;
    try {
      await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', ruleData: { id } }),
      });
      await fetchSettings();
    } catch (error) {
      console.error('Failed to delete rule:', error);
    }
  };

  const openCreateRule = () => {
    setEditingRule(null);
    setRuleForm({ name: '', type: 'PERCENTAGE', value: '', isDefault: false });
    setRuleDialog(true);
  };

  const openEditRule = (rule: CommissionRule) => {
    setEditingRule(rule);
    setRuleForm({
      name: rule.name,
      type: rule.type,
      value: String(rule.value),
      isDefault: rule.isDefault,
    });
    setRuleDialog(true);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-[400px]" />
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Failed to load settings</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Portal Settings</h1>
        <p className="text-muted-foreground">Configure the referral portal experience</p>
      </div>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                General Settings
              </CardTitle>
              <CardDescription>Basic portal configuration</CardDescription>
            </div>
            <Button onClick={handleSaveSettings} disabled={saving}>
              {saved ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                  Saved
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="productName">Product Name</Label>
              <Input
                id="productName"
                value={settings.productName}
                onChange={(e) => setSettings({ ...settings, productName: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="programName">Portal Name</Label>
              <Input
                id="programName"
                value={settings.programName}
                onChange={(e) => setSettings({ ...settings, programName: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="websiteUrl">Website URL</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="websiteUrl"
                  className="pl-9"
                  value={settings.websiteUrl}
                  onChange={(e) => setSettings({ ...settings, websiteUrl: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="portalSubdomain">Portal Subdomain</Label>
              <Input
                id="portalSubdomain"
                value={settings.portalSubdomain}
                onChange={(e) => setSettings({ ...settings, portalSubdomain: e.target.value })}
              />
            </div>
          </div>
          <Separator />
          <div className="grid gap-4 md:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={settings.currency}
                onValueChange={(v) => setSettings({ ...settings, currency: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INR">INR</SelectItem>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                  <SelectItem value="GBP">GBP (£)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="minimumPayoutThreshold">Min Payout Threshold (cents)</Label>
              <Input
                id="minimumPayoutThreshold"
                type="number"
                value={settings.minimumPayoutThreshold}
                onChange={(e) =>
                  setSettings({ ...settings, minimumPayoutThreshold: parseInt(e.target.value) || 0 })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="payoutTerm">Payout Term</Label>
              <Select
                value={settings.payoutTerm}
                onValueChange={(v) => setSettings({ ...settings, payoutTerm: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NET-15">NET-15</SelectItem>
                  <SelectItem value="NET-30">NET-30</SelectItem>
                  <SelectItem value="NET-60">NET-60</SelectItem>
                  <SelectItem value="NET-90">NET-90</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="commissionHoldDays">Commission Hold Period (Days)</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="commissionHoldDays"
                  type="number"
                  className="pl-9"
                  value={settings.commissionHoldDays}
                  onChange={(e) =>
                    setSettings({ ...settings, commissionHoldDays: parseInt(e.target.value) || 0 })
                  }
                  placeholder="30"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">Number of days to hold commissions for refund protection</p>
            </div>
          </div>
          <div className="rounded-md bg-muted p-3">
            <p className="text-xs text-muted-foreground">
              Portal ID: <span className="font-mono">{settings.programId}</span>
            </p>
          </div>
          <Separator />
          <div className="grid gap-4">
            <div>
              <h3 className="text-sm font-semibold">Custom Branding</h3>
              <p className="text-xs text-muted-foreground">These values control the referral portal branding.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  value={settings.companyName || ''}
                  onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="companyLogo">Logo URL</Label>
                <Input
                  id="companyLogo"
                  value={settings.companyLogo || ''}
                  onChange={(e) => setSettings({ ...settings, companyLogo: e.target.value })}
                  placeholder="https://example.com/logo.png"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="brandBackgroundColor">Background Color</Label>
                <Input
                  id="brandBackgroundColor"
                  type="color"
                  value={settings.brandBackgroundColor || '#f8fafc'}
                  onChange={(e) => setSettings({ ...settings, brandBackgroundColor: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="brandButtonColor">Button Color</Label>
                <Input
                  id="brandButtonColor"
                  type="color"
                  value={settings.brandButtonColor || '#059669'}
                  onChange={(e) => setSettings({ ...settings, brandButtonColor: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="brandTextColor">Text Color</Label>
                <Input
                  id="brandTextColor"
                  type="color"
                  value={settings.brandTextColor || '#0f172a'}
                  onChange={(e) => setSettings({ ...settings, brandTextColor: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="favicon">Favicon URL</Label>
                <Input
                  id="favicon"
                  value={settings.favicon || ''}
                  onChange={(e) => setSettings({ ...settings, favicon: e.target.value })}
                  placeholder="https://example.com/favicon.ico"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Commission Rules */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Percent className="h-5 w-5" />
                Commission Rules
              </CardTitle>
              <CardDescription>Define how commissions are calculated</CardDescription>
            </div>
            <Dialog open={ruleDialog} onOpenChange={setRuleDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" onClick={openCreateRule}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Rule
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingRule ? 'Edit Rule' : 'New Commission Rule'}</DialogTitle>
                  <DialogDescription>
                    {editingRule ? 'Update commission rule details' : 'Create a new commission calculation rule'}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Rule Name</Label>
                    <Input
                      value={ruleForm.name}
                      onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                      placeholder="e.g., Standard Commission"
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Type</Label>
                      <Select value={ruleForm.type} onValueChange={(v) => setRuleForm({ ...ruleForm, type: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                          <SelectItem value="FIXED">Flat Amount</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Value</Label>
                      <div className="relative">
                        {ruleForm.type === 'PERCENTAGE' ? (
                          <Percent className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        ) : (
                          <span className="absolute left-3 top-2.5 text-xs font-semibold text-muted-foreground">
                            {settings.currency}
                          </span>
                        )}
                        <Input
                          type="number"
                          className={ruleForm.type === 'FIXED' ? 'pl-16' : ''}
                          value={ruleForm.value}
                          onChange={(e) => setRuleForm({ ...ruleForm, value: e.target.value })}
                          placeholder={ruleForm.type === 'PERCENTAGE' ? '10' : '500'}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={ruleForm.isDefault}
                      onCheckedChange={(v) => setRuleForm({ ...ruleForm, isDefault: v })}
                    />
                    <Label>Set as default rule</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setRuleDialog(false)}>Cancel</Button>
                  <Button onClick={handleSaveRule} disabled={savingRule || !ruleForm.name || !ruleForm.value}>
                    {savingRule ? 'Saving...' : editingRule ? 'Update' : 'Create'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {settings.commissionRules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Percent className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">No commission rules</h3>
              <p className="text-sm text-muted-foreground">Create your first commission rule to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {settings.commissionRules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{rule.type}</Badge>
                    </TableCell>
                    <TableCell>
                      {rule.type === 'PERCENTAGE' ? `${rule.value}%` : `${settings.currency} ${rule.value}`}
                    </TableCell>
                    <TableCell>
                      {rule.isDefault && <Badge variant="default">Default</Badge>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                        {rule.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditRule(rule)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteRule(rule.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
