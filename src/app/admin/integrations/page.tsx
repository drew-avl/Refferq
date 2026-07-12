'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Loader2, Play, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type DeadLetter = {
  id: string; eventType: string; entityType: string; entityId: string;
  attempts: number; lastError: string | null; deadLetteredAt: string | null;
};

type Health = {
  mode: string;
  configured: boolean;
  lastSuccessAt: string | null;
  outbox: Record<string, number>;
  inbox: Record<string, number>;
  signatureFailures: number;
  deadLetters: DeadLetter[];
  reconciliationJobs: Array<{
    id: string; mode: string; entityType: string | null; status: string;
    counts: Record<string, number>; createdAt: string; error: string | null;
  }>;
};

export default function IntegrationHealthPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [mode, setMode] = useState('missing-only');
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/twenty/health');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load integration health.');
      setHealth(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load integration health.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const startReconciliation = async () => {
    setWorking('reconcile');
    setMessage('');
    try {
      const response = await fetch('/api/admin/twenty/sync', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to queue reconciliation.');
      setMessage(`Reconciliation job ${data.job.id} queued.`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to queue reconciliation.');
    } finally { setWorking(null); }
  };

  const replay = async (eventId: string) => {
    setWorking(eventId);
    try {
      const response = await fetch('/api/admin/twenty/health', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'replay', eventId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Replay failed.');
      setMessage('Event returned to the delivery queue.');
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Replay failed.'); }
    finally { setWorking(null); }
  };

  if (loading && !health) return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading integration health…</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Integration Health</h1>
          <p className="text-muted-foreground">Twenty delivery, inbound events, dead letters, and reconciliation.</p>
        </div>
        <Button variant="outline" onClick={() => void refresh()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
      </div>

      {message && <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm">{message}</div>}

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardDescription>Configuration</CardDescription><CardTitle className="flex items-center gap-2 text-lg">{health?.configured ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <AlertTriangle className="h-5 w-5 text-amber-600" />}{health?.configured ? 'Ready' : 'Missing'}</CardTitle></CardHeader><CardContent><Badge variant="outline">{health?.mode || 'api'}</Badge></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Queued / retrying</CardDescription><CardTitle>{(health?.outbox.PENDING || 0) + (health?.outbox.RETRY || 0)}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">Processing: {health?.outbox.PROCESSING || 0}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Delivered</CardDescription><CardTitle>{health?.outbox.DELIVERED || 0}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">Last: {health?.lastSuccessAt ? new Date(health.lastSuccessAt).toLocaleString() : 'Never'}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Dead letters</CardDescription><CardTitle className="text-destructive">{health?.outbox.DEAD_LETTER || 0}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">Inbound failed: {health?.inbox.FAILED || 0} · Signature failures: {health?.signatureFailures || 0}</CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" />Reconciliation</CardTitle><CardDescription>Queue a resumable, throttled comparison. Dry-run and verify-only do not create delivery events.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Select value={mode} onValueChange={setMode}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="dry-run">Dry run</SelectItem><SelectItem value="missing-only">Missing only</SelectItem>
              <SelectItem value="changed-since">Changed since</SelectItem><SelectItem value="full">Full</SelectItem><SelectItem value="verify-only">Verify only</SelectItem>
            </SelectContent></Select>
            <Button onClick={startReconciliation} disabled={working === 'reconcile'}>{working === 'reconcile' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}Queue job</Button>
          </div>
          <Table><TableHeader><TableRow><TableHead>Created</TableHead><TableHead>Mode</TableHead><TableHead>Status</TableHead><TableHead>Scanned</TableHead><TableHead>Queued</TableHead><TableHead>Failed</TableHead></TableRow></TableHeader><TableBody>
            {(health?.reconciliationJobs || []).map((job) => <TableRow key={job.id}><TableCell>{new Date(job.createdAt).toLocaleString()}</TableCell><TableCell>{job.mode}</TableCell><TableCell><Badge variant="outline">{job.status}</Badge></TableCell><TableCell>{job.counts?.scanned || 0}</TableCell><TableCell>{(job.counts?.created || 0) + (job.counts?.updated || 0)}</TableCell><TableCell>{job.counts?.failed || 0}</TableCell></TableRow>)}
          </TableBody></Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Dead-letter events</CardTitle><CardDescription>Replay only after correcting configuration or data drift. Payloads and secrets are not exposed here.</CardDescription></CardHeader>
        <CardContent><Table><TableHeader><TableRow><TableHead>Event</TableHead><TableHead>Entity</TableHead><TableHead>Attempts</TableHead><TableHead>Error</TableHead><TableHead /></TableRow></TableHeader><TableBody>
          {(health?.deadLetters || []).map((event) => <TableRow key={event.id}><TableCell>{event.eventType}</TableCell><TableCell>{event.entityType} · {event.entityId}</TableCell><TableCell>{event.attempts}</TableCell><TableCell className="max-w-md truncate text-destructive">{event.lastError || 'Unknown error'}</TableCell><TableCell><Button size="sm" variant="outline" onClick={() => void replay(event.id)} disabled={working === event.id}>{working === event.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Replay'}</Button></TableCell></TableRow>)}
          {!health?.deadLetters.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No dead-letter events.</TableCell></TableRow>}
        </TableBody></Table></CardContent>
      </Card>
    </div>
  );
}
