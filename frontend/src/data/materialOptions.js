// Option lists. Values must match the enums in backend/prisma/schema.prisma.
export const CATEGORIES = [
  { value: 'CARDBOARD', label: 'Cardboard' },
  { value: 'WOOD', label: 'Wood' },
  { value: 'PAPER', label: 'Paper' },
  { value: 'PLASTIC', label: 'Plastic' },
  { value: 'METAL', label: 'Metal' },
  { value: 'FABRIC', label: 'Fabric' },
  { value: 'GLASS', label: 'Glass' },
  { value: 'OTHER', label: 'Other' },
];

export const CONDITIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'LIKE_NEW', label: 'Like new' },
  { value: 'GOOD', label: 'Good' },
  { value: 'FAIR', label: 'Fair' },
  { value: 'USED', label: 'Used' },
];

export const UNIT_SUGGESTIONS = ['pieces', 'kg', 'sheets', 'reams', 'liters', 'meters', 'boxes'];

const labelFrom = (list) => (value) => list.find((o) => o.value === value)?.label ?? value;
export const categoryLabel = labelFrom(CATEGORIES);
export const conditionLabel = labelFrom(CONDITIONS);
