import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canUseAdminPortal,
  isFullAdmin,
  scopedAffiliateWhere,
  scopedReferralWhere,
  type AdminActor,
} from '../src/lib/admin-access';

const admin: AdminActor = { id: 'admin-user', role: 'ADMIN', status: 'ACTIVE' };
const staff: AdminActor = { id: 'staff-user', role: 'STAFF', status: 'ACTIVE' };

test('full administrators retain unrestricted partner and lead access', () => {
  assert.equal(canUseAdminPortal(admin), true);
  assert.equal(isFullAdmin(admin), true);
  assert.deepEqual(scopedAffiliateWhere(admin), {});
  assert.deepEqual(scopedReferralWhere(admin), {});
});

test('staff access remains limited to assigned partners and their leads', () => {
  assert.equal(canUseAdminPortal(staff), true);
  assert.equal(isFullAdmin(staff), false);
  assert.deepEqual(scopedAffiliateWhere(staff), {
    staffAssignments: { some: { staffUserId: staff.id } },
  });
  assert.deepEqual(scopedReferralWhere(staff), {
    affiliate: {
      staffAssignments: { some: { staffUserId: staff.id } },
    },
  });
});
