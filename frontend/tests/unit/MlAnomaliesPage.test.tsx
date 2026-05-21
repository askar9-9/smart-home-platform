import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MlAnomaliesPage } from '../../src/pages/MlAnomaliesPage';
import { renderApp } from './test-utils';

const { anomaliesMock } = vi.hoisted(() => ({ anomaliesMock: vi.fn() }));

vi.mock('../../src/api', async () => {
  const actual = await vi.importActual<typeof import('../../src/api')>('../../src/api');
  return {
    ...actual,
    mlApi: {
      anomalies: anomaliesMock
    }
  };
});

describe('MlAnomaliesPage', () => {
  beforeEach(() => {
    anomaliesMock.mockReset();
    anomaliesMock.mockResolvedValue({
      model: {
        name: 'IsolationForest',
        dataset: 'UCI Individual Household Electric Power Consumption',
        trained_at: '2026-05-21T00:00:00+00:00',
        confidence: 'ml'
      },
      summary: { total: 2, anomalies: 1, period: 'day' },
      anomalies: [
        {
          id: 'reading-1',
          entity_id: 'sensor.main_energy_power',
          device_name: 'Main Energy Power',
          recorded_at: '2026-05-21T00:00:00+00:00',
          power_w: 1800,
          energy_kwh: 1.8,
          anomaly_score: 0.16,
          severity: 'high',
          reason: 'Высокая мгновенная мощность относительно ML-профиля'
        }
      ],
      timeline: [
        { timestamp: '2026-05-21T00:00:00+00:00', power_w: 650, energy_kwh: 0.65, anomaly_score: -0.02, anomaly: false },
        { timestamp: '2026-05-21T01:00:00+00:00', power_w: 1800, energy_kwh: 1.8, anomaly_score: 0.16, anomaly: true }
      ]
    });
  });

  it('renders model metadata, chart containers, and anomaly table', async () => {
    renderApp(<MlAnomaliesPage />);

    expect(screen.getByText('ML Аномалии')).toBeInTheDocument();
    expect(screen.getByText('За день')).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('Main Energy Power')).toBeInTheDocument());

    expect(screen.getByText('IsolationForest')).toBeInTheDocument();
    expect(screen.getByText('UCI Individual Household Electric Power Consumption')).toBeInTheDocument();
    expect(screen.getByText('Профиль потребления')).toBeInTheDocument();
    expect(screen.getByText('Журнал ML аномалий')).toBeInTheDocument();
    expect(screen.getByText('Main Energy Power')).toBeInTheDocument();
    expect(screen.getByText('Высокая')).toBeInTheDocument();
  });
});
