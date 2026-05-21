import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Device } from '../../src/api/types';
import { DeviceDetailPage } from '../../src/pages/DeviceDetailPage';
import { DevicesPage } from '../../src/pages/DevicesPage';
import { renderApp } from './test-utils';

const {
  listDevicesMock,
  createDeviceMock,
  getDeviceMock,
  updateDeviceMock,
  removeDeviceMock,
  listAreasMock,
  historyMock,
} = vi.hoisted(() => ({
  listDevicesMock: vi.fn(),
  createDeviceMock: vi.fn(),
  getDeviceMock: vi.fn(),
  updateDeviceMock: vi.fn(),
  removeDeviceMock: vi.fn(),
  listAreasMock: vi.fn(),
  historyMock: vi.fn(),
}));

vi.mock('../../src/features/devices/api', () => ({
  devicesApi: {
    list: listDevicesMock,
    create: createDeviceMock,
    get: getDeviceMock,
    update: updateDeviceMock,
    remove: removeDeviceMock,
  },
}));

vi.mock('../../src/features/entities/api', () => ({
  entitiesApi: {
    history: historyMock,
    list: vi.fn(),
    get: vi.fn(),
    updateState: vi.fn(),
    callAction: vi.fn(),
  },
}));

vi.mock('../../src/api', async () => {
  const actual = await vi.importActual<typeof import('../../src/api')>('../../src/api');
  return {
    ...actual,
    areasApi: {
      ...actual.areasApi,
      list: listAreasMock,
    },
  };
});

describe('device CRUD pages', () => {
  beforeEach(() => {
    let devices: Device[] = [
      {
        id: 'dev-1',
        name: 'Bedroom Lamp',
        name_by_user: null,
        type: 'light',
        manufacturer: 'Demo',
        model: 'DL-1',
        area_id: 'area-1',
        area_name: 'Bedroom',
        status: 'online',
        entity_count: 1,
      },
    ];
    let deviceDetail: Device = {
      id: 'dev-1',
      name: 'Bedroom Lamp',
      name_by_user: null,
      type: 'light',
      manufacturer: 'Demo',
      model: 'DL-1',
      area_id: 'area-1',
      area_name: 'Bedroom',
      status: 'online',
      entities: [
        {
          entity_id: 'light.bedroom_lamp',
          domain: 'light',
          name: 'Bedroom Lamp',
          state: 'off',
          attributes: { brightness: 0 },
        },
      ],
      created_at: '2026-05-21T00:00:00Z',
      updated_at: '2026-05-21T00:00:00Z',
    };
    const areas = [
      { id: 'area-1', name: 'Bedroom' },
      { id: 'area-2', name: 'Living Room' },
    ];

    listDevicesMock.mockReset();
    createDeviceMock.mockReset();
    getDeviceMock.mockReset();
    updateDeviceMock.mockReset();
    removeDeviceMock.mockReset();
    listAreasMock.mockReset();
    historyMock.mockReset();

    listDevicesMock.mockImplementation(async () => ({
      total: devices.length,
      limit: 50,
      offset: 0,
      devices,
    }));
    createDeviceMock.mockImplementation(async (payload: { name: string; type: string }) => {
      const created = {
        id: 'dev-2',
        name: payload.name,
        name_by_user: null,
        type: payload.type,
        manufacturer: null,
        model: null,
        area_id: null,
        area_name: null,
        status: 'online',
        entity_count: 1,
        entities: [
          {
            entity_id: 'sensor.new_sensor',
            domain: 'sensor',
            name: payload.name,
            state: '0',
            attributes: {},
          },
        ],
      };
      devices = [...devices, created];
      return created;
    });
    getDeviceMock.mockImplementation(async () => deviceDetail);
    updateDeviceMock.mockImplementation(async (_id: string, payload: Record<string, unknown>) => {
      deviceDetail = { ...deviceDetail, ...payload };
      return deviceDetail;
    });
    removeDeviceMock.mockResolvedValue(undefined);
    listAreasMock.mockResolvedValue(areas);
    historyMock.mockResolvedValue([{ state: 'off', attributes: {}, last_changed: '2026-05-21T00:00:00Z' }]);
  });

  it('creates a device from the list page and refreshes the visible list', async () => {
    const user = userEvent.setup();
    renderApp(<DevicesPage />);

    await waitFor(() => expect(screen.getByText('Bedroom Lamp')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Добавить устройство' }));
    await user.clear(screen.getByLabelText('Название устройства'));
    await user.type(screen.getByLabelText('Название устройства'), 'New Sensor');
    await user.selectOptions(screen.getAllByLabelText('Тип устройства')[0], 'sensor');
    await user.click(screen.getByRole('button', { name: 'Создать устройство' }));

    await waitFor(() =>
      expect(createDeviceMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Sensor',
          type: 'sensor',
        }),
        expect.anything()
      )
    );
    await waitFor(() => expect(screen.getByText('New Sensor')).toBeInTheDocument());
  });

  it('edits an existing device and redirects after delete without breaking detail rendering', async () => {
    const user = userEvent.setup();
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderApp(
      <Routes>
        <Route path="/devices" element={<div>Devices list page</div>} />
        <Route path="/devices/:id" element={<DeviceDetailPage />} />
      </Routes>,
      '/devices/dev-1'
    );

    await waitFor(() => expect(screen.getByText('light.bedroom_lamp')).toBeInTheDocument());
    expect(screen.getByText('Demo')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Редактировать' }));
    await user.clear(screen.getByLabelText('Пользовательское имя'));
    await user.type(screen.getByLabelText('Пользовательское имя'), 'Reading Lamp');
    await user.selectOptions(screen.getByLabelText('Зона устройства'), 'area-2');
    await user.click(screen.getByRole('button', { name: 'Сохранить устройство' }));

    await waitFor(() =>
      expect(updateDeviceMock).toHaveBeenCalledWith(
        'dev-1',
        expect.objectContaining({
          name_by_user: 'Reading Lamp',
          area_id: 'area-2',
        })
      )
    );

    await user.click(screen.getByRole('button', { name: 'Удалить' }));
    await waitFor(() => expect(removeDeviceMock).toHaveBeenCalledWith('dev-1'));
    await waitFor(() => expect(screen.getByText('Devices list page')).toBeInTheDocument());

    confirmMock.mockRestore();
  });
});
