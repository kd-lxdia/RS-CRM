import { PrismaClient, User, RoleType } from '../lib/prisma-client-shim';

const prisma = new PrismaClient();

/**
 * Assigns a documentation officer using round-robin logic.
 * - Gets all active DOCUMENTATION role users (filtered by dealerId if provided)
 * - Excludes users on leave (isActive=false)
 * - Counts active assigned customers for each
 * - Picks the one with fewest (ties broken alphabetically by name for determinism)
 */
export async function assignDocumentationOfficer(dealerId?: string): Promise<User | null> {
  const whereClause: any = {
    role: RoleType.DOCUMENTATION,
    isActive: true,
  };

  if (dealerId) {
    whereClause.dealerId = dealerId;
  }

  // Get active DOCUMENTATION users
  const activeUsers = await prisma.user.findMany({
    where: whereClause,
    include: {
      docCustomers: {
        where: {
          status: 'ACTIVE', // Only counting ACTIVE customers as "active assigned customers"
        }
      }
    }
  });

  if (activeUsers.length === 0) {
    return null; // Return null if no users available
  }

  // Sort by customer count ascending, then by name alphabetically 
  activeUsers.sort((a, b) => {
    const countA = a.docCustomers.length;
    const countB = b.docCustomers.length;

    if (countA !== countB) {
      return countA - countB;
    }

    // Tie-breaker
    return a.name.localeCompare(b.name);
  });

  return activeUsers[0];
}
