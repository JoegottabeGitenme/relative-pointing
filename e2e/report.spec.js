const { test, expect } = require('@playwright/test');
const {
  API_URL,
  createSessionViaAPI,
  joinSessionViaAPI,
  getSessionViaAPI,
  updateSessionViaAPI,
  createTaskViaAPI,
  deleteTaskViaAPI,
} = require('./helpers/test-helpers');

const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function clearSampleTasks(request, roomCode) {
  const data = await getSessionViaAPI(request, roomCode);
  for (const task of data.tasks) {
    await deleteTaskViaAPI(request, roomCode, task.id);
  }
}

async function addCommentViaAPI(request, roomCode, taskId, user, content) {
  const response = await request.post(
    `${API_URL}/sessions/${roomCode}/tasks/${taskId}/comments`,
    {
      headers: JSON_HEADERS,
      data: { userId: user.userId, userName: user.userName, content },
    }
  );
  return response.json();
}

async function endSessionViaAPI(request, roomCode, userId) {
  const response = await request.post(`${API_URL}/sessions/${roomCode}/end`, {
    headers: JSON_HEADERS,
    data: { userId },
  });
  return response.json();
}

async function getReportViaAPI(request, roomCode) {
  const response = await request.get(`${API_URL}/sessions/${roomCode}/report`);
  return { status: response.status(), data: await response.json() };
}

// Report payload backs three report-page features: jira ticket hyperlinks
// (display_id + session.jira_base_url), per-task comments display, and the
// hide toggles (which only need stable task ids client-side).
test.describe('Session Report', () => {
  test('nests comments per task in report order', async ({ request }) => {
    const session = await createSessionViaAPI(request, 'Creator');
    const { roomCode, creatorId } = session;
    const alice = await joinSessionViaAPI(request, roomCode, 'Alice');
    await clearSampleTasks(request, roomCode);
    await createTaskViaAPI(request, roomCode, 'REP-1', 'Reportable task');

    const before = await getSessionViaAPI(request, roomCode);
    const task = before.tasks[0];

    await addCommentViaAPI(request, roomCode, task.id, alice, 'First comment');
    await addCommentViaAPI(request, roomCode, task.id, alice, 'Second comment');

    await endSessionViaAPI(request, roomCode, creatorId);

    const { status, data } = await getReportViaAPI(request, roomCode);
    expect(status).toBe(200);

    const reported = data.tasks.find((t) => t.id === task.id);
    expect(reported).toBeTruthy();
    expect(reported.comments).toHaveLength(2);
    expect(reported.comments.map((c) => c.content)).toEqual([
      'First comment',
      'Second comment',
    ]);
    expect(reported.comments[0].user_name).toBe('Alice');
  });

  test('returns an empty comments array for tasks with no comments', async ({
    request,
  }) => {
    const session = await createSessionViaAPI(request, 'Creator');
    const { roomCode, creatorId } = session;
    await clearSampleTasks(request, roomCode);
    await createTaskViaAPI(request, roomCode, 'REP-2', 'Quiet task');

    await endSessionViaAPI(request, roomCode, creatorId);

    const { data } = await getReportViaAPI(request, roomCode);
    const reported = data.tasks.find((t) => t.display_id === 'REP-2');
    expect(reported).toBeTruthy();
    expect(reported.comments).toEqual([]);
  });

  test('exposes jira_base_url and display_id for ticket hyperlinks', async ({
    request,
  }) => {
    const session = await createSessionViaAPI(request, 'Creator');
    const { roomCode, creatorId } = session;
    await clearSampleTasks(request, roomCode);
    await createTaskViaAPI(request, roomCode, 'PROJ-42', 'Linkable task');

    await updateSessionViaAPI(request, roomCode, {
      jira_base_url: 'https://example.atlassian.net',
    });

    await endSessionViaAPI(request, roomCode, creatorId);

    const { data } = await getReportViaAPI(request, roomCode);
    expect(data.session.jira_base_url).toBe('https://example.atlassian.net');

    // display_id falls back to the jira_key, which is what the report links on.
    const reported = data.tasks.find((t) => t.display_id === 'PROJ-42');
    expect(reported).toBeTruthy();
  });

  test('is unavailable until the session has ended', async ({ request }) => {
    const session = await createSessionViaAPI(request, 'Creator');
    const { roomCode } = session;

    const { status } = await getReportViaAPI(request, roomCode);
    expect(status).toBe(400);
  });
});
