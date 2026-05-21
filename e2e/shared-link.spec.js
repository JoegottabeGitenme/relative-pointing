const { test, expect } = require('@playwright/test');
const {
  createSessionViaAPI,
  createUserContext,
  POLL_TIMEOUT,
} = require('./helpers/test-helpers');

test.describe('Shared Link Flow', () => {
  let roomCode;

  test.beforeEach(async ({ request }) => {
    const session = await createSessionViaAPI(request, 'Creator');
    roomCode = session.roomCode;
  });

  test('unauthenticated user visiting /session/:roomCode redirects to join page with code pre-filled', async ({
    page,
  }) => {
    // Visit the session URL directly (no localStorage auth)
    await page.goto(`/session/${roomCode}`);

    // Should redirect to /?join=roomCode
    await expect(page).toHaveURL(`/?join=${roomCode}`);

    // Room code input should be pre-filled (proves the join tab is active)
    const roomCodeInput = page.getByPlaceholder('adjective-animal');
    await expect(roomCodeInput).toHaveValue(roomCode);
  });

  test('user can complete join flow from the redirected page', async ({
    page,
  }) => {
    await page.goto(`/session/${roomCode}`);
    await expect(page).toHaveURL(`/?join=${roomCode}`);

    // Fill in name and submit
    await page.getByPlaceholder('Type a name…').fill('SharedLinkUser');
    await page
      .locator('form')
      .getByRole('button', { name: /Join session/i })
      .click();

    // Should navigate to the session board
    await expect(page).toHaveURL(`/session/${roomCode}`);
    await expect(page.getByText(`RP/${roomCode}`).first()).toBeVisible(
      POLL_TIMEOUT
    );
  });

  test('authenticated user accesses session directly without redirect', async ({
    browser,
    request,
  }) => {
    const { context, page, userId } = await createUserContext(
      browser,
      'AuthUser'
    );

    // Join via API so the user is a valid participant
    await request.post(
      `http://localhost:${process.env.PORT || 5001}/api/sessions/${roomCode}/join`,
      {
        headers: { 'Content-Type': 'application/json' },
        data: { userId, userName: 'AuthUser' },
      }
    );

    await page.goto(`/session/${roomCode}`);

    // Should NOT redirect — stays on the session page
    await expect(page).toHaveURL(`/session/${roomCode}`);
    await expect(page.getByText(`RP/${roomCode}`).first()).toBeVisible(
      POLL_TIMEOUT
    );

    await context.close();
  });
});
