export const getNextAutocompleteIndex = (currentIndex: number, itemCount: number, direction: 1 | -1): number => {
  if (itemCount <= 0) return 0;
  const normalizedCurrent = Number.isInteger(currentIndex)
    ? ((currentIndex % itemCount) + itemCount) % itemCount
    : 0;
  return (normalizedCurrent + direction + itemCount) % itemCount;
};
