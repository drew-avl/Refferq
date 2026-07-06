import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminActor, isFullAdmin } from '@/lib/admin-access';

async function requireFullAdmin(request: NextRequest) {
  const user = await getAdminActor(request);
  return user && isFullAdmin(user) ? user : null;
}

function normalizeFaqPayload(body: any) {
  const question = typeof body.question === 'string' ? body.question.trim() : '';
  const answer = typeof body.answer === 'string' ? body.answer.trim() : '';
  const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0;
  const isActive = typeof body.isActive === 'boolean' ? body.isActive : true;

  return { question, answer, sortOrder, isActive };
}

export async function GET(request: NextRequest) {
  const user = await requireFullAdmin(request);
  if (!user) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  try {
    const faqs = await prisma.portalFaq.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return NextResponse.json({ success: true, faqs });
  } catch (error) {
    console.error('Admin FAQ GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch FAQs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await requireFullAdmin(request);
  if (!user) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  try {
    const body = await request.json();
    const data = normalizeFaqPayload(body);

    if (!data.question || !data.answer) {
      return NextResponse.json({ error: 'Question and answer are required' }, { status: 400 });
    }

    const faq = await prisma.portalFaq.create({
      data: {
        ...data,
        createdBy: user.id,
      },
    });

    return NextResponse.json({ success: true, faq });
  } catch (error) {
    console.error('Admin FAQ POST error:', error);
    return NextResponse.json({ error: 'Failed to create FAQ' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const user = await requireFullAdmin(request);
  if (!user) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  try {
    const body = await request.json();
    const id = typeof body.id === 'string' ? body.id : '';
    if (!id) return NextResponse.json({ error: 'FAQ ID is required' }, { status: 400 });

    const data = normalizeFaqPayload(body);
    if (!data.question || !data.answer) {
      return NextResponse.json({ error: 'Question and answer are required' }, { status: 400 });
    }

    const faq = await prisma.portalFaq.update({
      where: { id },
      data,
    });

    return NextResponse.json({ success: true, faq });
  } catch (error) {
    console.error('Admin FAQ PUT error:', error);
    return NextResponse.json({ error: 'Failed to update FAQ' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await requireFullAdmin(request);
  if (!user) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'FAQ ID is required' }, { status: 400 });

    await prisma.portalFaq.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin FAQ DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete FAQ' }, { status: 500 });
  }
}
