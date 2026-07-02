import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

async function verifyAdmin(request: NextRequest) {
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

async function validateProgramId(programId: unknown) {
  if (!programId) return null;
  if (typeof programId !== 'string') {
    throw new Error('Invalid programId');
  }

  const program = await prisma.program.findUnique({
    where: { id: programId },
    select: { id: true },
  });

  if (!program) {
    throw new Error('Program not found');
  }

  return program.id;
}

// GET: List all resources
export async function GET(request: NextRequest) {
  const user = await verifyAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const resources = await prisma.resource.findMany({
      include: {
        program: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, resources });
  } catch (error) {
    console.error('Admin resources GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch resources' }, { status: 500 });
  }
}

// POST: Create resource
export async function POST(request: NextRequest) {
  const user = await verifyAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { title, description, type, fileUrl, fileName, fileSize, mimeType, category, tags, programId } = body;

    if (!title || !type || !fileUrl || !fileName) {
      return NextResponse.json({ error: 'Title, type, fileUrl, and fileName are required' }, { status: 400 });
    }

    let validatedProgramId: string | null;
    try {
      validatedProgramId = await validateProgramId(programId);
    } catch (validationError) {
      return NextResponse.json({ error: (validationError as Error).message }, { status: 400 });
    }

    const resource = await prisma.resource.create({
      data: {
        title,
        description: description || null,
        type,
        programId: validatedProgramId,
        fileUrl,
        fileName,
        fileSize: fileSize || null,
        mimeType: mimeType || null,
        category: category || null,
        tags: tags || [],
        createdBy: user.id,
      },
    });

    return NextResponse.json({ success: true, resource });
  } catch (error) {
    console.error('Admin resources POST error:', error);
    return NextResponse.json({ error: 'Failed to create resource' }, { status: 500 });
  }
}

// PUT: Update resource
export async function PUT(request: NextRequest) {
  const user = await verifyAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Resource ID required' }, { status: 400 });
    }

    const existing = await prisma.resource.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    const allowedFields = ['title', 'description', 'type', 'fileUrl', 'fileName', 'fileSize', 'mimeType', 'category', 'tags', 'isActive'] as const;
    for (const key of allowedFields) {
      if (key in body) {
        updates[key] = body[key] === '' ? null : body[key];
      }
    }

    if ('programId' in body) {
      try {
        updates.programId = await validateProgramId(body.programId);
      } catch (validationError) {
        return NextResponse.json({ error: (validationError as Error).message }, { status: 400 });
      }
    }

    const resource = await prisma.resource.update({
      where: { id },
      data: updates,
      include: {
        program: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, resource });
  } catch (error) {
    console.error('Admin resources PUT error:', error);
    return NextResponse.json({ error: 'Failed to update resource' }, { status: 500 });
  }
}

// DELETE: Delete resource
export async function DELETE(request: NextRequest) {
  const user = await verifyAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Resource ID required' }, { status: 400 });
    }

    await prisma.resource.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin resources DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete resource' }, { status: 500 });
  }
}
