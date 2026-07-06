import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { getAdminActor, isFullAdmin } from '@/lib/admin-access';

const TEAM_ROLES = ['OWNER', 'ADMIN', 'STAFF', 'MANAGER', 'VIEWER'];

async function verifyAdmin(request: NextRequest) {
  const user = await getAdminActor(request);
  return user && isFullAdmin(user) ? user : null;
}

function normalizeTeamRole(role: unknown) {
  return typeof role === 'string' && TEAM_ROLES.includes(role) ? role : 'STAFF';
}

function loginRoleForTeamRole(role: string) {
  return role === 'OWNER' || role === 'ADMIN' ? 'ADMIN' : 'STAFF';
}

async function validateAffiliateIds(affiliateIds: string[]) {
  const uniqueIds = Array.from(new Set(affiliateIds.filter(Boolean)));
  if (uniqueIds.length === 0) return uniqueIds;

  const count = await prisma.affiliate.count({
    where: { id: { in: uniqueIds } },
  });

  if (count !== uniqueIds.length) {
    throw new Error('One or more selected partners do not exist');
  }

  return uniqueIds;
}

async function syncStaffAssignments(
  staffUserId: string,
  affiliateIds: string[],
  assignedBy: string,
  tx: Prisma.TransactionClient
) {
  await tx.staffAffiliateAssignment.deleteMany({
    where: { staffUserId },
  });

  if (affiliateIds.length === 0) return;

  await tx.staffAffiliateAssignment.createMany({
    data: affiliateIds.map((affiliateId) => ({
      staffUserId,
      affiliateId,
      assignedBy,
    })),
    skipDuplicates: true,
  });
}

export async function GET(request: NextRequest) {
  const user = await verifyAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const [members, assignablePartners] = await Promise.all([
      prisma.teamMember.findMany({
        orderBy: { createdAt: 'desc' },
      }),
      prisma.affiliate.findMany({
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const linkedUserIds = members.map((member) => member.userId).filter((id): id is string => !!id);
    const [linkedUsers, assignments] = await Promise.all([
      linkedUserIds.length > 0
        ? prisma.user.findMany({
            where: { id: { in: linkedUserIds } },
            select: { id: true, role: true, status: true },
          })
        : Promise.resolve([]),
      linkedUserIds.length > 0
        ? prisma.staffAffiliateAssignment.findMany({
            where: { staffUserId: { in: linkedUserIds } },
            include: {
              affiliate: {
                include: {
                  user: {
                    select: {
                      name: true,
                      email: true,
                    },
                  },
                },
              },
            },
          })
        : Promise.resolve([]),
    ]);

    const usersById = new Map(linkedUsers.map((linkedUser) => [linkedUser.id, linkedUser]));
    const assignmentsByUserId = assignments.reduce<Record<string, typeof assignments[number][]>>((acc, assignment) => {
      if (!acc[assignment.staffUserId]) acc[assignment.staffUserId] = [];
      acc[assignment.staffUserId].push(assignment);
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      members: members.map((member) => {
        const linkedUser = member.userId ? usersById.get(member.userId) : null;
        const memberAssignments = member.userId ? assignmentsByUserId[member.userId] || [] : [];

        return {
          ...member,
          loginRole: linkedUser?.role || null,
          loginStatus: linkedUser?.status || null,
          assignedPartnerIds: memberAssignments.map((assignment) => assignment.affiliateId),
          assignedPartners: memberAssignments.map((assignment) => ({
            id: assignment.affiliateId,
            name: assignment.affiliate.user.name,
            email: assignment.affiliate.user.email,
          })),
        };
      }),
      assignablePartners: assignablePartners.map((partner) => ({
        id: partner.id,
        name: partner.user.name,
        email: partner.user.email,
        status: partner.user.status,
      })),
    });
  } catch (error) {
    console.error('Admin team GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch team members' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await verifyAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.toLowerCase().trim() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const role = normalizeTeamRole(body.role);
    const loginRole = loginRoleForTeamRole(role);
    const assignedAffiliateIds = await validateAffiliateIds(Array.isArray(body.assignedAffiliateIds) ? body.assignedAffiliateIds : []);

    if (!email || !name) {
      return NextResponse.json({ error: 'Email and name are required' }, { status: 400 });
    }

    const existingMember = await prisma.teamMember.findUnique({ where: { email } });
    if (existingMember) {
      return NextResponse.json({ error: 'This email is already on the team' }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser?.role === 'AFFILIATE') {
      return NextResponse.json(
        { error: 'This email already belongs to a referral partner account' },
        { status: 400 }
      );
    }

    const providedPassword = typeof body.password === 'string' ? body.password : '';
    if (providedPassword && providedPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const generatedPassword = existingUser || providedPassword
      ? null
      : `RF-${crypto.randomBytes(9).toString('base64url')}`;
    const passwordToHash = providedPassword || generatedPassword;

    const result = await prisma.$transaction(async (tx) => {
      const linkedUser = existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: {
              name,
              role: loginRole as any,
              status: 'ACTIVE',
            },
          })
        : await tx.user.create({
            data: {
              email,
              name,
              role: loginRole as any,
              status: 'ACTIVE',
              password: await bcrypt.hash(passwordToHash!, 12),
            },
          });

      const member = await tx.teamMember.create({
        data: {
          email,
          name,
          role: role as any,
          permissions: [],
          invitedBy: user.id,
          userId: linkedUser.id,
          status: 'ACTIVE',
          acceptedAt: new Date(),
        },
      });

      if (loginRole === 'STAFF') {
        await syncStaffAssignments(linkedUser.id, assignedAffiliateIds, user.id, tx);
      }

      return { member, linkedUser };
    });

    return NextResponse.json({
      success: true,
      member: result.member,
      temporaryPassword: generatedPassword,
    });
  } catch (error) {
    console.error('Admin team POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create staff member' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const user = await verifyAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const id = typeof body.id === 'string' ? body.id : '';
    if (!id) return NextResponse.json({ error: 'Team member ID required' }, { status: 400 });

    const existingMember = await prisma.teamMember.findUnique({ where: { id } });
    if (!existingMember) return NextResponse.json({ error: 'Team member not found' }, { status: 404 });

    const updates: Record<string, any> = {};
    if (typeof body.name === 'string') updates.name = body.name.trim();
    if (typeof body.email === 'string') updates.email = body.email.toLowerCase().trim();
    if (typeof body.role === 'string') updates.role = normalizeTeamRole(body.role);
    if (typeof body.status === 'string') updates.status = body.status;
    if (Array.isArray(body.permissions)) updates.permissions = body.permissions;

    const assignedAffiliateIds = Array.isArray(body.assignedAffiliateIds)
      ? await validateAffiliateIds(body.assignedAffiliateIds)
      : null;

    const member = await prisma.$transaction(async (tx) => {
      const updatedMember = await tx.teamMember.update({
        where: { id },
        data: updates,
      });

      if (updatedMember.userId) {
        const userUpdates: Record<string, any> = {};
        if (updates.name) userUpdates.name = updates.name;
        if (updates.email) userUpdates.email = updates.email;
        if (updates.role) userUpdates.role = loginRoleForTeamRole(updates.role) as any;
        if (updates.status === 'DEACTIVATED') userUpdates.status = 'INACTIVE';
        if (updates.status === 'ACTIVE') userUpdates.status = 'ACTIVE';

        if (Object.keys(userUpdates).length > 0) {
          await tx.user.update({
            where: { id: updatedMember.userId },
            data: userUpdates,
          });
        }

        const effectiveRole = updates.role || updatedMember.role;
        if (assignedAffiliateIds && loginRoleForTeamRole(effectiveRole) === 'STAFF') {
          await syncStaffAssignments(updatedMember.userId, assignedAffiliateIds, user.id, tx);
        }

        if (assignedAffiliateIds && loginRoleForTeamRole(effectiveRole) !== 'STAFF') {
          await tx.staffAffiliateAssignment.deleteMany({
            where: { staffUserId: updatedMember.userId },
          });
        }
      }

      return updatedMember;
    });

    return NextResponse.json({ success: true, member });
  } catch (error) {
    console.error('Admin team PUT error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update team member' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const user = await verifyAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Team member ID required' }, { status: 400 });

    const member = await prisma.teamMember.findUnique({ where: { id } });
    if (!member) return NextResponse.json({ error: 'Team member not found' }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      if (member.userId) {
        await tx.staffAffiliateAssignment.deleteMany({
          where: { staffUserId: member.userId },
        });

        await tx.user.update({
          where: { id: member.userId },
          data: { status: 'INACTIVE' },
        });
      }

      await tx.teamMember.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin team DELETE error:', error);
    return NextResponse.json({ error: 'Failed to remove team member' }, { status: 500 });
  }
}
