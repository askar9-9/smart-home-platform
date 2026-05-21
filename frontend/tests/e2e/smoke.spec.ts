import { test, expect } from '@playwright/test';

test.describe('MVP smoke', () => {
  test('logs in, loads seeded dashboard, and opens a protected screen', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Войти' })).toBeVisible();

    await page.getByLabel('Логин').fill('testadmin');
    await page.getByLabel('Пароль').fill('testpass123');
    await page.getByRole('button', { name: 'Войти' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: 'Smart Home' })).toBeVisible();
    await expect(page.getByRole('main').getByText('Устройства')).toBeVisible();
    await expect(page.getByText(/Текущая мощность/)).toBeVisible();

    await page.getByRole('link', { name: /Устройства/ }).click();
    await expect(page).toHaveURL(/\/devices$/);
    await expect(page.getByRole('heading', { name: 'Устройства' })).toBeVisible();

    await page.getByRole('link', { name: /ML Аномалии/ }).click();
    await expect(page).toHaveURL(/\/ml\/anomalies$/);
    await expect(page.getByRole('heading', { name: 'ML Аномалии' })).toBeVisible();
  });
});
