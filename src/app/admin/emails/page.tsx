'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  Mail,
  RefreshCw,
  Send,
  TestTube,
  Users,
} from 'lucide-react';

interface NewsletterRecipient {
  affiliateId: string;
  userId: string;
  name: string;
  email: string;
  status: string;
  referralCode: string;
  referralCount: number;
  joinedAt: string;
}

interface NewsletterSummary {
  recipients: NewsletterRecipient[];
  recipientCount: number;
  totalPartners: number;
  inactivePartners: number;
  latestSend: {
    sentAt: string;
    payload?: {
      subject?: string;
      recipientCount?: number;
      sent?: number;
      failed?: number;
    };
  } | null;
}

interface NewsletterForm {
  subject: string;
  headline: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
}

interface SendResult {
  success: boolean;
  mode: 'test' | 'send';
  recipientCount: number;
  sent: number;
  failed: number;
  message: string;
  failures?: Array<{ email: string; name: string; message: string }>;
}

const initialForm: NewsletterForm = {
  subject: '',
  headline: '',
  body: '',
  ctaLabel: '',
  ctaUrl: '',
};

function formatDate(value?: string | null) {
  if (!value) return 'Never';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function paragraphBlocks(body: string) {
  return body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => paragraph.split(/\n/).map((line) => line.trim()).filter(Boolean));
}

export default function EmailsPage() {
  const [summary, setSummary] = useState<NewsletterSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [testing, setTesting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<SendResult | null>(null);
  const [form, setForm] = useState<NewsletterForm>(initialForm);

  const previewHeadline = form.headline.trim() || form.subject.trim() || 'Newsletter headline';
  const previewParagraphs = useMemo(() => paragraphBlocks(form.body), [form.body]);
  const recipientCount = summary?.recipientCount || 0;
  const canSend = Boolean(form.subject.trim() && form.body.trim() && recipientCount > 0);

  const fetchSummary = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError('');

    try {
      const response = await fetch('/api/admin/emails');
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load referral agents');
      }
      setSummary(data);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load referral agents');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const updateField = (field: keyof NewsletterForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const sendNewsletter = async (mode: 'test' | 'send') => {
    if (mode === 'send' && !window.confirm(`Send this email to ${recipientCount} active referral agent${recipientCount === 1 ? '' : 's'}?`)) {
      return;
    }

    setError('');
    setResult(null);
    if (mode === 'test') setTesting(true);
    if (mode === 'send') setSending(true);

    try {
      const response = await fetch('/api/admin/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, mode }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send email');
      }

      setResult(data);
      if (mode === 'send') {
        setForm(initialForm);
        await fetchSummary(true);
      }
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Failed to send email');
    } finally {
      setTesting(false);
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((index) => <Skeleton key={index} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Emails</h1>
          <p className="text-muted-foreground">Send newsletter updates to referral agents</p>
        </div>
        <Button variant="outline" onClick={() => fetchSummary(true)} disabled={refreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
          result.success
            ? 'border-green-200 bg-green-50 text-green-800'
            : 'border-amber-200 bg-amber-50 text-amber-900'
        }`}>
          {result.success ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>
            {result.message}
            {result.failed > 0 ? ` (${result.failed} failed)` : ''}
          </span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Recipients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recipientCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Referral Agents</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalPartners || 0}</div>
            <p className="text-xs text-muted-foreground">{summary?.inactivePartners || 0} inactive</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Last Newsletter</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDate(summary?.latestSend?.sentAt)}</div>
            {summary?.latestSend?.payload?.sent ? (
              <p className="text-xs text-muted-foreground">{summary.latestSend.payload.sent} sent</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader>
            <CardTitle>Partner Newsletter</CardTitle>
            <CardDescription>Compose one email for all active referral agents</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={form.subject}
                onChange={(event) => updateField('subject', event.target.value)}
                maxLength={160}
                placeholder="Monthly partner update"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="headline">Headline</Label>
              <Input
                id="headline"
                value={form.headline}
                onChange={(event) => updateField('headline', event.target.value)}
                maxLength={180}
                placeholder="What referral agents should know this month"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="body">Message</Label>
              <Textarea
                id="body"
                value={form.body}
                onChange={(event) => updateField('body', event.target.value)}
                rows={12}
                placeholder={'Write the update here. Use blank lines between paragraphs.'}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="ctaLabel">Button Text</Label>
                <Input
                  id="ctaLabel"
                  value={form.ctaLabel}
                  onChange={(event) => updateField('ctaLabel', event.target.value)}
                  placeholder="View dashboard"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ctaUrl">Button URL</Label>
                <Input
                  id="ctaUrl"
                  value={form.ctaUrl}
                  onChange={(event) => updateField('ctaUrl', event.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => setPreviewOpen(true)}>
                <Eye className="mr-2 h-4 w-4" />
                Preview
              </Button>
              <Button variant="outline" onClick={() => sendNewsletter('test')} disabled={testing || !form.subject.trim() || !form.body.trim()}>
                <TestTube className="mr-2 h-4 w-4" />
                {testing ? 'Sending...' : 'Send Test'}
              </Button>
              <Button onClick={() => sendNewsletter('send')} disabled={sending || !canSend}>
                <Send className="mr-2 h-4 w-4" />
                {sending ? 'Sending...' : `Send to ${recipientCount}`}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recipients</CardTitle>
            <CardDescription>Active referral agents with email addresses</CardDescription>
          </CardHeader>
          <CardContent>
            {!summary?.recipients.length ? (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                No active referral agents found.
              </div>
            ) : (
              <div className="max-h-[520px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Leads</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.recipients.map((recipient) => (
                      <TableRow key={recipient.affiliateId}>
                        <TableCell>
                          <div className="font-medium">{recipient.name}</div>
                          <div className="text-xs text-muted-foreground">{recipient.email}</div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">{recipient.referralCount}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>{form.subject || 'No subject'}</DialogDescription>
          </DialogHeader>
          <div className="overflow-hidden rounded-lg border bg-white">
            <div className="bg-teal-700 px-8 py-7 text-white">
              <h2 className="m-0 text-2xl font-semibold leading-tight">{previewHeadline}</h2>
            </div>
            <div className="space-y-4 px-8 py-7 text-sm leading-6 text-gray-800">
              <p>Hi Referral Agent,</p>
              {previewParagraphs.length > 0 ? (
                previewParagraphs.map((paragraph, paragraphIndex) => (
                  <p key={paragraphIndex}>
                    {paragraph.map((line, lineIndex) => (
                      <React.Fragment key={`${paragraphIndex}-${lineIndex}`}>
                        {lineIndex > 0 ? <br /> : null}
                        {line}
                      </React.Fragment>
                    ))}
                  </p>
                ))
              ) : (
                <p className="text-gray-500">Your message preview will appear here.</p>
              )}
              {form.ctaUrl.trim() ? (
                <Button asChild>
                  <a href={form.ctaUrl} target="_blank" rel="noreferrer">
                    {form.ctaLabel.trim() || 'Open ReferConnect'}
                  </a>
                </Button>
              ) : null}
              <p>ReferConnect</p>
              <p className="text-xs text-gray-500">You are receiving this message because you are a referral partner.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
