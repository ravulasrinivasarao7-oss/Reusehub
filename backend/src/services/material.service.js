import { prisma } from '../config/database.js';

// Never expose the owner's email or password hash in listings.
const ownerSelect = { select: { id: true, name: true } };

function buildWhere(filters, baseWhere = {}) {
  const where = { ...baseWhere };
  if (filters.availability === 'available') where.isAvailable = true;
  if (filters.availability === 'unavailable') where.isAvailable = false;
  if (filters.category) where.category = filters.category;
  if (filters.condition) where.condition = filters.condition;
  if (filters.location) where.location = { contains: filters.location, mode: 'insensitive' };
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
    ];
  }
  return where;
}

export async function listMaterials(filters, baseWhere = {}) {
  const where = buildWhere(filters, baseWhere);
  const [items, total] = await prisma.$transaction([
    prisma.material.findMany({
      where,
      include: { owner: ownerSelect },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.material.count({ where }),
  ]);
  return {
    items,
    meta: { total, page: filters.page, limit: filters.limit, totalPages: Math.max(1, Math.ceil(total / filters.limit)) },
  };
}

export const findMaterialById = (id) => prisma.material.findUnique({ where: { id }, include: { owner: ownerSelect } });

export const createMaterial = (ownerId, data) =>
  prisma.material.create({ data: { ...data, ownerId }, include: { owner: ownerSelect } });

export const updateMaterial = (id, data) =>
  prisma.material.update({ where: { id }, data, include: { owner: ownerSelect } });

export const deleteMaterial = (id) => prisma.material.delete({ where: { id } });
