import { describe, expect, it } from 'vitest';
import { queryKeys } from '../../src/shared/queryKeys';

describe('queryKeys', () => {
  it('builds stable keys for lists and details', () => {
    expect(queryKeys.devices.list()).toEqual(['devices']);
    expect(queryKeys.devices.list({ area_id: 'area-1' })).toEqual(['devices', { area_id: 'area-1' }]);
    expect(queryKeys.devices.detail('dev-1')).toEqual(['devices', 'dev-1']);
    expect(queryKeys.entities.list({ domain: 'light' })).toEqual(['entities', { domain: 'light' }]);
    expect(queryKeys.entities.history('light.kitchen')).toEqual(['entity-history', 'light.kitchen']);
  });
});
