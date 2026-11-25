import { prisma } from '../config/database.js';
import { notifyPendingRequestersOfUnavailableMaterial } from './notifications.service.js';

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
    where.title = { contains: filters.search, mode: 'insensitive' };
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

export async function updateMaterial(id, data) {
  return prisma.$transaction(async (tx) => {
    const [existing] = await tx.$queryRaw`
      SELECT "isAvailable"
      FROM "materials"
      WHERE "id" = ${id}
      FOR UPDATE
    `;
    const material = await tx.material.update({
      where: { id },
      data,
      include: { owner: ownerSelect },
    });

    if (existing?.isAvailable && data.isAvailable === false) {
      await notifyPendingRequestersOfUnavailableMaterial(tx, {
        materialId: id,
        title: 'Requested material is no longer available',
        message: `${material.owner.name} marked ${material.title} unavailable.`,
      });
    }

    return material;
  });
}

export const deleteMaterial = (id) => prisma.material.delete({ where: { id } });
