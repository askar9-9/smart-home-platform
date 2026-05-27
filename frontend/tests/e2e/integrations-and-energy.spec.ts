import { expect, test } from '@playwright/test';
import { login } from './helpers';

test.describe('Integrations and energy', () => {
  test('creates an MQTT integration, opens discovery, and loads the energy page', async ({ page }) => {
    await login(page);

    await page.getByRole('link', { name: /Интеграции/ }).click();
    await expect(page).toHaveURL(/\/integrations$/);
    await expect(page.getByRole('heading', { name: 'Интеграции' })).toBeVisible();

    const integrationName = `Browser MQTT ${Date.now()}`;
    await page.getByRole('button', { name: /^Добавить$/ }).click();
    await page.getByLabel('Название').fill(integrationName);
    await expect(page.getByLabel('Домен')).toHaveValue('mqtt');
    await page.getByRole('button', { name: 'Создать' }).click();

    const integrationTitle = page.locator('div.font-semibold').filter({ hasText: integrationName });
    await expect(integrationTitle).toBeVisible();
    await page.getByRole('button', { name: 'Обнаружение' }).last().click();

    await expect(page.getByText(/Обнаруженные устройства/)).toBeVisible();
    await expect(page.getByText('MQTT Living Room Strip')).toBeVisible();
    await page.getByRole('button', { name: 'Импортировать все' }).click();
    await expect(page.getByText(/Импортировано:/)).toBeVisible();

    await page.getByRole('link', { name: /Устройства/ }).click();
    await expect(page).toHaveURL(/\/devices$/);
    await expect(page.getByText('MQTT Living Room Strip')).toBeVisible();

    await page.getByRole('link', { name: /Энергия/ }).click();
    await expect(page).toHaveURL(/\/energy$/);
    await expect(page.getByRole('heading', { name: 'Энергия' })).toBeVisible();
    await expect(page.getByText('Всего за период')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Потребление' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Топ потребителей' })).toBeVisible();
  });
});
