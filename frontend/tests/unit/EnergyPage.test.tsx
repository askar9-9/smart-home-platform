import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EnergyPage } from '../../src/pages/EnergyPage';
import { renderApp } from './test-utils';

const { summaryMock, consumptionMock, devicesMock, forecastMock } = vi.hoisted(() => ({
  summaryMock: vi.fn(),
  consumptionMock: vi.fn(),
  devicesMock: vi.fn(),
  forecastMock: vi.fn(),
}));

vi.mock('../../src/api', async () => {
  const actual = await vi.importActual<typeof import('../../src/api')>('../../src/api');
  return {
    ...actual,
    energyApi: {
      summary: summaryMock,
      consumption: consumptionMock,
      devices: devicesMock,
      forecast: forecastMock,
    },
  };
});

describe('EnergyPage', () => {
  beforeEach(() => {
    summaryMock.mockReset();
    consumptionMock.mockReset();
    devicesMock.mockReset();
    forecastMock.mockReset();

    summaryMock.mockResolvedValue({
      period: 'day',
      total_kwh: 12.8,
      total_cost: 230.4,
      currency: 'KZT',
      current_power_w: 820,
      peak_power_w: 1640,
      device_count: 3,
      date_from: '2026-05-21T00:00:00Z',
      date_to: '2026-05-21T23:00:00Z',
    });
    consumptionMock.mockResolvedValue({
      period: 'day',
      granularity: 'hour',
      data: [{ timestamp: '2026-05-21T00:00:00Z', kwh: 0.82, power_w: 820 }],
    });
    devicesMock.mockResolvedValue([
      {
        entity_id: 'sensor.main_energy_power',
        device_name: 'Main Energy Power',
        kwh: 12.8,
        current_power_w: 820,
        percentage: 74,
        anomaly: true,
        anomaly_reason: 'Потребление выше среднего за 7 дней более чем на 40%',
      },
    ]);
    forecastMock.mockResolvedValue({
      period_hours: 24,
      total_predicted_kwh: 10.4,
      confidence: 'mock',
      forecast: [{ hour: 0, predicted_kwh: 0.4, predicted_power_w: 420 }],
    });
  });

  it('renders energy metrics and non-empty chart sections', async () => {
    renderApp(<EnergyPage />);

    await waitFor(() => expect(screen.getByText('12.8 кВт·ч')).toBeInTheDocument());
    expect(screen.getByText('Потребление')).toBeInTheDocument();
    expect(screen.getByText('Топ потребителей')).toBeInTheDocument();
    expect(screen.getByText('Main Energy Power')).toBeInTheDocument();
    expect(screen.getByText('Прогноз на 24 часа')).toBeInTheDocument();
  });

  it('shows explicit empty states when no energy history exists', async () => {
    consumptionMock.mockResolvedValue({ period: 'day', granularity: 'hour', data: [] });
    devicesMock.mockResolvedValue([]);
    forecastMock.mockResolvedValue({ period_hours: 24, total_predicted_kwh: 0, confidence: 'mock', forecast: [] });

    renderApp(<EnergyPage />);

    await waitFor(() => expect(screen.getByText('Нет исторических показаний энергии. Включите demo simulation или дождитесь первых MQTT readings.')).toBeInTheDocument());
    expect(screen.getByText('Топ потребителей появится после первых энергоизмерений.')).toBeInTheDocument();
    expect(screen.getByText('Прогноз появится после накопления истории показаний.')).toBeInTheDocument();
  });
});
