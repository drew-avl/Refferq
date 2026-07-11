import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emailService, type PartnerNewsletterEmailData } from '@/lib/email';

const MAX_SUBJECT_LENGTH = 160;
const MAX_HEADLINE_LENGTH = 180;
const MAX_BODY_LENGTH = 20_000;
const SEND_BATCH_SIZE = 5;

interface NewsletterRecipientTarget {
  affiliateId: string | null;
  userId: string;
  name: string;
  email: string;
  status: string;
  referralCode: string | null;
  referralCount: number;
  joinedAt: Date;
}

async function verifyAuth(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) return null;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== 'ADMIN') return null;
    return user;
  } catch (_e) {
    return null;
  }
}

async function getNewsletterRecipients(): Promise<NewsletterRecipientTarget[]> {
  const affiliates = await prisma.affiliate.findMany({
    where: {
      user: {
        role: 'AFFILIATE',
        status: 'ACTIVE',
      },
    },
    include: {
      _count: {
        select: {
          referrals: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          createdAt: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return affiliates
    .map((affiliate) => ({
      affiliateId: affiliate.id,
      userId: affiliate.user.id,
      name: affiliate.user.name,
      email: affiliate.user.email,
      status: affiliate.user.status,
      referralCode: affiliate.referralCode,
      referralCount: affiliate._count.referrals,
      joinedAt: affiliate.user.createdAt,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function isValidOptionalUrl(value: string) {
  if (!value) return true;

  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function validateNewsletter(data: PartnerNewsletterEmailData) {
  if (!data.subject) return 'Subject is required';
  if (!data.body) return 'Message body is required';
  if (data.subject.length > MAX_SUBJECT_LENGTH) return `Subject must be ${MAX_SUBJECT_LENGTH} characters or fewer`;
  if (data.headline.length > MAX_HEADLINE_LENGTH) return `Headline must be ${MAX_HEADLINE_LENGTH} characters or fewer`;
  if (data.body.length > MAX_BODY_LENGTH) return `Message body must be ${MAX_BODY_LENGTH} characters or fewer`;
  if (data.ctaUrl && !isValidOptionalUrl(data.ctaUrl)) return 'Button URL must start with http:// or https://';
  if (data.ctaUrl && !data.ctaLabel) return 'Button text is required when a button URL is provided';
  return null;
}

function getBatches<T>(items: T[], size: number) {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request);

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const [recipients, totalPartners, inactivePartners, latestSend] = await Promise.all([
      getNewsletterRecipients(),
      prisma.affiliate.count(),
      prisma.affiliate.count({
        where: {
          user: {
            role: 'AFFILIATE',
            status: {
              not: 'ACTIVE',
            },
          },
        },
      }),
      prisma.auditLog.findFirst({
        where: {
          action: 'NEWSLETTER_SENT',
          objectType: 'EmailNewsletter',
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      recipients,
      recipientCount: recipients.length,
      totalPartners,
      inactivePartners,
      latestSend: latestSend
        ? {
            sentAt: latestSend.createdAt,
            payload: latestSend.payload,
          }
        : null,
    });
  } catch (error) {
    console.error('Error fetching newsletter recipients:', error);
    return NextResponse.json(
      { error: 'Failed to fetch newsletter recipients' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await verifyAuth(request);

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const mode = cleanString(body.mode) === 'test' ? 'test' : 'send';
    const newsletter: PartnerNewsletterEmailData = {
      subject: cleanString(body.subject),
      headline: cleanString(body.headline) || cleanString(body.subject),
      body: cleanString(body.body),
      ctaLabel: cleanString(body.ctaLabel),
      ctaUrl: cleanString(body.ctaUrl),
    };

    const validationError = validateNewsletter(newsletter);
    if (validationError) {
      return NextResponse.json(
        { error: validationError },
        { status: 400 }
      );
    }

    const recipients = mode === 'test'
      ? [{
          affiliateId: null,
          userId: user.id,
          name: user.name,
          email: user.email,
          status: user.status,
          referralCode: null,
          referralCount: 0,
          joinedAt: user.createdAt,
        }]
      : await getNewsletterRecipients();

    if (recipients.length === 0) {
      return NextResponse.json(
        { error: 'No active referral agents have email addresses' },
        { status: 400 }
      );
    }

    const results: Array<{ email: string; name: string; success: boolean; message: string }> = [];

    for (const batch of getBatches(recipients, SEND_BATCH_SIZE)) {
      const batchResults = await Promise.all(
        batch.map(async (recipient) => {
          const result = await emailService.sendPartnerNewsletterEmail(recipient.email, {
            ...newsletter,
            recipientName: recipient.name,
          });

          return {
            email: recipient.email,
            name: recipient.name,
            success: result.success,
            message: result.message,
          };
        })
      );

      results.push(...batchResults);
    }

    const failed = results.filter((result) => !result.success);
    const sent = results.length - failed.length;

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: mode === 'test' ? 'NEWSLETTER_TEST_SENT' : 'NEWSLETTER_SENT',
        objectType: 'EmailNewsletter',
        objectId: user.id,
        payload: {
          mode,
          subject: newsletter.subject,
          headline: newsletter.headline,
          ctaUrl: newsletter.ctaUrl || null,
          ctaLabel: newsletter.ctaLabel || null,
          recipientCount: recipients.length,
          sent,
          failed: failed.length,
          failures: failed.slice(0, 10),
        } as any,
      },
    });

    return NextResponse.json({
      success: failed.length === 0,
      mode,
      recipientCount: recipients.length,
      sent,
      failed: failed.length,
      failures: failed,
      message: mode === 'test'
        ? `Test email sent to ${user.email}`
        : `Newsletter sent to ${sent} referral agent${sent === 1 ? '' : 's'}`,
    });
  } catch (error) {
    console.error('Error sending newsletter email:', error);
    return NextResponse.json(
      { error: 'Failed to send newsletter email' },
      { status: 500 }
    );
  }
}
