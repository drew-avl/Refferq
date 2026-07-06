'use client';

import React, { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { HelpCircle } from 'lucide-react';

interface PortalFaq {
  id: string;
  question: string;
  answer: string;
}

export default function AffiliateFaqPage() {
  const [faqs, setFaqs] = useState<PortalFaq[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFaqs();
  }, []);

  const fetchFaqs = async () => {
    try {
      const res = await fetch('/api/affiliate/faqs');
      const data = await res.json();
      if (data.success) setFaqs(data.faqs || []);
    } catch (error) {
      console.error('Failed to fetch FAQs:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">FAQ</h1>
        <p className="text-muted-foreground">Answers to common questions about submitting leads and tracking payouts</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Partner Questions</CardTitle>
          <CardDescription>Reference information for working through the referral portal</CardDescription>
        </CardHeader>
        <CardContent>
          {faqs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <HelpCircle className="h-10 w-10 text-muted-foreground/40" />
              <h2 className="mt-4 text-lg font-semibold">No FAQs published</h2>
              <p className="text-sm text-muted-foreground">Check back later for partner guidance and portal updates.</p>
            </div>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq) => (
                <AccordionItem key={faq.id} value={faq.id}>
                  <AccordionTrigger className="text-base">{faq.question}</AccordionTrigger>
                  <AccordionContent className="leading-6 text-muted-foreground whitespace-pre-wrap">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
