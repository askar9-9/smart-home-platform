import { expect, test } from '@playwright/test';
import { login } from './helpers';

test.describe('Devices and events', () => {
  test('changes an entity state and shows the event in the UI', async ({ page }) => {
    await login(page);

    await page.getByRole('link', { name: /Объекты/ }).click();
    await expect(page).toHaveURL(/\/entities$/);
    await expect(page.getByRole('heading', { name: 'Объекты' })).toBeVisible();

    await page.getByLabel('Тип').selectOption('light');
    await page.getByRole('button', { name: 'Переключить Hallway Light' }).click();

    await page.getByRole('link', { name: /События/ }).click();
    await expect(page).toHaveURL(/\/events$/);
    await page.getByLabel('Фильтр по объекту').fill('light.hallway');

    await expect(page.getByRole('cell', { name: 'light.hallway' }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: 'user' }).first()).toBeVisible();
  });
});
