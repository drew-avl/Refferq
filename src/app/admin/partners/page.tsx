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
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Search,
  Plus,
  Mail,
  MoreHorizontal,
  ChevronUp,
  ChevronDown,
  Download,
  Upload,
  Users,
  CheckCircle2,
  XCircle,
  Trash2,
  UserPlus,
  ArrowUpDown,
  Edit,
} from 'lucide-react';

interface AssignedProgram {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  isDefault: boolean;
  referralPayoutCents: number;
  currency: string;
}

interface Program extends AssignedProgram {
  assignedAffiliates?: { id: string; name: string; email: string; status?: string }[];
}

interface Partner {
  id: string;
  userId: string;
  name: string;
  email: string;
  referralCode: string;
  status: string;
  createdAt: string;
  clicks: number;
  leads: number;
  customers: number;
  revenue: number;
  earnings: number;
  groupName?: string;
  company?: string;
  payoutMethod?: string;
  payoutEmail?: string;
  assignedPrograms: AssignedProgram[];
  assignedProgramIds: string[];
}

const payoutMethodOptions = ['PayPal', 'Zelle'] as const;

const getAllowedPayoutMethod = (method?: string) =>
  payoutMethodOptions.includes(method as (typeof payoutMethodOptions)[number]) ? method! : 'PayPal';

export default function PartnersPage() {
  const router = useRouter();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [filteredPartners, setFilteredPartners] = useState<Partner[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [activeTab, setActiveTab] = useState('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [savingPartner, setSavingPartner] = useState(false);
  const [selectedPartners, setSelectedPartners] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [sortField, setSortField] = useState<keyof Partner>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const [newPartner, setNewPartner] = useState({
    firstName: '',
    lastName: '',
    email: '',
    company: '',
    partnerGroup: 'Default',
    country: 'N/A',
    payoutMethod: 'PayPal',
    paypalEmail: '',
    sendWelcomeEmail: true,
    trackingParameter: 'ref',
  });

  const [invitePartner, setInvitePartner] = useState({
    email: '',
    partnerGroup: 'Default',
    inviteType: 'single',
  });

  const [editPartner, setEditPartner] = useState({
    name: '',
    email: '',
    status: 'ACTIVE',
    company: '',
    payoutMethod: 'PayPal',
    payoutEmail: '',
    assignedProgramIds: [] as string[],
  });

  useEffect(() => {
    fetchPartners();
    fetchPrograms();
  }, []);

  useEffect(() => {
    filterPartners();
  }, [partners, activeTab, searchQuery, sortField, sortDirection]);

  const fetchPartners = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/affiliates');
      const data = await response.json();

      if (data.success) {
        const formattedPartners = data.affiliates.map((aff: any) => {
          const payoutDetails =
            aff.payoutDetails && typeof aff.payoutDetails === 'object'
              ? aff.payoutDetails
              : {};
          const assignedPrograms = aff.programAssignments?.map((assignment: any) => assignment.program) || [];

          return {
            id: aff.id,
            userId: aff.userId,
            name: aff.user.name,
            email: aff.user.email,
            referralCode: aff.referralCode,
            status: aff.user.status,
            createdAt: aff.createdAt,
            clicks: 0,
            leads: aff._count?.referrals || 0,
            customers: aff._count?.referrals || 0,
            revenue: 0,
            earnings: aff.balanceCents || 0,
            groupName: '',
            company: payoutDetails.company || '',
            payoutMethod: getAllowedPayoutMethod(payoutDetails.paymentMethod),
            payoutEmail: payoutDetails.paymentEmail || aff.user.email,
            assignedPrograms,
            assignedProgramIds: assignedPrograms.map((program: AssignedProgram) => program.id),
          };
        });
        setPartners(formattedPartners);
        setCurrencySymbol(data.currencySymbol || '$');
      }
    } catch (error) {
      console.error('Failed to fetch partners:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPrograms = async () => {
    try {
      const response = await fetch('/api/admin/programs');
      const data = await response.json();
      if (data.success) {
        setPrograms(data.programs || []);
      }
    } catch (error) {
      console.error('Failed to fetch programs:', error);
    }
  };

  const filterPartners = () => {
    let filtered = partners;

    if (activeTab === 'active') {
      filtered = filtered.filter((p: Partner) => p.status === 'ACTIVE');
    } else if (activeTab === 'pending') {
      filtered = filtered.filter((p: Partner) => p.status === 'PENDING');
    } else if (activeTab === 'invited') {
      filtered = filtered.filter((p: Partner) => p.status === 'INVITED');
    } else {
      filtered = filtered.filter((p: Partner) => !['ACTIVE', 'PENDING', 'INVITED'].includes(p.status));
    }

    if (searchQuery) {
      filtered = filtered.filter(
        (p: Partner) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.referralCode.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    filtered.sort((a: Partner, b: Partner) => {
      const aValue = (a as any)[sortField];
      const bValue = (b as any)[sortField];
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
      return 0;
    });

    setFilteredPartners(filtered);
  };

  const handleSort = (field: keyof Partner) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleCreatePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/admin/affiliates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${newPartner.firstName} ${newPartner.lastName}`.trim(),
          email: newPartner.email,
          company: newPartner.company,
          payoutMethod: newPartner.payoutMethod,
          paypalEmail: newPartner.paypalEmail || newPartner.email,
          sendWelcomeEmail: newPartner.sendWelcomeEmail,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert(
          `Partner created successfully!\n\nName: ${data.affiliate.name}\nEmail: ${data.affiliate.email}\nReferral Code: ${data.affiliate.referralCode}\nPassword: ${data.temporaryPassword}\nWelcome Email Sent: ${data.welcomeEmailSent ? 'Yes' : 'No'}`
        );
        setShowCreateModal(false);
        setNewPartner({
          firstName: '', lastName: '', email: '', company: '',
          partnerGroup: 'Default', country: 'N/A', payoutMethod: 'PayPal',
          paypalEmail: '', sendWelcomeEmail: true, trackingParameter: 'ref',
        });
        fetchPartners();
      } else {
        alert(data.message || 'Failed to create partner');
      }
    } catch (error) {
      console.error('Failed to create partner:', error);
      alert('Failed to create partner');
    }
  };

  const openEditPartner = (partner: Partner) => {
    setEditingPartner(partner);
    setEditPartner({
      name: partner.name,
      email: partner.email,
      status: partner.status,
      company: partner.company || '',
      payoutMethod: getAllowedPayoutMethod(partner.payoutMethod),
      payoutEmail: partner.payoutEmail || partner.email,
      assignedProgramIds: partner.assignedProgramIds || [],
    });
    setShowEditModal(true);
  };

  const toggleEditProgram = (programId: string) => {
    setEditPartner((current) => ({
      ...current,
      assignedProgramIds: current.assignedProgramIds.includes(programId)
        ? current.assignedProgramIds.filter((id) => id !== programId)
        : [...current.assignedProgramIds, programId],
    }));
  };

  const handleUpdatePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPartner) return;

    try {
      setSavingPartner(true);
      const response = await fetch(`/api/admin/affiliates/${editingPartner.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editPartner.name,
          email: editPartner.email,
          status: editPartner.status,
          company: editPartner.company,
          payoutMethod: editPartner.payoutMethod,
          paypalEmail: editPartner.payoutEmail,
          assignedProgramIds: editPartner.assignedProgramIds,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setShowEditModal(false);
        setEditingPartner(null);
        await fetchPartners();
      } else {
        alert(data.error || 'Failed to update partner');
      }
    } catch (error) {
      console.error('Failed to update partner:', error);
      alert('Failed to update partner');
    } finally {
      setSavingPartner(false);
    }
  };

  const handleSelectPartner = (partnerId: string) => {
    setSelectedPartners((prev: string[]) =>
      prev.includes(partnerId) ? prev.filter((id: string) => id !== partnerId) : [...prev, partnerId]
    );
  };

  const handleSelectAll = () => {
    if (selectedPartners.length === filteredPartners.length) {
      setSelectedPartners([]);
    } else {
      setSelectedPartners(filteredPartners.map((p: Partner) => p.id));
    }
  };

  const handleExportPartners = (exportType: 'all' | 'selected' = 'all') => {
    const partnersToExport =
      exportType === 'all'
        ? filteredPartners
        : filteredPartners.filter((p: Partner) => selectedPartners.includes(p.id));

    if (partnersToExport.length === 0) {
      alert('No partners to export');
      return;
    }

    const csv = [
      ['Name', 'Email', 'Referral Code', 'Status', 'Signed Up', 'Clicks', 'Leads', 'Customers', 'Revenue', 'Earnings'].join(','),
      ...partnersToExport.map((p: Partner) =>
        [
          `"${p.name}"`, p.email, p.referralCode, p.status,
          new Date(p.createdAt).toLocaleDateString(), p.clicks, p.leads,
          p.customers, (p.revenue / 100).toFixed(2), (p.earnings / 100).toFixed(2),
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `partners-${exportType}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const handleBulkAction = async (action: string, status?: string) => {
    if (selectedPartners.length === 0) {
      alert(`Please select partners first`);
      return;
    }

    if (action === 'delete') {
      if (!confirm(`Delete ${selectedPartners.length} partner(s)? This cannot be undone.`)) return;
    } else {
      if (!confirm(`${action} ${selectedPartners.length} partner(s)?`)) return;
    }

    try {
      const response = await fetch('/api/admin/affiliates/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          affiliateIds: selectedPartners,
          action: action === 'delete' ? 'delete' : 'changeStatus',
          status: status,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert(`Action completed successfully`);
        setSelectedPartners([]);
        fetchPartners();
      } else {
        alert(data.error || 'Action failed');
      }
    } catch (error) {
      console.error('Bulk action failed:', error);
      alert('Action failed');
    }
  };

  const tabCounts = {
    active: partners.filter((p: Partner) => p.status === 'ACTIVE').length,
    pending: partners.filter((p: Partner) => p.status === 'PENDING').length,
    invited: partners.filter((p: Partner) => p.status === 'INVITED').length,
    other: partners.filter((p: Partner) => !['ACTIVE', 'PENDING', 'INVITED'].includes(p.status)).length,
  };

  const SortIcon = ({ field }: { field: keyof Partner }) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
    return sortDirection === 'asc' ? (
      <ChevronUp className="ml-1 h-3 w-3" />
    ) : (
      <ChevronDown className="ml-1 h-3 w-3" />
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-32" />
          </div>
        </div>
        <Skeleton className="h-10 w-full" />
        <Card>
          <CardContent className="pt-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-4">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-32 mb-1" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Partners</h2>
          <p className="text-muted-foreground">Manage your referral partners</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowInviteModal(true)}>
            <Mail className="mr-2 h-4 w-4" />
            Invite
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Partner
          </Button>
        </div>
      </div>

      {/* Tabs + Search + Actions */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="active">Active ({tabCounts.active})</TabsTrigger>
            <TabsTrigger value="pending">Pending ({tabCounts.pending})</TabsTrigger>
            <TabsTrigger value="invited">Invited ({tabCounts.invited})</TabsTrigger>
            <TabsTrigger value="other">Other ({tabCounts.other})</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search partners..."
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            {selectedPartners.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Actions ({selectedPartners.length})
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleBulkAction('approve', 'ACTIVE')}>
                    <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" />
                    Approve Selected
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkAction('reject', 'INACTIVE')}>
                    <XCircle className="mr-2 h-4 w-4 text-amber-600" />
                    Reject Selected
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleBulkAction('delete')} className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Selected
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExportPartners('all')}>
                  <Download className="mr-2 h-4 w-4" />
                  Export All (CSV)
                </DropdownMenuItem>
                {selectedPartners.length > 0 && (
                  <DropdownMenuItem onClick={() => handleExportPartners('selected')}>
                    <Download className="mr-2 h-4 w-4" />
                    Export Selected (CSV)
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Upload className="mr-2 h-4 w-4" />
                  Import Partners (CSV)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Table Content (same for all tabs) */}
        <Card className="mt-4">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedPartners.length === filteredPartners.length && filteredPartners.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('name')}>
                    <div className="flex items-center">
                      Partner <SortIcon field="name" />
                    </div>
                  </TableHead>
                  <TableHead>Referral Code</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('leads')}>
                    <div className="flex items-center">
                      Leads <SortIcon field="leads" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('customers')}>
                    <div className="flex items-center">
                      Customers <SortIcon field="customers" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => handleSort('revenue')}>
                    <div className="flex items-center justify-end">
                      Revenue <SortIcon field="revenue" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => handleSort('earnings')}>
                    <div className="flex items-center justify-end">
                      Earnings <SortIcon field="earnings" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('createdAt')}>
                    <div className="flex items-center">
                      Signed Up <SortIcon field="createdAt" />
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPartners.length > 0 ? (
                  filteredPartners.map((partner: Partner) => (
                    <TableRow
                      key={partner.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/admin/partners/${partner.id}`)}
                    >
                      <TableCell onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedPartners.includes(partner.id)}
                          onCheckedChange={() => handleSelectPartner(partner.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {partner.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{partner.name}</p>
                            <p className="text-xs text-muted-foreground">{partner.email}</p>
                            {partner.assignedPrograms.length > 0 && (
                              <p className="text-xs text-muted-foreground">
                                {partner.assignedPrograms.map((program) => program.name).join(', ')}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{partner.referralCode}</code>
                      </TableCell>
                      <TableCell>{partner.leads}</TableCell>
                      <TableCell>{partner.customers}</TableCell>
                      <TableCell className="text-right font-medium">
                        {currencySymbol}{(partner.revenue / 100).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {currencySymbol}{(partner.earnings / 100).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(partner.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditPartner(partner)}
                          aria-label={`Edit ${partner.name}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Users className="h-10 w-10 text-muted-foreground/50 mb-3" />
                        <p className="text-sm font-medium text-muted-foreground">No partners found</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {searchQuery ? 'Try a different search term' : 'Create or invite partners to get started'}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Tabs>

      {/* Create Partner Dialog */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Partner</DialogTitle>
            <DialogDescription>Add a new referral partner manually</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreatePartner}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={newPartner.firstName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPartner({ ...newPartner, firstName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={newPartner.lastName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPartner({ ...newPartner, lastName: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newPartner.email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPartner({ ...newPartner, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company (Optional)</Label>
                <Input
                  id="company"
                  value={newPartner.company}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPartner({ ...newPartner, company: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Partner Group</Label>
                  <Select
                    value={newPartner.partnerGroup}
                    onValueChange={(value: string) => setNewPartner({ ...newPartner, partnerGroup: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Default">Default</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Payout Method</Label>
                  <Select
                    value={newPartner.payoutMethod}
                    onValueChange={(value: string) => setNewPartner({ ...newPartner, payoutMethod: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PayPal">PayPal</SelectItem>
                      <SelectItem value="Zelle">Zelle</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="paypalEmail">Payout Email / Phone (Optional)</Label>
                <Input
                  id="paypalEmail"
                  value={newPartner.paypalEmail}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPartner({ ...newPartner, paypalEmail: e.target.value })}
                  placeholder="defaults to partner email"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="sendWelcomeEmail"
                  checked={newPartner.sendWelcomeEmail}
                  onCheckedChange={(checked: boolean) => setNewPartner({ ...newPartner, sendWelcomeEmail: checked })}
                />
                <Label htmlFor="sendWelcomeEmail">Send welcome email</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button type="submit">
                <UserPlus className="mr-2 h-4 w-4" />
                Create Partner
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Partner Dialog */}
      <Dialog
        open={showEditModal}
        onOpenChange={(open) => {
          setShowEditModal(open);
          if (!open) setEditingPartner(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Partner</DialogTitle>
            <DialogDescription>Update partner details, payout information, and property program access</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdatePartner}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editName">Name</Label>
                  <Input
                    id="editName"
                    value={editPartner.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditPartner({ ...editPartner, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={editPartner.status}
                    onValueChange={(value: string) => setEditPartner({ ...editPartner, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                      <SelectItem value="SUSPENDED">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="editEmail">Email</Label>
                <Input
                  id="editEmail"
                  type="email"
                  value={editPartner.email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditPartner({ ...editPartner, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editCompany">Company</Label>
                <Input
                  id="editCompany"
                  value={editPartner.company}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditPartner({ ...editPartner, company: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Payout Method</Label>
                  <Select
                    value={editPartner.payoutMethod}
                    onValueChange={(value: string) => setEditPartner({ ...editPartner, payoutMethod: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PayPal">PayPal</SelectItem>
                      <SelectItem value="Zelle">Zelle</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editPayoutEmail">Payout Email / Phone</Label>
                  <Input
                    id="editPayoutEmail"
                    value={editPartner.payoutEmail}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditPartner({ ...editPartner, payoutEmail: e.target.value })}
                    placeholder="defaults to partner email"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Property Programs</Label>
                <div className="max-h-52 overflow-y-auto rounded-md border p-3">
                  {programs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No property programs available yet</p>
                  ) : (
                    <div className="space-y-3">
                      {programs.map((program) => (
                        <label key={program.id} className="flex cursor-pointer items-start gap-3">
                          <Checkbox
                            checked={editPartner.assignedProgramIds.includes(program.id)}
                            onCheckedChange={() => toggleEditProgram(program.id)}
                          />
                          <span className="grid gap-1 text-sm leading-none">
                            <span className="font-medium">{program.name}</span>
                            <span className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                              <span>/{program.slug}</span>
                              {program.isDefault && <Badge variant="secondary" className="text-[10px]">Default</Badge>}
                              {!program.isActive && <Badge variant="outline" className="text-[10px]">Inactive</Badge>}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingPartner || !editPartner.name || !editPartner.email}>
                {savingPartner ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Invite Partner Dialog */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Partner</DialogTitle>
            <DialogDescription>Send an email invitation to a new referral partner</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="inviteEmail">Email Address</Label>
              <Input
                id="inviteEmail"
                type="email"
                value={invitePartner.email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInvitePartner({ ...invitePartner, email: e.target.value })}
                placeholder="partner@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Partner Group</Label>
              <Select
                value={invitePartner.partnerGroup}
                onValueChange={(value: string) => setInvitePartner({ ...invitePartner, partnerGroup: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Default">Default</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowInviteModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                alert('Invite feature will send an email invitation to the partner.');
                setShowInviteModal(false);
              }}
            >
              <Mail className="mr-2 h-4 w-4" />
              Send Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
