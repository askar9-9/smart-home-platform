import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Integration } from '../../src/api/types';
import { IntegrationsPage } from '../../src/pages/IntegrationsPage';
import { renderApp } from './test-utils';

const { listIntegrationsMock, updateIntegrationMock, removeIntegrationMock, discoverIntegrationMock, importIntegrationMock, createIntegrationMock, createMqttDeviceMock, listAreasMock } = vi.hoisted(() => ({
  listIntegrationsMock: vi.fn(),
  updateIntegrationMock: vi.fn(),
  removeIntegrationMock: vi.fn(),
  discoverIntegrationMock: vi.fn(),
  importIntegrationMock: vi.fn(),
  createIntegrationMock: vi.fn(),
  createMqttDeviceMock: vi.fn(),
  listAreasMock: vi.fn(),
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
      createMqttDevice: createMqttDeviceMock,
    },
    areasApi: {
      ...actual.areasApi,
      list: listAreasMock,
    },
  };
});

describe('IntegrationsPage', () => {
  beforeEach(() => {
    let integrations: Integration[] = [
      {
        id: 'int-1',
        name: 'Hub A',
        domain: 'mqtt',
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
    createMqttDeviceMock.mockReset();
    listAreasMock.mockReset();

    listIntegrationsMock.mockImplementation(async () => integrations);
    updateIntegrationMock.mockImplementation(async (id: string, payload: { name: string; config: Record<string, unknown> }) => {
      integrations = integrations.map((integration) => integration.id === id ? { ...integration, ...payload } : integration);
      return integrations[0];
    });
    removeIntegrationMock.mockResolvedValue(undefined);
    discoverIntegrationMock.mockResolvedValue([]);
    importIntegrationMock.mockResolvedValue({ integration_id: 'int-1', imported: 0, skipped: [], devices: [] });
    createIntegrationMock.mockResolvedValue({});
    createMqttDeviceMock.mockResolvedValue({});
    listAreasMock.mockResolvedValue([{ id: 'area-1', name: 'Hallway' }]);
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

  it('defaults new integrations to mqtt for the live demo flow', async () => {
    const user = userEvent.setup();
    renderApp(<IntegrationsPage />);

    await waitFor(() => expect(screen.getByText('Hub A')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Добавить' }));

    expect(screen.getByLabelText('Домен')).toHaveValue('mqtt');
    expect(screen.getByText(/Для live demo рекомендуем MQTT/)).toBeInTheDocument();
  });

  it('creates a custom MQTT device from the constructor', async () => {
    const user = userEvent.setup();
    renderApp(<IntegrationsPage />);

    await waitFor(() => expect(screen.getByText('Hub A')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Добавить MQTT устройство' }));
    await waitFor(() => expect(screen.getByText('MQTT конструктор устройства')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Заполнить topics' }));
    await user.click(screen.getByRole('button', { name: 'Создать MQTT устройство' }));

    await waitFor(() =>
      expect(createMqttDeviceMock).toHaveBeenCalledWith(
        'int-1',
        expect.objectContaining({
          name: 'Presentation Lamp',
          type: 'light',
          entities: [
            expect.objectContaining({
              entity_id: 'light.presentation_lamp',
              state_topic: 'home/custom/presentation_lamp/state',
              command_topic: 'home/custom/presentation_lamp/set',
            }),
          ],
        })
      )
    );
  });
});
