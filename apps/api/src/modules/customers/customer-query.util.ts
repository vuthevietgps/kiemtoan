import { Prisma } from '@prisma/client';
export function customerSearch(search?: string): Prisma.CustomerWhereInput {
  return !search
    ? {}
    : {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { taxCode: { contains: search } },
          { contactName: { contains: search, mode: 'insensitive' } },
          { contactPhone: { contains: search } },
          { contactEmail: { contains: search, mode: 'insensitive' } },
          {
            contacts: {
              some: {
                deletedAt: null,
                OR: [
                  { fullName: { contains: search, mode: 'insensitive' } },
                  { email: { contains: search, mode: 'insensitive' } },
                  { phone: { contains: search } },
                ],
              },
            },
          },
        ],
      };
}
