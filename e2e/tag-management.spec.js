const { test, expect } = require('@playwright/test');
const {
  createSessionViaAPI,
  getSessionViaAPI,
  createCreatorContext,
  POLL_TIMEOUT,
} = require('./helpers/test-helpers');

test.describe('Tag Management', () => {
  let roomCode, creatorId;

  test.beforeEach(async ({ request }) => {
    const session = await createSessionViaAPI(request, 'Leader');
    roomCode = session.roomCode;
    creatorId = session.creatorId;
  });

  test('selecting a tag in modal shows it as selected with checkmark', async ({
    browser,
  }) => {
    const creator = await createCreatorContext(
      browser,
      roomCode,
      creatorId,
      'Leader'
    );
    const { page } = creator;

    // Wait for tasks to load
    await expect(page.getByText('PROJ-123').first()).toBeVisible(POLL_TIMEOUT);

    // Open tag modal on the first task via gear icon
    const taskCard = page
      .locator('div.group')
      .filter({ hasText: 'PROJ-123' })
      .first();
    const gearButton = taskCard.locator('button[title="Task settings"]');
    await gearButton.click({ force: true });

    // Switch to Tags tab
    await page.getByRole('button', { name: 'Tags' }).click();

    // Scope to the modal so we don't match the tag pills on every task card
    const modal = page.locator('.fixed.inset-0').first();

    // The task should already have "Ready for Dev" tag (auto-assigned)
    // Verify the checkmark is visible for the selected tag
    const readyForDevButton = modal
      .locator('button')
      .filter({ hasText: 'Ready for Dev' });
    await expect(readyForDevButton).toBeVisible();
    await expect(readyForDevButton.locator('text=✓')).toBeVisible();

    // Select "Blocked" tag instead
    const blockedButton = modal
      .locator('button')
      .filter({ hasText: 'Blocked' });
    await blockedButton.click();

    // "Blocked" should now show checkmark
    await expect(blockedButton.locator('text=✓')).toBeVisible();

    // "Ready for Dev" should no longer show checkmark
    await expect(readyForDevButton.locator('text=✓')).not.toBeVisible();

    await creator.context.close();
  });

  test('selected tag has ring styling to indicate selection', async ({
    browser,
  }) => {
    const creator = await createCreatorContext(
      browser,
      roomCode,
      creatorId,
      'Leader'
    );
    const { page } = creator;

    await expect(page.getByText('PROJ-123').first()).toBeVisible(POLL_TIMEOUT);

    // Open tag modal
    const taskCard = page
      .locator('div.group')
      .filter({ hasText: 'PROJ-123' })
      .first();
    const gearButton = taskCard.locator('button[title="Task settings"]');
    await gearButton.click({ force: true });
    await page.getByRole('button', { name: 'Tags' }).click();

    // Scope to the modal — task cards also have tag-pill buttons with the same text
    const modal = page.locator('.fixed.inset-0').first();

    // "Ready for Dev" should have data-active="true" (active state)
    const readyForDevButton = modal
      .locator('button')
      .filter({ hasText: 'Ready for Dev' });
    await expect(readyForDevButton).toHaveAttribute('data-active', 'true');

    // "Blocked" should NOT be active
    const blockedButton = modal
      .locator('button')
      .filter({ hasText: 'Blocked' });
    await expect(blockedButton).not.toHaveAttribute('data-active', 'true');

    await creator.context.close();
  });

  test('clearing a tag removes selection indicators', async ({ browser }) => {
    const creator = await createCreatorContext(
      browser,
      roomCode,
      creatorId,
      'Leader'
    );
    const { page } = creator;

    await expect(page.getByText('PROJ-123').first()).toBeVisible(POLL_TIMEOUT);

    // Open tag modal
    const taskCard = page
      .locator('div.group')
      .filter({ hasText: 'PROJ-123' })
      .first();
    const gearButton = taskCard.locator('button[title="Task settings"]');
    await gearButton.click({ force: true });
    await page.getByRole('button', { name: 'Tags' }).click();

    // Verify a tag is selected (checkmark visible)
    const readyForDevButton = page
      .locator('button')
      .filter({ hasText: 'Ready for Dev' });
    await expect(readyForDevButton.locator('text=✓')).toBeVisible();

    // Clear the tag
    await page.getByRole('button', { name: 'Clear tag' }).click();

    // No checkmarks should be visible on any tag
    await expect(readyForDevButton.locator('text=✓')).not.toBeVisible();

    // "Clear tag" link should disappear
    await expect(
      page.getByRole('button', { name: 'Clear tag' })
    ).not.toBeVisible();

    await creator.context.close();
  });

  test('switching tag updates selection immediately in modal', async ({
    browser,
  }) => {
    const creator = await createCreatorContext(
      browser,
      roomCode,
      creatorId,
      'Leader'
    );
    const { page } = creator;

    await expect(page.getByText('PROJ-123').first()).toBeVisible(POLL_TIMEOUT);

    // Open tag modal
    const taskCard = page
      .locator('div.group')
      .filter({ hasText: 'PROJ-123' })
      .first();
    const gearButton = taskCard.locator('button[title="Task settings"]');
    await gearButton.click({ force: true });
    await page.getByRole('button', { name: 'Tags' }).click();

    // Scope locators to the modal dialog
    const modal = page.locator('.fixed.inset-0').first();

    // Switch through tags — start with one that isn't already selected
    const tags = ['Needs Updates', 'Blocked', 'Ready for Dev'];
    for (const tagName of tags) {
      const tagButton = modal.locator('button').filter({ hasText: tagName });
      await tagButton.click();
      await expect(tagButton.locator('text=✓')).toBeVisible();
      await expect(tagButton).toHaveAttribute('data-active', 'true');

      // Other tags should not be selected
      for (const otherTag of tags.filter((t) => t !== tagName)) {
        const otherButton = modal
          .locator('button')
          .filter({ hasText: otherTag });
        await expect(otherButton.locator('text=✓')).not.toBeVisible();
      }
    }

    await creator.context.close();
  });
});
