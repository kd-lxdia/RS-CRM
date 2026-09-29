import { prisma } from '../lib/clients';

const db = prisma as any;

type Actor = {
  id: string;
  role?: string;
};

type PiLineInput = {
  priceListItemId: string;
  quantity: number;
  adjustmentPercent?: number;
  adjustmentReason?: string;
};

const money = (value: unknown) => Number(value || 0);

export class B2bPiService {
  private async audit(input: {
    piId: string;
    action: string;
    oldValue?: unknown;
    newValue?: unknown;
    reason?: string;
    actor: Actor;
  }) {
    return db.b2bPiAuditLog.create({
      data: {
        piId: input.piId,
        action: input.action,
        oldValue: input.oldValue ? JSON.parse(JSON.stringify(input.oldValue)) : undefined,
        newValue: input.newValue ? JSON.parse(JSON.stringify(input.newValue)) : undefined,
        reason: input.reason,
        changedBy: input.actor.id,
      },
    });
  }

  private async nextPiNumber() {
    const year = new Date().getFullYear();
    const count = await db.b2bPi.count({
      where: {
        piNumber: {
          startsWith: `PI-${year}-`,
        },
      },
    });
    return `PI-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  async listParties(search?: string) {
    return db.b2bParty.findMany({
      where: {
        isActive: true,
        ...(search
          ? {
              OR: [
                { partyName: { contains: search, mode: 'insensitive' } },
                { firmName: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
                { gstNumber: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async upsertParty(input: {
    id?: string;
    partyName: string;
    firmName: string;
    gstNumber?: string;
    billingAddress: string;
    shippingAddress: string;
    contactPerson: string;
    phone: string;
    email?: string;
    creditTerms?: string;
    materialInterest?: string;
    assignedSalespersonId?: string;
    actor: Actor;
  }) {
    const data = {
      partyName: input.partyName,
      firmName: input.firmName,
      gstNumber: input.gstNumber,
      billingAddress: input.billingAddress,
      shippingAddress: input.shippingAddress,
      contactPerson: input.contactPerson,
      phone: input.phone,
      email: input.email,
      creditTerms: input.creditTerms,
      materialInterest: input.materialInterest,
      assignedSalespersonId: input.assignedSalespersonId || input.actor.id,
    };

    if (input.id) {
      return db.b2bParty.update({ where: { id: input.id }, data });
    }

    return db.b2bParty.create({
      data: {
        ...data,
        createdBy: input.actor.id,
      },
    });
  }

  async listPriceItems(search?: string) {
    return db.b2bPriceListItem.findMany({
      where: {
        isActive: true,
        ...(search
          ? {
              OR: [
                { sku: { contains: search, mode: 'insensitive' } },
                { itemName: { contains: search, mode: 'insensitive' } },
                { brand: { contains: search, mode: 'insensitive' } },
                { model: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ category: 'asc' }, { itemName: 'asc' }],
      take: 100,
    });
  }

  async createPriceItem(input: {
    sku: string;
    category: string;
    itemName: string;
    brand?: string;
    model?: string;
    wattage?: number;
    capacity?: number;
    dcrType?: string;
    unit?: string;
    basePrice: number;
    gstPercent?: number;
    actor: Actor;
  }) {
    return db.b2bPriceListItem.upsert({
      where: { sku: input.sku },
      update: {
        category: input.category,
        itemName: input.itemName,
        brand: input.brand,
        model: input.model,
        wattage: input.wattage,
        capacity: input.capacity,
        dcrType: input.dcrType,
        unit: input.unit || 'Nos',
        basePrice: input.basePrice,
        gstPercent: input.gstPercent ?? 18,
        isActive: true,
      },
      create: {
        sku: input.sku,
        category: input.category,
        itemName: input.itemName,
        brand: input.brand,
        model: input.model,
        wattage: input.wattage,
        capacity: input.capacity,
        dcrType: input.dcrType,
        unit: input.unit || 'Nos',
        basePrice: input.basePrice,
        gstPercent: input.gstPercent ?? 18,
        createdBy: input.actor.id,
      },
    });
  }

  async createPi(input: {
    partyId?: string;
    party?: {
      partyName: string;
      firmName: string;
      gstNumber?: string;
      billingAddress: string;
      shippingAddress: string;
      contactPerson: string;
      phone: string;
      email?: string;
      creditTerms?: string;
      materialInterest?: string;
    };
    validityDate: string;
    freightAmount?: number;
    paymentTerms?: string;
    dispatchTimeline?: string;
    maxAdjustmentPercent?: number;
    lines: PiLineInput[];
    actor: Actor;
  }) {
    if (!input.partyId && !input.party) {
      throw new Error('Select an existing B2B party or provide new party details.');
    }
    if (!input.lines?.length) {
      throw new Error('At least one PI line is required.');
    }

    const party = input.partyId
      ? await db.b2bParty.findUnique({ where: { id: input.partyId } })
      : await this.upsertParty({
          ...input.party!,
          assignedSalespersonId: input.actor.id,
          actor: input.actor,
        });
    if (!party) throw new Error('B2B party not found.');

    const limit = Math.abs(input.maxAdjustmentPercent ?? 2);
    const itemIds = input.lines.map((line) => line.priceListItemId);
    const items = await db.b2bPriceListItem.findMany({ where: { id: { in: itemIds }, isActive: true } });
    const itemMap = new Map(items.map((item: any) => [item.id, item]));
    if (items.length !== itemIds.length) {
      throw new Error('One or more selected material price list items are invalid.');
    }

    let maxLineAdjustmentPercent = 0;
    let subtotal = 0;
    let gstAmount = 0;
    let marginImpactAmount = 0;

    const lineCreates = input.lines.map((line) => {
      const item: any = itemMap.get(line.priceListItemId);
      const quantity = money(line.quantity);
      if (quantity <= 0) throw new Error('PI line quantity must be greater than zero.');
      const adjustmentPercent = money(line.adjustmentPercent);
      if (adjustmentPercent !== 0 && !line.adjustmentReason?.trim()) {
        throw new Error('Reason is mandatory for every price adjustment.');
      }
      maxLineAdjustmentPercent = Math.max(maxLineAdjustmentPercent, Math.abs(adjustmentPercent));
      const basePrice = money(item.basePrice);
      const finalPrice = Number((basePrice * (1 + adjustmentPercent / 100)).toFixed(2));
      const lineSubtotal = Number((finalPrice * quantity).toFixed(2));
      const lineGst = Number((lineSubtotal * money(item.gstPercent) / 100).toFixed(2));
      const lineTotal = Number((lineSubtotal + lineGst).toFixed(2));
      const impact = Number(((finalPrice - basePrice) * quantity).toFixed(2));
      subtotal += lineSubtotal;
      gstAmount += lineGst;
      marginImpactAmount += impact;

      return {
        priceListItemId: item.id,
        sku: item.sku,
        materialDescription: item.itemName,
        brand: item.brand,
        model: item.model,
        wattage: item.wattage,
        capacity: item.capacity,
        dcrType: item.dcrType,
        quantity,
        unit: item.unit,
        basePrice,
        adjustmentPercent,
        finalPrice,
        gstPercent: money(item.gstPercent),
        lineSubtotal,
        lineGst,
        lineTotal,
        adjustmentReason: line.adjustmentReason,
        marginImpactAmount: impact,
      };
    });

    subtotal = Number(subtotal.toFixed(2));
    gstAmount = Number(gstAmount.toFixed(2));
    marginImpactAmount = Number(marginImpactAmount.toFixed(2));
    const freightAmount = money(input.freightAmount);
    const totalAmount = Number((subtotal + gstAmount + freightAmount).toFixed(2));
    const requiresApproval = maxLineAdjustmentPercent > limit;
    const status = requiresApproval ? 'APPROVAL_PENDING' : 'GENERATED';
    const approvalReason = requiresApproval
      ? `Price adjustment ${maxLineAdjustmentPercent}% exceeds configured ${limit}% limit.`
      : undefined;

    const created = await db.b2bPi.create({
      data: {
        piNumber: await this.nextPiNumber(),
        validityDate: new Date(input.validityDate),
        partyId: party.id,
        salespersonId: input.actor.id,
        status,
        approvalStatus: status,
        maxAdjustmentPercent: limit,
        maxLineAdjustmentPercent,
        subtotal,
        gstAmount,
        freightAmount,
        totalAmount,
        marginImpactAmount,
        paymentTerms: input.paymentTerms || party.creditTerms,
        dispatchTimeline: input.dispatchTimeline,
        approvalReason,
        createdBy: input.actor.id,
        lines: { create: lineCreates },
      },
      include: { party: true, lines: true },
    });

    await this.audit({
      piId: created.id,
      action: requiresApproval ? 'APPROVAL_REQUESTED' : 'GENERATED_WITHIN_LIMIT',
      newValue: created,
      reason: approvalReason || 'Generated within configured adjustment limit.',
      actor: input.actor,
    });

    return created;
  }

  async listPis(status?: string) {
    return db.b2bPi.findMany({
      where: status ? { status } : undefined,
      include: { party: true, lines: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getPi(id: string) {
    const pi = await db.b2bPi.findUnique({
      where: { id },
      include: { party: true, lines: true, audits: { orderBy: { changedAt: 'desc' } } },
    });
    if (!pi) throw new Error('PI not found.');
    return pi;
  }

  async approvePi(id: string, actor: Actor, remark?: string) {
    if (!remark?.trim()) throw new Error('Approval remark is mandatory.');
    const oldValue = await this.getPi(id);
    if (oldValue.status !== 'APPROVAL_PENDING') {
      throw new Error('Only approval-pending PI can be approved.');
    }
    const updated = await db.b2bPi.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvalStatus: 'APPROVED',
        approvedBy: actor.id,
        approvedAt: new Date(),
        approvalRemark: remark,
      },
      include: { party: true, lines: true },
    });
    await this.audit({ piId: id, action: 'APPROVED', oldValue, newValue: updated, reason: remark, actor });
    return updated;
  }

  async rejectPi(id: string, actor: Actor, remark?: string) {
    if (!remark?.trim()) throw new Error('Rejection remark is mandatory.');
    const oldValue = await this.getPi(id);
    if (oldValue.status !== 'APPROVAL_PENDING') {
      throw new Error('Only approval-pending PI can be rejected.');
    }
    const updated = await db.b2bPi.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approvalStatus: 'REJECTED',
        approvedBy: actor.id,
        approvedAt: new Date(),
        approvalRemark: remark,
      },
      include: { party: true, lines: true },
    });
    await this.audit({ piId: id, action: 'REJECTED', oldValue, newValue: updated, reason: remark, actor });
    return updated;
  }

  async markSent(id: string, actor: Actor) {
    const oldValue = await this.getPi(id);
    if (!['GENERATED', 'APPROVED'].includes(oldValue.status)) {
      throw new Error('PI can be sent only after generation or approval.');
    }
    const updated = await db.b2bPi.update({
      where: { id },
      data: { status: 'SENT', sentAt: new Date() },
      include: { party: true, lines: true },
    });
    await this.audit({ piId: id, action: 'SENT', oldValue, newValue: updated, actor });
    return updated;
  }
}

export const b2bPiService = new B2bPiService();
