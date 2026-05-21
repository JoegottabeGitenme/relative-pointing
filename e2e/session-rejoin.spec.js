const { test, expect } = require('@playwright/test');
const { POLL_TIMEOUT, createSessionViaAPI } = require('./helpers/test-helpers');

test.describe('Session Rejoin', () => {
  test('entering a session caches it and the landing page offers to rejoin', async ({
    page,
  }) => {
    // Create a session — TaskBoard.onMounted writes lastSession to localStorage
    await page.goto('/');
    await page.getByPlaceholder('Type a name…').fill('Maya');
    await page.getByRole('button', { name: /Create session/i }).click();
    await expect(page).toHaveURL(/\/session\/.+/);
    await page.waitForTimeout(500);

    const roomCode = page.url().split('/session/')[1];

    // Verify the cache entry has the right shape
    const cached = await page.evaluate(() =>
      localStorage.getItem('lastSession')
    );
    expect(cached).toBeTruthy();
    const parsed = JSON.parse(cached);
    expect(parsed.roomCode).toBe(roomCode);
    expect(typeof parsed.savedAt).toBe('number');

    // Visit the landing — pill should appear after the existence check
    await page.goto('/');
    await expect(page.getByText('Pick up where you left off')).toBeVisible(
      POLL_TIMEOUT
    );
    await expect(page.getByText(`RP/${roomCode}`)).toBeVisible();

    // Click Rejoin → back on the board
    await page.getByRole('button', { name: /Rejoin/ }).click();
    await expect(page).toHaveURL(`/session/${roomCode}`);
  });

  test('logout clears the rejoin cache', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('Type a name…').fill('Maya');
    await page.getByRole('button', { name: /Create session/i }).click();
    await expect(page).toHaveURL(/\/session\/.+/);
    await page.waitForTimeout(400);

    // Cache should exist
    expect(
      await page.evaluate(() => localStorage.getItem('lastSession'))
    ).toBeTruthy();

    // Logout
    await page.getByRole('button', { name: 'Logout' }).click();
    await page.waitForTimeout(500);

    // Cache cleared, no pill
    expect(
      await page.evaluate(() => localStorage.getItem('lastSession'))
    ).toBeNull();
    await expect(
      page.getByText('Pick up where you left off')
    ).not.toBeVisible();
  });

  test('cached session that no longer exists is silently dropped', async ({
    page,
  }) => {
    await page.goto('/');
    // Seed a fake but well-formed cache entry — no such session on the backend
    await page.evaluate(() => {
      localStorage.setItem(
        'lastSession',
        JSON.stringify({ roomCode: 'ghost-tiger', savedAt: Date.now() })
      );
    });
    await page.reload();
    await page.waitForTimeout(800);

    // Pill never appears, stale cache is auto-cleared
    await expect(
      page.getByText('Pick up where you left off')
    ).not.toBeVisible();
    expect(
      await page.evaluate(() => localStorage.getItem('lastSession'))
    ).toBeNull();
  });

  test('stale cache (>30 min old) is rejected', async ({ page, request }) => {
    // Create a real session so its room code is valid and reachable
    const session = await createSessionViaAPI(request, 'Maya');

    await page.goto('/');
    await page.evaluate((rc) => {
      const stale = Date.now() - 31 * 60 * 1000;
      localStorage.setItem(
        'lastSession',
        JSON.stringify({ roomCode: rc, savedAt: stale })
      );
    }, session.roomCode);
    await page.reload();
    await page.waitForTimeout(800);

    await expect(
      page.getByText('Pick up where you left off')
    ).not.toBeVisible();
    expect(
      await page.evaluate(() => localStorage.getItem('lastSession'))
    ).toBeNull();
  });

  test('tampered cache is rejected', async ({ page }) => {
    await page.goto('/');
    // Garbage shapes / bad room codes — all should be rejected
    const tamperedValues = [
      'not-json',
      JSON.stringify({ roomCode: '../../etc/passwd', savedAt: Date.now() }),
      JSON.stringify({ roomCode: 'javascript:alert(1)', savedAt: Date.now() }),
      JSON.stringify({ roomCode: 'noroom', savedAt: 'not-a-number' }),
    ];

    for (const v of tamperedValues) {
      await page.evaluate((val) => {
        localStorage.setItem('lastSession', val);
      }, v);
      await page.reload();
      await page.waitForTimeout(400);
      await expect(
        page.getByText('Pick up where you left off')
      ).not.toBeVisible();
    }
  });

  test('rejoin pill yields to an explicit ?join=… deep link', async ({
    page,
    request,
  }) => {
    // Cache one session, deep-link to another
    const cachedSession = await createSessionViaAPI(request, 'CachedHost');
    const targetSession = await createSessionViaAPI(request, 'DeepLinkHost');

    await page.goto('/');
    await page.evaluate((rc) => {
      localStorage.setItem(
        'lastSession',
        JSON.stringify({ roomCode: rc, savedAt: Date.now() })
      );
    }, cachedSession.roomCode);

    await page.goto(`/?join=${targetSession.roomCode}`);
    await page.waitForTimeout(800);

    // Pill should NOT appear — the deep link wins
    await expect(
      page.getByText('Pick up where you left off')
    ).not.toBeVisible();

    // Join form is pre-filled with the deep-linked code, not the cached one
    await expect(page.getByPlaceholder('adjective-animal')).toHaveValue(
      targetSession.roomCode
    );
  });
});
