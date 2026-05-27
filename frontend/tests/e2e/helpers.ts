import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export async function login(page: Page) {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Войти' })).toBeVisible();

  await page.getByLabel('Логин').fill('testadmin');
  await page.getByLabel('Пароль').fill('testpass123');
  await page.getByRole('button', { name: 'Войти' }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
}
