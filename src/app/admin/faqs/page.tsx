'use client';

import React, { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Edit, HelpCircle, Plus, Trash2 } from 'lucide-react';

interface PortalFaq {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const emptyForm = {
  question: '',
  answer: '',
  sortOrder: 0,
  isActive: true,
};

export default function AdminFaqPage() {
  const [faqs, setFaqs] = useState<PortalFaq[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<PortalFaq | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    fetchFaqs();
  }, []);

  const fetchFaqs = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/faqs');
      const data = await res.json();
      if (data.success) setFaqs(data.faqs || []);
    } catch (error) {
      console.error('Failed to fetch FAQs:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingFaq(null);
    setForm({ ...emptyForm, sortOrder: faqs.length + 1 });
    setDialogOpen(true);
  };

  const openEditDialog = (faq: PortalFaq) => {
    setEditingFaq(faq);
    setForm({
      question: faq.question,
      answer: faq.answer,
      sortOrder: faq.sortOrder,
      isActive: faq.isActive,
    });
    setDialogOpen(true);
  };

  const saveFaq = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    try {
      const res = await fetch('/api/admin/faqs', {
        method: editingFaq ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingFaq?.id,
          ...form,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setDialogOpen(false);
        await fetchFaqs();
      } else {
        alert(data.error || 'Failed to save FAQ');
      }
    } catch (error) {
      console.error('Failed to save FAQ:', error);
      alert('Failed to save FAQ');
    } finally {
      setSaving(false);
    }
  };

  const deleteFaq = async (faq: PortalFaq) => {
    if (!confirm(`Delete "${faq.question}"?`)) return;

    try {
      const res = await fetch(`/api/admin/faqs?id=${faq.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        await fetchFaqs();
      } else {
        alert(data.error || 'Failed to delete FAQ');
      }
    } catch (error) {
      console.error('Failed to delete FAQ:', error);
      alert('Failed to delete FAQ');
    }
  };

  const toggleFaq = async (faq: PortalFaq, isActive: boolean) => {
    try {
      const res = await fetch('/api/admin/faqs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...faq, isActive }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchFaqs();
      } else {
        alert(data.error || 'Failed to update FAQ');
      }
    } catch (error) {
      console.error('Failed to update FAQ:', error);
      alert('Failed to update FAQ');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Portal FAQ</h1>
          <p className="text-muted-foreground">Manage the questions shown in the referral partner portal</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add FAQ
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>FAQ Items</CardTitle>
          <CardDescription>Active items appear in the partner portal in sort order</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {faqs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <HelpCircle className="h-10 w-10 text-muted-foreground/40" />
              <h2 className="mt-4 text-lg font-semibold">No FAQs yet</h2>
              <p className="text-sm text-muted-foreground">Add common partner questions before publishing this page</p>
              <Button className="mt-4" onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Add FAQ
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Order</TableHead>
                  <TableHead>Question</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-36 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {faqs.map((faq) => (
                  <TableRow key={faq.id}>
                    <TableCell className="text-muted-foreground">{faq.sortOrder}</TableCell>
                    <TableCell>
                      <p className="font-medium">{faq.question}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{faq.answer}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Switch checked={faq.isActive} onCheckedChange={(checked) => toggleFaq(faq, checked)} />
                        <Badge variant={faq.isActive ? 'default' : 'outline'}>
                          {faq.isActive ? 'Active' : 'Hidden'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(faq)} aria-label={`Edit ${faq.question}`}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteFaq(faq)} aria-label={`Delete ${faq.question}`}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
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
            <DialogTitle>{editingFaq ? 'Edit FAQ' : 'Add FAQ'}</DialogTitle>
            <DialogDescription>
              Keep answers concise and specific to the referral partner workflow.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={saveFaq} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="question">Question</Label>
              <Input
                id="question"
                value={form.question}
                onChange={(event) => setForm({ ...form, question: event.target.value })}
                placeholder="How do I submit a lead?"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="answer">Answer</Label>
              <Textarea
                id="answer"
                value={form.answer}
                onChange={(event) => setForm({ ...form, answer: event.target.value })}
                placeholder="Explain the answer partners should see in the portal."
                rows={6}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sortOrder">Sort Order</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  value={form.sortOrder}
                  onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })}
                  min={0}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <Label htmlFor="isActive">Visible in portal</Label>
                <Switch
                  id="isActive"
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !form.question || !form.answer}>
                {saving ? 'Saving...' : 'Save FAQ'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
