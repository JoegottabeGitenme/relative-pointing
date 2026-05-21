const { test, expect } = require('@playwright/test');
const {
  API_URL,
  POLL_TIMEOUT,
  createSessionViaAPI,
  joinSessionViaAPI,
  getSessionViaAPI,
  updateSessionViaAPI,
  startSessionViaAPI,
  endTurnViaAPI,
  moveTaskRawViaAPI,
  transferOwnershipViaAPI,
  createCreatorContext,
  openBrowserAsUser,
  sleep,
} = require('./helpers/test-helpers');

test.describe('Presence Tracking', () => {
  let roomCode;
  let creatorId;

  test.beforeEach(async ({ request }) => {
    const session = await createSessionViaAPI(request, 'Creator');
    roomCode = session.roomCode;
    creatorId = session.creatorId;
  });

  test('last_seen_at is updated when polling with userId', async ({
    request,
  }) => {
    // Initial fetch without userId — last_seen_at should be the join time
    const before = await getSessionViaAPI(request, roomCode);
    const creatorParticipant = before.participants.find(
      (p) => p.user_id === creatorId
    );
    expect(creatorParticipant).toBeTruthy();
    expect(creatorParticipant.last_seen_at).toBeTruthy();

    const firstSeenAt = creatorParticipant.last_seen_at;

    // Wait a moment, then poll with userId to update last_seen_at
    await sleep(1100);
    await getSessionViaAPI(request, roomCode, creatorId);

    // Fetch again to verify the timestamp was updated
    const after = await getSessionViaAPI(request, roomCode);
    const updatedParticipant = after.participants.find(
      (p) => p.user_id === creatorId
    );
    expect(updatedParticipant.last_seen_at).not.toBe(firstSeenAt);
  });

  test('participants include last_seen_at in API response', async ({
    request,
  }) => {
    const alice = await joinSessionViaAPI(request, roomCode, 'Alice');

    // Poll as both users
    await getSessionViaAPI(request, roomCode, creatorId);
    await getSessionViaAPI(request, roomCode, alice.userId);

    const data = await getSessionViaAPI(request, roomCode);
    for (const p of data.participants) {
      expect(p.last_seen_at).toBeTruthy();
    }
  });

  test('offline user shows grey indicator in participant list', async ({
    browser,
    request,
  }) => {
    const alice = await joinSessionViaAPI(request, roomCode, 'Alice');

    // Open browser as creator (who will keep polling)
    const creator = await createCreatorContext(
      browser,
      roomCode,
      creatorId,
      'Creator'
    );

    // Open browser as Alice briefly, then close to simulate disconnect
    const aliceCtx = await openBrowserAsUser(
      browser,
      roomCode,
      alice.userId,
      'Alice'
    );

    // Creator (skipped) + Alice = 2 total, 1 active
    await expect(creator.page.getByText('[1/2]').first()).toBeVisible(
      POLL_TIMEOUT
    );

    // Close Alice's browser to stop her polling
    await aliceCtx.context.close();

    // Wait for Alice to be considered offline (>15s threshold)
    await sleep(17000);

    // Alice should be shown as offline in the sidebar (status text "○ offline")
    await expect(creator.page.getByText(/○ offline/)).toBeVisible(POLL_TIMEOUT);

    await creator.context.close();
  });

  test('online user does NOT show offline indicator', async ({
    browser,
    request,
  }) => {
    const alice = await joinSessionViaAPI(request, roomCode, 'Alice');

    // Open browsers for both users (both actively polling)
    const creator = await createCreatorContext(
      browser,
      roomCode,
      creatorId,
      'Creator'
    );
    const aliceCtx = await openBrowserAsUser(
      browser,
      roomCode,
      alice.userId,
      'Alice'
    );

    // Wait for polling to establish presence
    await sleep(3000);

    // Neither user should have offline status indicator in the sidebar
    const offlineLabels = creator.page.getByText(/○ offline/);
    await expect(offlineLabels).toHaveCount(0);

    await aliceCtx.context.close();
    await creator.context.close();
  });
});

test.describe('Manual Ownership Transfer', () => {
  let roomCode;
  let creatorId;

  test.beforeEach(async ({ request }) => {
    const session = await createSessionViaAPI(request, 'Creator');
    roomCode = session.roomCode;
    creatorId = session.creatorId;
  });

  test('creator can transfer ownership via API', async ({ request }) => {
    const alice = await joinSessionViaAPI(request, roomCode, 'Alice');

    const result = await transferOwnershipViaAPI(
      request,
      roomCode,
      creatorId,
      alice.userId
    );

    expect(result.status).toBe(200);
    expect(result.data.success).toBe(true);
    expect(result.data.newOwnerId).toBe(alice.userId);
    expect(result.data.newOwnerName).toBe('Alice');

    // Verify the session now has Alice as creator
    const data = await getSessionViaAPI(request, roomCode);
    expect(data.session.creator_id).toBe(alice.userId);
    expect(data.session.creator_name).toBe('Alice');
  });

  test('non-creator cannot transfer ownership', async ({ request }) => {
    const alice = await joinSessionViaAPI(request, roomCode, 'Alice');
    const bob = await joinSessionViaAPI(request, roomCode, 'Bob');

    // Alice (non-creator) tries to transfer to Bob
    const result = await transferOwnershipViaAPI(
      request,
      roomCode,
      alice.userId,
      bob.userId
    );

    expect(result.status).toBe(403);
    expect(result.data.error).toContain('Only the session owner');
  });

  test('cannot transfer ownership to yourself', async ({ request }) => {
    const result = await transferOwnershipViaAPI(
      request,
      roomCode,
      creatorId,
      creatorId
    );

    expect(result.status).toBe(400);
    expect(result.data.error).toContain('already the session owner');
  });

  test('cannot transfer ownership to non-participant', async ({ request }) => {
    const fakeUserId = '00000000-0000-4000-8000-000000000000';

    const result = await transferOwnershipViaAPI(
      request,
      roomCode,
      creatorId,
      fakeUserId
    );

    expect(result.status).toBe(400);
    expect(result.data.error).toContain('must be a participant');
  });

  test('new owner sees creator UI, old owner loses it', async ({
    browser,
    request,
  }) => {
    const alice = await joinSessionViaAPI(request, roomCode, 'Alice');

    // Open both browsers
    const creator = await createCreatorContext(
      browser,
      roomCode,
      creatorId,
      'Creator'
    );
    const alicePage = await openBrowserAsUser(
      browser,
      roomCode,
      alice.userId,
      'Alice'
    );

    // The "Import CSV" sidebar button is creator-only (unlike "+ Create",
    // which any participant can use), so it tracks who holds ownership.
    await expect(
      creator.page.getByRole('button', { name: /Import CSV/ })
    ).toBeVisible(POLL_TIMEOUT);

    // Alice should NOT see the creator-only Import CSV button yet
    await expect(
      alicePage.page.getByRole('button', { name: /Import CSV/ })
    ).not.toBeVisible();

    // Transfer ownership to Alice via API
    await transferOwnershipViaAPI(request, roomCode, creatorId, alice.userId);

    // After a poll cycle, Alice should now see the creator-only button
    await expect(
      alicePage.page.getByRole('button', { name: /Import CSV/ })
    ).toBeVisible(POLL_TIMEOUT);

    // Creator should no longer see the creator-only button
    await expect(
      creator.page.getByRole('button', { name: /Import CSV/ })
    ).not.toBeVisible(POLL_TIMEOUT);

    await alicePage.context.close();
    await creator.context.close();
  });

  test('owner star indicator shown in participant list', async ({
    browser,
    request,
  }) => {
    await joinSessionViaAPI(request, roomCode, 'Alice');

    const creator = await createCreatorContext(
      browser,
      roomCode,
      creatorId,
      'Creator'
    );

    // The owner star character (★) should be visible in the sidebar
    await expect(creator.page.getByTitle('Session owner')).toBeVisible(
      POLL_TIMEOUT
    );

    await creator.context.close();
  });

  test('transfer button is visible for eligible participants', async ({
    browser,
    request,
  }) => {
    await joinSessionViaAPI(request, roomCode, 'Alice');

    const creator = await createCreatorContext(
      browser,
      roomCode,
      creatorId,
      'Creator'
    );

    // Creator (skipped) + Alice = 2 total, 1 active
    await expect(creator.page.getByText('[1/2]').first()).toBeVisible(
      POLL_TIMEOUT
    );

    // The transfer button (person icon SVG) should be visible for Alice in the sidebar
    // There should be exactly one transfer button (not for the creator themselves)
    // Hover-to-show requires forcing visibility — so we check it exists, not visibility.
    const transferButtons = creator.page.locator(
      'button[title="Transfer ownership"]'
    );
    await expect(transferButtons).toHaveCount(1, POLL_TIMEOUT);

    await creator.context.close();
  });
});

test.describe('Disabled User Protection', () => {
  let roomCode;
  let creatorId;

  test.beforeEach(async ({ request }) => {
    const session = await createSessionViaAPI(request, 'Creator');
    roomCode = session.roomCode;
    creatorId = session.creatorId;
    // Unskip creator and start session so turns are active
    await updateSessionViaAPI(request, roomCode, {
      skipped_participants: [],
    });
    await startSessionViaAPI(request, roomCode, creatorId);
  });

  test('disabled user cannot move tasks via API', async ({ request }) => {
    const alice = await joinSessionViaAPI(request, roomCode, 'Alice');

    // Give Alice the turn
    await endTurnViaAPI(request, roomCode, creatorId);
    const data = await getSessionViaAPI(request, roomCode);
    expect(data.session.current_turn_user_id).toBe(alice.userId);

    // Disable Alice
    await updateSessionViaAPI(request, roomCode, {
      skipped_participants: [alice.userId],
    });

    // Turn should have auto-advanced away from Alice
    const afterSkip = await getSessionViaAPI(request, roomCode);
    expect(afterSkip.session.current_turn_user_id).not.toBe(alice.userId);

    // Alice tries to move a task — should get 403
    const task = data.tasks[0];
    const result = await moveTaskRawViaAPI(
      request,
      roomCode,
      task.id,
      'some-column',
      alice.userId
    );

    expect(result.status).toBe(403);
  });

  test('all participants disabled shows warning banner and null turn', async ({
    browser,
    request,
  }) => {
    const creator = await createCreatorContext(
      browser,
      roomCode,
      creatorId,
      'Creator'
    );

    // Wait for initial load — session is started, creator has the turn
    await expect(creator.page.getByText('◆ Your turn')).toBeVisible(
      POLL_TIMEOUT
    );

    // Disable the only participant (the creator)
    await updateSessionViaAPI(request, roomCode, {
      skipped_participants: [creatorId],
    });

    // Should see the "all participants disabled" warning banner
    await expect(
      creator.page.getByText(/All participants disabled/i)
    ).toBeVisible(POLL_TIMEOUT);

    // The "Your turn" banner should be gone
    await expect(creator.page.getByText('◆ Your turn')).not.toBeVisible();

    // Verify via API that turn is null
    const data = await getSessionViaAPI(request, roomCode);
    expect(data.session.current_turn_user_id).toBeNull();

    await creator.context.close();
  });

  test('re-enabling a participant restores the turn', async ({ request }) => {
    // Disable creator (only participant)
    await updateSessionViaAPI(request, roomCode, {
      skipped_participants: [creatorId],
    });

    const disabledData = await getSessionViaAPI(request, roomCode);
    expect(disabledData.session.current_turn_user_id).toBeNull();

    // Re-enable creator
    await updateSessionViaAPI(request, roomCode, {
      skipped_participants: [],
    });

    const enabledData = await getSessionViaAPI(request, roomCode);
    expect(enabledData.session.current_turn_user_id).toBe(creatorId);
  });
});
