import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Integration } from '../../src/api/types';
import { IntegrationsPage } from '../../src/pages/IntegrationsPage';
import { renderApp } from './test-utils';

const { listIntegrationsMock, updateIntegrationMock, removeIntegrationMock, discoverIntegrationMock, importIntegrationMock, createIntegrationMock } = vi.hoisted(() => ({
  listIntegrationsMock: vi.fn(),
  updateIntegrationMock: vi.fn(),
  removeIntegrationMock: vi.fn(),
  discoverIntegrationMock: vi.fn(),
  importIntegrationMock: vi.fn(),
  createIntegrationMock: vi.fn(),
}));

vi.mock('../../src/api', async () => {
  const actual = await vi.importActual<typeof import('../../src/api')>('../../src/api');
  return {
    ...actual,
    integrationsApi: {
      ...actual.integrationsApi,
      list: listIntegrationsMock,
      update: updateIntegrationMock,
      remove: removeIntegrationMock,
      discover: discoverIntegrationMock,
      import: importIntegrationMock,
      create: createIntegrationMock,
    },
  };
});

describe('IntegrationsPage', () => {
  beforeEach(() => {
    let integrations: Integration[] = [
      {
        id: 'int-1',
        name: 'Hub A',
        domain: 'demo',
        config: { room: 'hallway' },
        device_count: 0,
        created_at: '2026-05-21T00:00:00Z',
      },
    ];

    listIntegrationsMock.mockReset();
    updateIntegrationMock.mockReset();
    removeIntegrationMock.mockReset();
    discoverIntegrationMock.mockReset();
    importIntegrationMock.mockReset();
    createIntegrationMock.mockReset();

    listIntegrationsMock.mockImplementation(async () => integrations);
    updateIntegrationMock.mockImplementation(async (id: string, payload: { name: string; config: Record<string, unknown> }) => {
      integrations = integrations.map((integration) => integration.id === id ? { ...integration, ...payload } : integration);
      return integrations[0];
    });
    removeIntegrationMock.mockResolvedValue(undefined);
    discoverIntegrationMock.mockResolvedValue([]);
    importIntegrationMock.mockResolvedValue({ integration_id: 'int-1', imported: 0, skipped: [], devices: [] });
    createIntegrationMock.mockResolvedValue({});
  });

  it('validates config JSON and refreshes the list after update', async () => {
    const user = userEvent.setup();
    renderApp(<IntegrationsPage />);

    await waitFor(() => expect(screen.getByText('Hub A')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Редактировать' }));
    await user.clear(screen.getByLabelText('Название интеграции'));
    await user.type(screen.getByLabelText('Название интеграции'), 'Updated Hub');
    fireEvent.change(screen.getByLabelText('Конфигурация интеграции JSON'), { target: { value: '{bad json' } });
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(await screen.findByText('Конфигурация должна быть валидным JSON')).toBeInTheDocument();
    expect(updateIntegrationMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Конфигурация интеграции JSON'), { target: { value: '{"room":"office"}' } });
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(updateIntegrationMock).toHaveBeenCalledWith('int-1', {
      name: 'Updated Hub',
      config: { room: 'office' },
    }));
    await waitFor(() => expect(listIntegrationsMock.mock.calls.length).toBeGreaterThan(1));
    await waitFor(() => expect(screen.getByText('Updated Hub')).toBeInTheDocument());
  });
});
