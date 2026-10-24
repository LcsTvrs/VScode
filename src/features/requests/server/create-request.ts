import { assertAvailableStock } from "@/features/inventory/server/stock-rules";
import { prisma } from "@/lib/prisma";

type AdminInput = { storeId: string; code: string; employeeId: string; notes: unknown; aggregated: Map<string, number> };

export function createAdminRequest({ storeId, code, employeeId, notes, aggregated }: AdminInput) {
  return prisma.$transaction(async (tx) => {
      await assertAvailableStock(tx, storeId, aggregated);
      return tx.uniformRequest.create({
        data: {
          code,
          storeId,
          employeeId: employeeId,
          notes: typeof notes === "string" ? notes.trim().slice(0, 500) || null : null,
          items: {
            create: [...aggregated.entries()].map(([variantId, quantity]) => ({ variantId, quantity })),
          },
        },
        select: { id: true, code: true, status: true },
      });
    }, { isolationLevel: "Serializable" });
}

type PublicInput = { storeId: string; ldap: string; name: string; aggregatedItems: Map<string, number> };

export function createPublicRequest({ storeId, ldap, name, aggregatedItems }: PublicInput) {
  return prisma.$transaction(async (tx) => {
      const requestedVariants = [...aggregatedItems.entries()];
      await assertAvailableStock(tx, storeId, aggregatedItems);

      const employee = await tx.employee.upsert({
        where: { storeId_ldap: { storeId: storeId, ldap } },
        create: { ldap, name, storeId: storeId },
        update: { name, storeId: storeId },
        select: { id: true },
      });
      const code = `SOL-${new Date().getFullYear()}-${crypto.randomUUID()}`;
      const uniformRequest = await tx.uniformRequest.create({
        data: {
          code,
          employeeId: employee.id,
          storeId: storeId,
          items: {
            create: requestedVariants.map(([variantId, quantity]) => ({ variantId, quantity })),
          },
        },
        select: { id: true, code: true, status: true },
      });
      return uniformRequest;
    }, { isolationLevel: "Serializable" });
}
