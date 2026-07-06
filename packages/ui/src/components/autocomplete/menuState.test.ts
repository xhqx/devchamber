import { describe, expect, test } from 'bun:test';

import { getNextAutocompleteIndex } from './menuState';

describe('autocomplete menu state', () => {
  test('wraps keyboard selection in both directions', () => {
    expect(getNextAutocompleteIndex(0, 3, 1)).toBe(1);
    expect(getNextAutocompleteIndex(2, 3, 1)).toBe(0);
    expect(getNextAutocompleteIndex(0, 3, -1)).toBe(2);
  });

  test('normalizes invalid current indexes and empty lists', () => {
    expect(getNextAutocompleteIndex(10, 3, 1)).toBe(2);
    expect(getNextAutocompleteIndex(-4, 3, -1)).toBe(1);
    expect(getNextAutocompleteIndex(0, 0, 1)).toBe(0);
  });
});
