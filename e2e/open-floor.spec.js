const crypto = require('crypto');
const { test, expect } = require('@playwright/test');
const {
  createSessionViaAPI,
  joinSessionViaAPI,
  getSessionViaAPI,
  updateSessionViaAPI,
  startSessionViaAPI,
  createTaskViaAPI,
  createColumnViaAPI,
  deleteTaskViaAPI,
  moveTaskViaAPI,
  moveTaskRawViaAPI,
} = require('./helpers/test-helpers');

// columns.id carries a global UNIQUE constraint and the test DB persists
// across runs — generate a fresh id per call so repeated/parallel runs don't
// collide on the same identifier.
const colId = (label) => `col-${label}-${crypto.randomUUID()}`;

// Strip the seeded sample tasks so each test starts from a known board shape.
async function clearSampleTasks(request, roomCode) {
  const data = await getSessionViaAPI(request, roomCode);
  for (const task of data.tasks) {
    await deleteTaskViaAPI(request, roomCode, task.id);
  }
}

// Open-floor mode: once every task has been pointed (no unsorted tasks remain
// in a running, not-yet-ended session), turn enforcement is dropped so any
// non-skipped participant can adjust placements before the report is generated.
test.describe('Open Floor Mode', () => {
  let roomCode;
  let creatorId;
  let alice;
  let bob;

  test.beforeEach(async ({ request }) => {
    const session = await createSessionViaAPI(request, 'Creator');
    roomCode = session.roomCode;
    creatorId = session.creatorId;
    // The creator is auto-skipped on creation, so the turn rotation is driven
    // by the joining participants. Alice joins first → she holds the turn.
    alice = await joinSessionViaAPI(request, roomCode, 'Alice');
    bob = await joinSessionViaAPI(request, roomCode, 'Bob');
    await clearSampleTasks(request, roomCode);
  });

  test('enforces turns while unsorted tasks remain', async ({ request }) => {
    const colA = colId('a');
    await createColumnViaAPI(request, roomCode, colA, 'A', 1);
    await createTaskViaAPI(request, roomCode, 'OF-1', 'Task one');
    await createTaskViaAPI(request, roomCode, 'OF-2', 'Task two');

    await startSessionViaAPI(request, roomCode, creatorId);

    const data = await getSessionViaAPI(request, roomCode);
    expect(data.session.current_turn_user_id).toBe(alice.userId);
    const [task] = data.tasks;

    // Two tasks are still unsorted — the floor is closed, so only the turn
    // holder may move tasks.
    const bobMove = await moveTaskRawViaAPI(
      request,
      roomCode,
      task.id,
      colA,
      bob.userId
    );
    expect(bobMove.status).toBe(403);

    const aliceMove = await moveTaskRawViaAPI(
      request,
      roomCode,
      task.id,
      colA,
      alice.userId
    );
    expect(aliceMove.status).toBe(200);
  });

  test('opens the floor to everyone once all tasks are pointed', async ({
    request,
  }) => {
    const colA = colId('a');
    const colB = colId('b');
    await createColumnViaAPI(request, roomCode, colA, 'A', 1);
    await createColumnViaAPI(request, roomCode, colB, 'B', 2);
    await createTaskViaAPI(request, roomCode, 'OF-1', 'Task one');
    await createTaskViaAPI(request, roomCode, 'OF-2', 'Task two');

    await startSessionViaAPI(request, roomCode, creatorId);

    let data = await getSessionViaAPI(request, roomCode);
    const [t1, t2] = data.tasks;

    // Alice (the turn holder) points both tasks, emptying the queue.
    await moveTaskViaAPI(request, roomCode, t1.id, colA, alice.userId);
    await moveTaskViaAPI(request, roomCode, t2.id, colA, alice.userId);

    // Floor is now open: Bob, who never held the turn, can rearrange.
    const bobMove = await moveTaskRawViaAPI(
      request,
      roomCode,
      t1.id,
      colB,
      bob.userId
    );
    expect(bobMove.status).toBe(200);

    data = await getSessionViaAPI(request, roomCode);
    const moved = data.tasks.find((t) => t.id === t1.id);
    expect(moved.column_id).toBe(colB);
  });

  test('still blocks skipped participants on an open floor', async ({
    request,
  }) => {
    const colA = colId('a');
    const colB = colId('b');
    await createColumnViaAPI(request, roomCode, colA, 'A', 1);
    await createColumnViaAPI(request, roomCode, colB, 'B', 2);
    await createTaskViaAPI(request, roomCode, 'OF-1', 'Task one');

    await startSessionViaAPI(request, roomCode, creatorId);

    const data = await getSessionViaAPI(request, roomCode);
    const t1 = data.tasks[0];

    // Point the only task → open floor.
    await moveTaskViaAPI(request, roomCode, t1.id, colA, alice.userId);

    // Skip Bob. He is blocked even though the floor is open.
    await updateSessionViaAPI(request, roomCode, {
      skipped_participants: [creatorId, bob.userId],
    });

    const bobMove = await moveTaskRawViaAPI(
      request,
      roomCode,
      t1.id,
      colB,
      bob.userId
    );
    expect(bobMove.status).toBe(403);

    // Alice is not skipped, so she can still adjust placements.
    const aliceMove = await moveTaskRawViaAPI(
      request,
      roomCode,
      t1.id,
      colB,
      alice.userId
    );
    expect(aliceMove.status).toBe(200);
  });

  test('closes the floor again when a task returns to the queue', async ({
    request,
  }) => {
    const colA = colId('a');
    await createColumnViaAPI(request, roomCode, colA, 'A', 1);
    await createTaskViaAPI(request, roomCode, 'OF-1', 'Task one');

    await startSessionViaAPI(request, roomCode, creatorId);

    const data = await getSessionViaAPI(request, roomCode);
    const t1 = data.tasks[0];

    // Point it → open floor → Bob can move it.
    await moveTaskViaAPI(request, roomCode, t1.id, colA, alice.userId);
    const openMove = await moveTaskRawViaAPI(
      request,
      roomCode,
      t1.id,
      colA,
      bob.userId
    );
    expect(openMove.status).toBe(200);

    // Send it back to the queue — the floor closes and turns re-apply.
    await moveTaskViaAPI(request, roomCode, t1.id, 'unsorted', alice.userId);
    const closedMove = await moveTaskRawViaAPI(
      request,
      roomCode,
      t1.id,
      colA,
      bob.userId
    );
    expect(closedMove.status).toBe(403);
  });
});
