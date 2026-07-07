import { describe, expect, test } from 'bun:test';

import { VALID_TABS } from './types';

describe('router tab registry', () => {
  test('includes the repo map tab for direct navigation', () => {
    expect(VALID_TABS).toContain('repo-map');
  });
});
