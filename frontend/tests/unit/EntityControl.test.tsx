import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntityControl } from '../../src/components/EntityControl';
import type { Entity } from '../../src/api/types';
import { renderApp } from './test-utils';

const { mutateMock } = vi.hoisted(() => ({
  mutateMock: vi.fn(),
}));

vi.mock('../../src/features/entities/hooks', () => ({
  useEntityAction: () => ({
    isPending: false,
    mutate: mutateMock,
  }),
}));

const base: Entity = {
  entity_id: 'light.living_room',
  domain: 'light',
  name: 'Living Room',
  state: 'off',
  attributes: { brightness: 30 },
  last_changed: '',
  last_updated: '',
};

function setup(entity: Entity) {
  return renderApp(<EntityControl entity={entity} />);
}

describe('EntityControl', () => {
  it('renders light controls', async () => {
    setup(base);
    expect(screen.getByText('Яркость: 30%')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Переключить Living Room'));
    expect(mutateMock).toHaveBeenCalledWith({
      domain: 'light',
      action: 'turn_on',
      target: { entity_id: 'light.living_room' },
      data: undefined,
    });
  });

  it('renders switch toggle', () => {
    setup({ ...base, entity_id: 'switch.socket', domain: 'switch', name: 'Socket' });
    expect(screen.getByLabelText('Переключить Socket')).toBeInTheDocument();
  });

  it('renders sensor as read-only value', () => {
    setup({
      ...base,
      entity_id: 'sensor.temp',
      domain: 'sensor',
      name: 'Temperature',
      state: '22.5',
      unit_of_measurement: 'C',
    });
    expect(screen.getByText('22.5 C')).toBeInTheDocument();
  });

  it('renders climate controls', () => {
    setup({
      ...base,
      entity_id: 'climate.bedroom',
      domain: 'climate',
      name: 'Thermostat',
      state: 'heat',
      attributes: { current_temperature: 21, temperature: 22 },
    });
    expect(screen.getByText('Целевая')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Обогрев' })).toBeInTheDocument();
  });
});
