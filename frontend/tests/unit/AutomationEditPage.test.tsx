import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AutomationEditPage } from '../../src/pages/AutomationEditPage';
import { renderApp } from './test-utils';

const { getAutomationMock, listEntitiesMock, updateAutomationMock } = vi.hoisted(() => ({
  getAutomationMock: vi.fn(),
  listEntitiesMock: vi.fn(),
  updateAutomationMock: vi.fn(),
}));

vi.mock('../../src/api', async () => {
  const actual = await vi.importActual<typeof import('../../src/api')>('../../src/api');
  return {
    ...actual,
    automationsApi: {
      ...actual.automationsApi,
      get: getAutomationMock,
      update: updateAutomationMock,
    },
  };
});

vi.mock('../../src/features/entities/api', () => ({
  entitiesApi: {
    list: listEntitiesMock,
    get: vi.fn(),
    history: vi.fn(),
    updateState: vi.fn(),
    callAction: vi.fn(),
  },
}));

describe('AutomationEditPage', () => {
  beforeEach(() => {
    getAutomationMock.mockReset();
    listEntitiesMock.mockReset();
    updateAutomationMock.mockReset();

    listEntitiesMock.mockResolvedValue({
      total: 2,
      limit: 50,
      offset: 0,
      entities: [
        { entity_id: 'binary_sensor.hallway_motion', domain: 'binary_sensor', state: 'off', attributes: {} },
        { entity_id: 'light.hallway', domain: 'light', state: 'off', attributes: { brightness: 0 } },
      ],
    });
    getAutomationMock.mockResolvedValue({
      id: 'auto-1',
      name: 'Hallway Motion Light',
      description: 'Turns on hallway light',
      is_enabled: true,
      mode: 'single',
      trigger: { type: 'state_changed', entity_id: 'binary_sensor.hallway_motion', to: 'on' },
      condition: null,
      action: { domain: 'light', action: 'turn_on', target: { entity_id: 'light.hallway' }, data: { brightness: 80 } },
      last_triggered: null,
      created_at: '2026-05-21T00:00:00Z',
    });
    updateAutomationMock.mockResolvedValue({});
  });

  it('hydrates the form and submits updated automation payload', async () => {
    const user = userEvent.setup();

    renderApp(
      <Routes>
        <Route path="/automations" element={<div>Automations list</div>} />
        <Route path="/automations/:id/edit" element={<AutomationEditPage />} />
      </Routes>,
      '/automations/auto-1/edit'
    );

    await waitFor(() => expect(screen.getByDisplayValue('Hallway Motion Light')).toBeInTheDocument());

    await user.clear(screen.getByLabelText('Название'));
    await user.type(screen.getByLabelText('Название'), 'Updated Hallway Motion Light');
    await user.click(screen.getByRole('button', { name: 'Сохранить изменения' }));

    await waitFor(() =>
      expect(updateAutomationMock).toHaveBeenCalledWith(
        'auto-1',
        expect.objectContaining({
          name: 'Updated Hallway Motion Light',
          action: expect.objectContaining({
            data: { brightness: 80 },
            target: { entity_id: 'light.hallway' },
          }),
          trigger: { type: 'state_changed', entity_id: 'binary_sensor.hallway_motion', to: 'on' },
        })
      )
    );
    await waitFor(() => expect(screen.getByText('Automations list')).toBeInTheDocument());
  });
});
