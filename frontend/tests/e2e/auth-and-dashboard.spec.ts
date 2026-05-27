import { expect, test } from '@playwright/test';
import { login } from './helpers';

test.describe('Auth and dashboard', () => {
  test('logs in and shows the live dashboard shell', async ({ page }) => {
    await login(page);

    await expect(page.getByRole('heading', { name: 'homeIQ Demo Home' })).toBeVisible();
    await expect(page.getByRole('main').getByText('Устройства')).toBeVisible();
    await expect(page.getByRole('main').getByText('Текущая мощность')).toBeVisible();
    await expect(
      page.locator('header span').filter({ hasText: /Подключено|Синхронизация…|Нет связи/ }).first(),
    ).toBeVisible();

    await page.getByRole('link', { name: /Зоны/ }).click();
    await expect(page).toHaveURL(/\/areas$/);
    await expect(page.getByRole('heading', { name: 'Зоны' })).toBeVisible();
  });
});
