const { test, expect } = require('@playwright/test');

const API_URL = `http://localhost:${process.env.PORT || 5001}/api`;

test.describe('Join Session', () => {
  let roomCode;

  test.beforeEach(async ({ request }) => {
    // Create a session via API so we have a room code to join
    const response = await request.post(`${API_URL}/sessions`, {
      data: {
        creatorId: '00000000-0000-0000-0000-000000000001',
        creatorName: 'Creator',
      },
    });
    const data = await response.json();
    roomCode = data.roomCode;
  });

  test('join an existing session via UI', async ({ page }) => {
    await page.goto('/');

    // Switch to join tab
    await page.getByText('↩ Join session').click();

    await page.getByPlaceholder('Type a name…').fill('Joiner');
    await page.getByPlaceholder('adjective-animal').fill(roomCode);

    // Use the submit button inside the form
    await page
      .locator('form')
      .getByRole('button', { name: /Join session/i })
      .click();

    // Should navigate to the session page
    await expect(page).toHaveURL(`/session/${roomCode}`);
    await expect(page.getByText(`RP/${roomCode}`).first()).toBeVisible();
  });

  test('shows error on invalid room code', async ({ page }) => {
    await page.goto('/');

    // Switch to join tab
    await page.getByText('↩ Join session').click();

    await page.getByPlaceholder('Type a name…').fill('Joiner');
    await page.getByPlaceholder('adjective-animal').fill('nonexistent-code');

    await page
      .locator('form')
      .getByRole('button', { name: /Join session/i })
      .click();

    // Error message should appear (we render any error from the API in the form)
    await expect(
      page.getByText(/failed to join|not found|invalid/i)
    ).toBeVisible();
  });

  test('join button is disabled without name and room code', async ({
    page,
  }) => {
    await page.goto('/');

    await page.getByText('↩ Join session').click();

    const joinButton = page
      .locator('form')
      .getByRole('button', { name: /Join session/i });
    await expect(joinButton).toBeDisabled();
  });
});
