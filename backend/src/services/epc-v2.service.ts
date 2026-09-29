import { prisma } from '../lib/clients';

type Actor = {
  id: string;
  role?: string;
};

type JsonObject = Record<string, unknown>;

const db = prisma as any;

const LOW_MARGIN_DEFAULT = 12;

const normalise = (value?: string | null) =>
  (value || '').trim().toLowerCase().replace(/\s+/g, ' ');

const money = (value: unknown) => Number(value || 0);

export class EpcV2Service {
  private dayWindow(now = new Date()) {
    const today = now.toISOString().slice(0, 10);
    return {
      now,
      today,
      start: new Date(`${today}T00:00:00.000Z`),
      end: new Date(`${today}T23:59:59.999Z`),
    };
  }

  private daysBetween(from?: Date | string | null, to = new Date()) {
    if (!from) return null;
    const fromDate = new Date(from);
    return Math.max(0, Math.floor((to.getTime() - fromDate.getTime()) / 86400000));
  }

  private async projectContext(projectIds: string[]) {
    const ids = Array.from(new Set(projectIds.filter(Boolean)));
    if (!ids.length) return new Map<string, any>();

    const projects = await db.epcProject.findMany({ where: { id: { in: ids } } });
    const customerIds = Array.from(new Set(projects.map((project: any) => project.customerId).filter(Boolean)));
    const leadIds = Array.from(new Set(projects.map((project: any) => project.leadId).filter(Boolean)));
    const userIds = Array.from(
      new Set(
        projects
          .flatMap((project: any) => [
            project.projectOwnerId,
            project.salesOwnerId,
            project.executionOwnerId,
            project.documentationOwnerId,
            project.installationOwnerId,
            project.accountsOwnerId,
            project.nextActionOwnerId,
          ])
          .filter(Boolean)
      )
    );

    const [customers, leads, users] = await Promise.all([
      customerIds.length ? db.customer.findMany({ where: { id: { in: customerIds } } }) : [],
      leadIds.length ? db.lead.findMany({ where: { id: { in: leadIds } } }) : [],
      userIds.length ? db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, role: true } }) : [],
    ]);

    const customerMap = new Map(customers.map((customer: any) => [customer.id, customer]));
    const leadMap = new Map(leads.map((lead: any) => [lead.id, lead]));
    const userMap = new Map(users.map((user: any) => [user.id, user]));

    return new Map(
      projects.map((project: any) => {
        const customer: any = project.customerId ? customerMap.get(project.customerId) : null;
        const lead: any = project.leadId ? leadMap.get(project.leadId) : null;
        const owner =
          userMap.get(project.projectOwnerId) ||
          userMap.get(project.executionOwnerId) ||
          userMap.get(project.salesOwnerId) ||
          userMap.get(project.nextActionOwnerId) as any;

        return [
          project.id,
          {
            projectId: project.id,
            projectCode: project.projectCode,
            projectStage: project.stage,
            projectValue: project.projectValue,
            customerName: customer?.name || lead?.name || 'Not linked',
            customerPhone: customer?.phone || lead?.phone || '',
            customerCode: customer?.customerCode || '',
            leadCode: lead?.leadCode || '',
            city: customer?.city || lead?.city || '',
            ownerName: owner?.name || 'Unassigned',
            ownerRole: owner?.role || '',
            nextAction: project.nextAction || '',
            nextActionDueAt: project.nextActionDueAt,
            delayReason: project.delayReason || '',
            delayOwnerDepartment: project.delayOwnerDepartment || '',
          },
        ];
      })
    );
  }

  private async leadContext(leadIds: string[]) {
    const ids = Array.from(new Set(leadIds.filter(Boolean)));
    if (!ids.length) return new Map<string, any>();

    const leads = await db.lead.findMany({ where: { id: { in: ids } } });
    const userIds = Array.from(new Set(leads.map((lead: any) => lead.assignedSalesperson).filter(Boolean)));
    const users = userIds.length
      ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, role: true } })
      : [];
    const userMap = new Map(users.map((user: any) => [user.id, user]));

    return new Map(
      leads.map((lead: any) => {
        const owner: any = lead.assignedSalesperson ? userMap.get(lead.assignedSalesperson) : null;
        return [
          lead.id,
          {
            leadId: lead.id,
            leadCode: lead.leadCode,
            customerName: lead.name,
            customerPhone: lead.phone,
            city: lead.city || '',
            address: lead.address || '',
            leadStatus: lead.status,
            ownerName: owner?.name || 'Unassigned',
            ownerRole: owner?.role || '',
          },
        ];
      })
    );
  }

  private drilldownResponse(type: string, title: string, rows: any[]) {
    return {
      type,
      title,
      generatedAt: new Date(),
      count: rows.length,
      rows,
    };
  }

  async audit(params: {
    entityType: string;
    entityId: string;
    action: string;
    oldValue?: JsonObject | null;
    newValue?: JsonObject | null;
    changedBy: string;
    approvalId?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return db.epcAuditLog.create({
      data: {
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        oldValue: params.oldValue || undefined,
        newValue: params.newValue || undefined,
        changedBy: params.changedBy,
        approvalId: params.approvalId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  }

  async upsertLeadControl(input: {
    leadId: string;
    mobile: string;
    caNumber?: string;
    customerName: string;
    address?: string;
    sourceDetail?: string;
    nextFollowUpAt?: string;
    hotScore?: number;
    lostReason?: string;
    actor: Actor;
  }) {
    const lead = await db.lead.findUnique({ where: { id: input.leadId } });
    if (!lead) throw new Error('Lead not found.');
    if (!input.sourceDetail?.trim()) throw new Error('Lead source detail is mandatory.');
    if (!['WON', 'LOST'].includes(lead.status) && !input.nextFollowUpAt) {
      throw new Error('Follow-up date is mandatory for active leads.');
    }
    if (lead.status === 'LOST' && !input.lostReason?.trim() && !lead.lostReason?.trim()) {
      throw new Error('Lost reason is mandatory before closing a lead as LOST.');
    }

    const customerNameKey = normalise(input.customerName);
    const addressKey = normalise(input.address);
    const duplicateGroupKey = [
      input.mobile,
      input.caNumber || '',
      addressKey,
      customerNameKey,
    ].join('|');

    const duplicateMatches = await db.epcLeadControl.findMany({
      where: {
        OR: [
          { mobile: input.mobile },
          input.caNumber ? { caNumber: input.caNumber } : undefined,
          addressKey ? { addressKey } : undefined,
          customerNameKey ? { customerNameKey } : undefined,
        ].filter(Boolean),
        leadId: { not: input.leadId },
      },
      select: { leadId: true, mobile: true, caNumber: true, customerNameKey: true, addressKey: true },
    });

    const control = await db.epcLeadControl.upsert({
      where: { leadId: input.leadId },
      update: {
        mobile: input.mobile,
        caNumber: input.caNumber,
        customerNameKey,
        addressKey,
        sourceDetail: input.sourceDetail,
        nextFollowUpAt: input.nextFollowUpAt ? new Date(input.nextFollowUpAt) : undefined,
        hotScore: input.hotScore || 0,
        isHot: (input.hotScore || 0) >= 70,
        lostReason: input.lostReason,
        duplicateGroupKey,
        duplicateFields: duplicateMatches,
      },
      create: {
        leadId: input.leadId,
        mobile: input.mobile,
        caNumber: input.caNumber,
        customerNameKey,
        addressKey,
        sourceDetail: input.sourceDetail,
        nextFollowUpAt: input.nextFollowUpAt ? new Date(input.nextFollowUpAt) : undefined,
        hotScore: input.hotScore || 0,
        isHot: (input.hotScore || 0) >= 70,
        lostReason: input.lostReason,
        duplicateGroupKey,
        duplicateFields: duplicateMatches,
      },
    });

    await this.audit({
      entityType: 'LEAD',
      entityId: input.leadId,
      action: 'UPSERT_LEAD_CONTROL',
      newValue: { duplicateMatches, nextFollowUpAt: input.nextFollowUpAt, hotScore: input.hotScore },
      changedBy: input.actor.id,
    });

    return { control, duplicateMatches, duplicateFound: duplicateMatches.length > 0 };
  }

  async generateMissedFollowUpAlerts(actor: Actor) {
    const now = new Date();
    const controls = await db.epcLeadControl.findMany({
      where: { nextFollowUpAt: { lt: now }, missedFollowUpAt: null },
      take: 200,
    });
    const leadMap = await this.leadContext(controls.map((control: any) => control.leadId));
    let created = 0;

    for (const control of controls as any[]) {
      const lead = leadMap.get(control.leadId);
      if (!lead?.ownerName) continue;
      const leadRecord = await db.lead.findUnique({ where: { id: control.leadId } });
      if (!leadRecord?.assignedSalesperson) continue;

      const existing = await db.notification.findFirst({
        where: {
          userId: leadRecord.assignedSalesperson,
          type: 'MISSED_FOLLOW_UP',
          entityId: control.leadId,
          isRead: false,
        },
      });
      if (existing) continue;

      await db.notification.create({
        data: {
          userId: leadRecord.assignedSalesperson,
          type: 'MISSED_FOLLOW_UP',
          title: 'Missed follow-up',
          message: `${lead.customerName || 'Lead'} follow-up is overdue since ${control.nextFollowUpAt?.toISOString()}.`,
          entityType: 'LEAD',
          entityId: control.leadId,
        },
      });
      created += 1;
    }

    await this.audit({
      entityType: 'LEAD',
      entityId: 'MISSED_FOLLOW_UP_ALERTS',
      action: 'MISSED_FOLLOW_UP_ALERTS_GENERATED',
      newValue: { created, checked: controls.length },
      changedBy: actor.id,
    });

    return { checked: controls.length, created };
  }

  async createProjectAfterAdvance(input: {
    leadId?: string;
    customerId?: string;
    acceptedProposalId?: string;
    projectValue: number;
    advanceRequiredAmount: number;
    owners: {
      projectOwnerId?: string;
      salesOwnerId?: string;
      executionOwnerId?: string;
      documentationOwnerId?: string;
      installationOwnerId?: string;
      accountsOwnerId?: string;
    };
    projectDeadlineAt?: string;
    actor: Actor;
  }) {
    if (!input.projectDeadlineAt) throw new Error('Project deadline is mandatory at conversion.');
    const paymentWhere = input.customerId
      ? { customerId: input.customerId, milestone: 'BOOKING' }
      : { customer: { leadId: input.leadId }, milestone: 'BOOKING' };

    const received = await db.payment.aggregate({
      where: paymentWhere,
      _sum: { amount: true },
    });

    const advanceReceivedAmount = money(received._sum.amount);
    if (advanceReceivedAmount < money(input.advanceRequiredAmount)) {
      throw new Error(
        `Advance gate blocked. Required ${input.advanceRequiredAmount}, received ${advanceReceivedAmount}.`
      );
    }

    const [customer, lead] = await Promise.all([
      input.customerId ? db.customer.findUnique({ where: { id: input.customerId } }) : null,
      input.leadId ? db.lead.findUnique({ where: { id: input.leadId } }) : null,
    ]);
    const customerSnapshot = {
      customerCode: customer?.customerCode,
      name: customer?.name || lead?.name,
      phone: customer?.phone || lead?.phone,
      email: customer?.email || lead?.email,
      address: customer?.address || lead?.address,
      city: customer?.city || lead?.city,
      pincode: customer?.pincode || lead?.pincode,
      caNumber: customer?.electricityConsumerNo,
      sanctionedLoad: customer?.sanctionedLoad,
      capturedAt: new Date(),
    };

    const project = await db.epcProject.create({
      data: {
        projectCode: `RS2-${Date.now()}`,
        leadId: input.leadId,
        customerId: input.customerId,
        customerSnapshot,
        acceptedProposalId: input.acceptedProposalId,
        projectValue: money(input.projectValue),
        advanceRequiredAmount: money(input.advanceRequiredAmount),
        advanceReceivedAmount,
        stage: 'PROJECT_CREATED',
        paymentGateStatus: 'OPEN',
        projectOwnerId: input.owners.projectOwnerId,
        salesOwnerId: input.owners.salesOwnerId,
        executionOwnerId: input.owners.executionOwnerId,
        documentationOwnerId: input.owners.documentationOwnerId,
        installationOwnerId: input.owners.installationOwnerId,
        accountsOwnerId: input.owners.accountsOwnerId,
        nextAction: 'Complete site survey booking',
        nextActionOwnerId: input.owners.executionOwnerId || input.owners.projectOwnerId,
        projectDeadlineAt: input.projectDeadlineAt ? new Date(input.projectDeadlineAt) : undefined,
        createdAfterAdvanceAt: new Date(),
        createdBy: input.actor.id,
      },
    });

    await this.audit({
      entityType: 'PROJECT',
      entityId: project.id,
      action: 'PROJECT_CREATED_AFTER_ADVANCE',
      newValue: { projectCode: project.projectCode, advanceReceivedAmount },
      changedBy: input.actor.id,
    });

    return project;
  }

  async saveSurvey(input: {
    projectId: string;
    visitId?: string;
    assignedSurveyorId?: string;
    plannedAt?: string;
    completedAt?: string;
    roofOrGroundType?: string;
    locationLat?: number;
    locationLng?: number;
    locationProofUrl?: string;
    sitePhotoUrls?: string[];
    connectedLoadKw?: number;
    sanctionedLoadKw?: number;
    caNumber?: string;
    shadowStatus?: string;
    shadowNotes?: string;
    structureRequirement?: string;
    checklist?: JsonObject;
    notCompletedReason?: string;
    actor: Actor;
  }) {
    const requiredForCompletion = [
      input.roofOrGroundType,
      input.locationLat,
      input.locationLng,
      input.connectedLoadKw,
      input.sanctionedLoadKw,
      input.structureRequirement,
      input.sitePhotoUrls?.length,
    ];
    const isChecklistComplete = Boolean(input.completedAt) && requiredForCompletion.every(Boolean);

    const survey = await db.epcSurveyControl.create({
      data: {
        projectId: input.projectId,
        visitId: input.visitId,
        assignedSurveyorId: input.assignedSurveyorId,
        bookedAt: new Date(),
        plannedAt: input.plannedAt ? new Date(input.plannedAt) : undefined,
        completedAt: input.completedAt ? new Date(input.completedAt) : undefined,
        notCompletedReason: input.notCompletedReason,
        roofOrGroundType: input.roofOrGroundType,
        locationLat: input.locationLat,
        locationLng: input.locationLng,
        locationProofUrl: input.locationProofUrl,
        sitePhotoUrls: input.sitePhotoUrls || [],
        connectedLoadKw: input.connectedLoadKw,
        sanctionedLoadKw: input.sanctionedLoadKw,
        caNumber: input.caNumber,
        shadowStatus: input.shadowStatus || 'PENDING',
        shadowNotes: input.shadowNotes,
        structureRequirement: input.structureRequirement,
        checklist: input.checklist || {},
        isChecklistComplete,
      },
    });

    if (isChecklistComplete) {
      await db.epcProject.update({
        where: { id: input.projectId },
        data: { stage: 'SURVEY_DONE', nextAction: 'Create design and BOM' },
      });
    }

    await this.audit({
      entityType: 'SURVEY',
      entityId: survey.id,
      action: isChecklistComplete ? 'SURVEY_COMPLETED' : 'SURVEY_SAVED_INCOMPLETE',
      newValue: { isChecklistComplete },
      changedBy: input.actor.id,
    });

    return survey;
  }

  calculateQuotation(input: {
    structureCost?: number;
    moduleCost?: number;
    inverterCost?: number;
    labourIcCost?: number;
    transportationCost?: number;
    netMeteringCost?: number;
    subsidyProcessingCost?: number;
    otherCost?: number;
    sellingPrice: number;
    lowMarginThresholdPercent?: number;
  }) {
    const totalCost =
      money(input.structureCost) +
      money(input.moduleCost) +
      money(input.inverterCost) +
      money(input.labourIcCost) +
      money(input.transportationCost) +
      money(input.netMeteringCost) +
      money(input.subsidyProcessingCost) +
      money(input.otherCost);
    const sellingPrice = money(input.sellingPrice);
    const grossProfit = sellingPrice - totalCost;
    const marginPercent = sellingPrice > 0 ? Number(((grossProfit / sellingPrice) * 100).toFixed(2)) : 0;
    const threshold = money(input.lowMarginThresholdPercent || LOW_MARGIN_DEFAULT);

    return {
      totalCost,
      sellingPrice,
      grossProfit,
      marginPercent,
      lowMarginWarning: marginPercent < threshold,
      founderApprovalStatus: marginPercent < threshold ? 'PENDING' : 'NOT_REQUIRED',
    };
  }

  async createQuotationCostSheet(input: JsonObject & { actor: Actor }) {
    if (input.projectId) {
      const approved = await db.epcQuotationCostSheet.findFirst({
        where: { projectId: input.projectId as string, founderApprovalStatus: 'APPROVED', isActive: true },
      });
      if (approved && !input.revisionReason) {
        throw new Error('Approved quotation cost cannot be changed. Create a revision with revisionReason.');
      }
    }
    const calculated = this.calculateQuotation(input as any);
    const costSheet = await db.epcQuotationCostSheet.create({
      data: {
        projectId: input.projectId as string | undefined,
        leadId: input.leadId as string | undefined,
        proposalId: input.proposalId as string | undefined,
        revisionNo: Number(input.revisionNo || 1),
        moduleBrand: String(input.moduleBrand || ''),
        moduleWattage: Number(input.moduleWattage || 0),
        moduleType: input.moduleType as string | undefined,
        inverterBrand: String(input.inverterBrand || ''),
        inverterKw: Number(input.inverterKw || 0),
        structureCost: money(input.structureCost),
        moduleCost: money(input.moduleCost),
        inverterCost: money(input.inverterCost),
        labourIcCost: money(input.labourIcCost),
        transportationCost: money(input.transportationCost),
        netMeteringCost: money(input.netMeteringCost),
        subsidyProcessingCost: money(input.subsidyProcessingCost),
        otherCost: money(input.otherCost),
        totalCost: calculated.totalCost,
        sellingPrice: calculated.sellingPrice,
        grossProfit: calculated.grossProfit,
        marginPercent: calculated.marginPercent,
        lowMarginThresholdPercent: money(input.lowMarginThresholdPercent || LOW_MARGIN_DEFAULT),
        lowMarginWarning: calculated.lowMarginWarning,
        founderApprovalStatus: calculated.founderApprovalStatus,
        createdBy: input.actor.id,
      },
    });

    await this.audit({
      entityType: 'QUOTATION',
      entityId: costSheet.id,
      action: calculated.lowMarginWarning ? 'LOW_MARGIN_QUOTATION_CREATED' : 'QUOTATION_CREATED',
      newValue: calculated,
      changedBy: input.actor.id,
    });

    return costSheet;
  }

  async markQuotationSent(id: string, actor: Actor) {
    const oldValue = await db.epcQuotationCostSheet.findUnique({ where: { id } });
    if (!oldValue) throw new Error('Quotation cost sheet not found.');
    if (oldValue.lowMarginWarning && oldValue.founderApprovalStatus !== 'APPROVED') {
      throw new Error('Low-margin quotation cannot be sent before founder approval.');
    }

    const updated = await db.epcQuotationCostSheet.update({
      where: { id },
      data: { sentAt: new Date() },
    });
    await this.audit({
      entityType: 'QUOTATION',
      entityId: id,
      action: 'QUOTATION_SENT',
      oldValue,
      newValue: updated,
      changedBy: actor.id,
    });
    return updated;
  }

  async reviseQuotation(id: string, input: JsonObject & { actor: Actor }) {
    const oldValue = await db.epcQuotationCostSheet.findUnique({ where: { id } });
    if (!oldValue) throw new Error('Quotation cost sheet not found.');
    if (!input.revisionReason) throw new Error('revisionReason is mandatory for quotation revision.');

    await db.epcQuotationCostSheet.update({ where: { id }, data: { isActive: false } });
    const revisedInput = {
      ...oldValue,
      ...input,
      revisionNo: Number(oldValue.revisionNo || 1) + 1,
      actor: input.actor,
    };
    const revised = await this.createQuotationCostSheet(revisedInput);
    await this.audit({
      entityType: 'QUOTATION',
      entityId: revised.id,
      action: 'QUOTATION_REVISION_CREATED',
      oldValue,
      newValue: { revisedId: revised.id, revisionReason: input.revisionReason },
      changedBy: input.actor.id,
    });
    return revised;
  }

  async upsertDesignControl(input: {
    projectId: string;
    requiredStatus?: string;
    status?: string;
    designOwnerId?: string;
    designDueAt?: string;
    completedAt?: string;
    designUrl?: string;
    notes?: string;
    actor: Actor;
  }) {
    const status = input.status || 'PENDING';
    const requiredStatus = input.requiredStatus || 'REQUIRED';

    if (requiredStatus !== 'NOT_REQUIRED' && status !== 'DONE') {
      if (!input.designOwnerId) throw new Error('Design owner is mandatory when design is required.');
      if (!input.designDueAt) throw new Error('Design due date is mandatory when design is required.');
    }

    if (status === 'DONE' && !input.designUrl) {
      throw new Error('Design completion requires designUrl/proof.');
    }

    const oldValue = await db.epcDesignControl.findUnique({ where: { projectId: input.projectId } });
    const design = await db.epcDesignControl.upsert({
      where: { projectId: input.projectId },
      update: {
        requiredStatus,
        status,
        designOwnerId: input.designOwnerId,
        designDueAt: input.designDueAt ? new Date(input.designDueAt) : undefined,
        assignedAt: input.designOwnerId && !oldValue?.assignedAt ? new Date() : undefined,
        completedAt: status === 'DONE' ? (input.completedAt ? new Date(input.completedAt) : new Date()) : undefined,
        designUrl: input.designUrl,
        notes: input.notes,
      },
      create: {
        projectId: input.projectId,
        requiredStatus,
        status,
        designOwnerId: input.designOwnerId,
        designDueAt: input.designDueAt ? new Date(input.designDueAt) : undefined,
        assignedAt: input.designOwnerId ? new Date() : undefined,
        completedAt: status === 'DONE' ? (input.completedAt ? new Date(input.completedAt) : new Date()) : undefined,
        designUrl: input.designUrl,
        notes: input.notes,
        createdBy: input.actor.id,
      },
    });

    await db.epcProject.update({
      where: { id: input.projectId },
      data: {
        stage: status === 'DONE' || requiredStatus === 'NOT_REQUIRED' ? 'BOM_PENDING' : 'DESIGN_PENDING',
        nextAction: status === 'DONE' || requiredStatus === 'NOT_REQUIRED' ? 'Create BOM' : 'Complete 2D design',
        nextActionOwnerId: input.designOwnerId,
        nextActionDueAt: input.designDueAt ? new Date(input.designDueAt) : undefined,
      },
    });

    await this.audit({
      entityType: 'PROJECT',
      entityId: input.projectId,
      action: status === 'DONE' ? 'DESIGN_COMPLETED' : 'DESIGN_CONTROL_UPDATED',
      oldValue,
      newValue: design,
      changedBy: input.actor.id,
    });

    return design;
  }

  async getDesignQueue() {
    const designs = await db.epcDesignControl.findMany({
      where: { requiredStatus: { not: 'NOT_REQUIRED' }, status: { not: 'DONE' } },
      orderBy: [{ designDueAt: 'asc' }, { updatedAt: 'asc' }],
      take: 200,
    });
    const projectMap = await this.projectContext(designs.map((design: any) => design.projectId));
    const ownerIds = Array.from(new Set(designs.map((design: any) => design.designOwnerId).filter(Boolean)));
    const owners = ownerIds.length
      ? await db.user.findMany({ where: { id: { in: ownerIds } }, select: { id: true, name: true, role: true } })
      : [];
    const ownerMap = new Map(owners.map((owner: any) => [owner.id, owner]));
    const now = new Date();

    return designs.map((design: any) => {
      const owner: any = ownerMap.get(design.designOwnerId);
      return {
        ...projectMap.get(design.projectId),
        designId: design.id,
        requiredStatus: design.requiredStatus,
        designStatus: design.status,
        designOwner: owner?.name || 'Unassigned',
        designDueAt: design.designDueAt,
        daysOverdue: design.designDueAt && design.designDueAt < now ? this.daysBetween(design.designDueAt, now) : 0,
        notes: design.notes || '',
      };
    });
  }

  async approveQuotation(id: string, actor: Actor, remarks?: string) {
    const oldValue = await db.epcQuotationCostSheet.findUnique({ where: { id } });
    if (!oldValue) throw new Error('Quotation cost sheet not found.');

    const updated = await db.epcQuotationCostSheet.update({
      where: { id },
      data: {
        founderApprovalStatus: 'APPROVED',
        founderApprovedBy: actor.id,
        founderApprovedAt: new Date(),
        founderApprovalRemarks: remarks,
      },
    });

    await this.audit({
      entityType: 'QUOTATION',
      entityId: id,
      action: 'FOUNDER_APPROVED_LOW_MARGIN',
      oldValue,
      newValue: updated,
      changedBy: actor.id,
    });

    return updated;
  }

  async getPendingQuotationApprovals() {
    const quotations = await db.epcQuotationCostSheet.findMany({
      where: {
        lowMarginWarning: true,
        founderApprovalStatus: { not: 'APPROVED' },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const projectMap = await this.projectContext(quotations.map((quotation: any) => quotation.projectId).filter(Boolean));
    const leadMap = await this.leadContext(quotations.map((quotation: any) => quotation.leadId).filter(Boolean));

    return quotations.map((quotation: any) => ({
      ...(quotation.projectId ? projectMap.get(quotation.projectId) : leadMap.get(quotation.leadId)),
      quotationId: quotation.id,
      revisionNo: quotation.revisionNo,
      module: `${quotation.moduleBrand} ${quotation.moduleWattage}W`,
      inverter: `${quotation.inverterBrand} ${quotation.inverterKw}kW`,
      totalCost: quotation.totalCost,
      sellingPrice: quotation.sellingPrice,
      grossProfit: quotation.grossProfit,
      marginPercent: quotation.marginPercent,
      approvalStatus: quotation.founderApprovalStatus,
      createdAt: quotation.createdAt,
      remarks: 'Low margin approval pending',
    }));
  }

  async createBom(input: {
    projectId: string;
    surveyControlId?: string;
    revisionReason?: string;
    lines: Array<JsonObject>;
    actor: Actor;
  }) {
    const existingBoms = await db.epcBom.findMany({
      where: { projectId: input.projectId },
      orderBy: { revisionNo: 'desc' },
      take: 1,
    });
    const previousBom = existingBoms[0];
    if (previousBom?.lockedAt && !input.revisionReason) {
      throw new Error('BOM revision reason is mandatory after approval/lock.');
    }

    const bom = await db.epcBom.create({
      data: {
        projectId: input.projectId,
        surveyControlId: input.surveyControlId,
        revisionNo: previousBom ? Number(previousBom.revisionNo || 1) + 1 : 1,
        previousBomId: previousBom?.id,
        revisionReason: input.revisionReason,
        createdBy: input.actor.id,
      },
    });

    await db.epcBomLine.createMany({
      data: input.lines.map((line) => ({
        bomId: bom.id,
        itemType: line.itemType || 'OTHER',
        itemName: String(line.itemName || ''),
        sku: String(line.sku || ''),
        brand: line.brand as string | undefined,
        wattage: line.wattage ? Number(line.wattage) : undefined,
        dcrType: line.dcrType as string | undefined,
        quantity: money(line.quantity),
        unit: String(line.unit || 'nos'),
        approvedQty: money(line.quantity),
        notes: line.notes as string | undefined,
      })),
    });

    await this.audit({
      entityType: 'BOM',
      entityId: bom.id,
      action: 'BOM_CREATED',
      newValue: { lineCount: input.lines.length },
      changedBy: input.actor.id,
    });

    return this.getBomWithLines(bom.id);
  }

  async getBomWithLines(id: string) {
    const bom = await db.epcBom.findUnique({ where: { id } });
    const lines = await db.epcBomLine.findMany({ where: { bomId: id } });
    return { ...bom, lines };
  }

  async approveAndLockBom(id: string, actor: Actor) {
    const oldValue = await this.getBomWithLines(id);
    if (!oldValue?.id) throw new Error('BOM not found.');

    const lines = oldValue.lines || [];
    if (lines.length === 0) throw new Error('Cannot approve empty BOM.');

    const shortageSummary = [];
    for (const line of lines) {
      const stock = await db.stockItem.findUnique({ where: { sku: line.sku } });
      const available = money(stock?.quantity);
      if (available < money(line.quantity)) {
        shortageSummary.push({ sku: line.sku, required: line.quantity, available });
      }
    }

    const updated = await db.epcBom.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: actor.id,
        approvedAt: new Date(),
        lockedBy: actor.id,
        lockedAt: new Date(),
        dispatchReadiness: shortageSummary.length ? 'BLOCKED' : 'OPEN',
        shortageSummary,
      },
    });

    await db.epcProject.update({
      where: { id: updated.projectId },
      data: {
        stage: 'BOM_APPROVED',
        dispatchGateStatus: shortageSummary.length ? 'BLOCKED' : 'OPEN',
        nextAction: shortageSummary.length ? 'Resolve material shortage' : 'Clear payment gate for dispatch',
      },
    });

    await this.audit({
      entityType: 'BOM',
      entityId: id,
      action: 'BOM_APPROVED_LOCKED',
      oldValue,
      newValue: { ...updated, shortageSummary },
      changedBy: actor.id,
    });

    return { ...updated, shortageSummary };
  }

  async ensureDispatchAllowed(projectId: string, bomId: string) {
    const [project, bom, paymentPlans, override] = await Promise.all([
      db.epcProject.findUnique({ where: { id: projectId } }),
      db.epcBom.findUnique({ where: { id: bomId } }),
      db.epcPaymentMilestonePlan.findMany({ where: { projectId } }),
      db.epcFounderOverride.findFirst({
        where: {
          projectId,
          entityType: 'PAYMENT',
          status: 'APPROVED',
        },
        orderBy: { approvedAt: 'desc' },
      }),
    ]);

    if (!project) throw new Error('Project not found.');
    if (!bom || bom.status !== 'APPROVED' || !bom.lockedAt) {
      throw new Error('Dispatch blocked. BOM must be approved and locked.');
    }

    const pendingRequiredPayments = paymentPlans.filter((plan: any) => {
      if (plan.status === 'PAID') return false;
      return money(plan.receivedAmount) < money(plan.expectedAmount);
    });

    if (pendingRequiredPayments.length > 0 && !override) {
      throw new Error('Dispatch blocked. Payment milestones are pending and no founder override exists.');
    }

    return { project, bom, override, pendingRequiredPayments };
  }

  async recordMaterialMovement(input: {
    projectId: string;
    customerId?: string;
    bomId?: string;
    movementType: string;
    challanNumber?: string;
    items: JsonObject[];
    receiverName?: string;
    receiverPhone?: string;
    receiverProofUrl?: string;
    sitePhotoUrls?: string[];
    vehicleNumber?: string;
    extraMaterial?: boolean;
    extraApprovalStatus?: string;
    damageReason?: string;
    returnReason?: string;
    actor: Actor;
  }) {
    for (const item of input.items || []) {
      const itemType = String(item.itemType || '').toUpperCase();
      if (itemType === 'MODULE' && (!item.brand || !item.wattage || !item.dcrType)) {
        throw new Error('Module dispatch/return item requires brand, wattage and dcrType.');
      }
      if ((itemType === 'MODULE' || itemType === 'INVERTER') && input.movementType === 'DISPATCH') {
        const serials = Array.isArray(item.serialNumbers) ? item.serialNumbers : [];
        if (!serials.length) throw new Error(`${itemType} dispatch requires serialNumbers.`);
      }
    }

    if (input.movementType === 'DISPATCH') {
      if (!input.bomId) throw new Error('Dispatch requires bomId.');
      await this.ensureDispatchAllowed(input.projectId, input.bomId);
      if (!input.receiverProofUrl) throw new Error('Dispatch receiver proof is mandatory.');
    }

    if (input.extraMaterial && input.extraApprovalStatus !== 'APPROVED') {
      throw new Error('Extra material issue requires approval.');
    }
    if (input.movementType === 'DAMAGED' && !input.damageReason) {
      throw new Error('Damaged material movement requires damageReason.');
    }

    const movement = await db.epcMaterialMovement.create({
      data: {
        projectId: input.projectId,
        customerId: input.customerId,
        bomId: input.bomId,
        movementType: input.movementType,
        challanNumber: input.challanNumber,
        items: input.items,
        receiverName: input.receiverName,
        receiverPhone: input.receiverPhone,
        receiverProofUrl: input.receiverProofUrl,
        sitePhotoUrls: input.sitePhotoUrls || [],
        vehicleNumber: input.vehicleNumber,
        extraMaterial: Boolean(input.extraMaterial),
        extraApprovalStatus: input.extraApprovalStatus || 'NOT_REQUIRED',
        damageReason: input.damageReason,
        returnReason: input.returnReason,
        performedBy: input.actor.id,
      },
    });

    for (const item of input.items || []) {
      const sku = String(item.sku || '');
      const quantity = money(item.qty || item.quantity);
      if (!sku || quantity <= 0) continue;

      const stock = await db.stockItem.findUnique({ where: { sku } });
      if (!stock) continue;

      const isReturn = input.movementType === 'RETURN';
      const isIn = isReturn || input.movementType === 'IN';
      const quantityDelta = isIn ? quantity : -quantity;

      await db.stockItem.update({
        where: { id: stock.id },
        data: { quantity: { increment: quantityDelta } },
      });

      await db.stockTransaction.create({
        data: {
          stockItemId: stock.id,
          type: isIn ? 'IN' : 'OUT',
          quantity,
          reference: input.challanNumber || movement.id,
          notes: `EPC ${input.movementType} auto stock update for project ${input.projectId}`,
          performedBy: input.actor.id,
          customerId: input.customerId,
        },
      });

      if (input.bomId) {
        await db.epcBomLine.updateMany({
          where: { bomId: input.bomId, sku },
          data: isReturn ? { returnedQty: { increment: quantity } } : { issuedQty: { increment: quantity } },
        });
      }

      const serialNumbers = Array.isArray(item.serialNumbers) ? item.serialNumbers.map(String) : [];
      for (const serialNumber of serialNumbers) {
        const itemType = String(item.itemType || 'OTHER').toUpperCase();
        await db.epcInventorySerial.upsert({
          where: { serialNumber },
          update: {
            stockItemId: stock.id,
            sku,
            itemType,
            brand: item.brand as string | undefined,
            model: item.model as string | undefined,
            wattage: item.wattage ? Number(item.wattage) : undefined,
            dcrType: item.dcrType as string | undefined,
            projectId: input.movementType === 'DISPATCH' ? input.projectId : undefined,
            customerId: input.movementType === 'DISPATCH' ? input.customerId : undefined,
            status: input.movementType === 'RETURN' ? 'IN_STOCK' : input.movementType === 'DAMAGED' ? 'DAMAGED' : 'ISSUED',
            issuedAt: input.movementType === 'DISPATCH' ? new Date() : undefined,
            returnedAt: input.movementType === 'RETURN' ? new Date() : undefined,
            damagedAt: input.movementType === 'DAMAGED' ? new Date() : undefined,
          },
          create: {
            stockItemId: stock.id,
            sku,
            itemType,
            brand: item.brand as string | undefined,
            model: item.model as string | undefined,
            wattage: item.wattage ? Number(item.wattage) : undefined,
            dcrType: item.dcrType as string | undefined,
            serialNumber,
            projectId: input.movementType === 'DISPATCH' ? input.projectId : undefined,
            customerId: input.movementType === 'DISPATCH' ? input.customerId : undefined,
            status: input.movementType === 'RETURN' ? 'IN_STOCK' : input.movementType === 'DAMAGED' ? 'DAMAGED' : 'ISSUED',
            receivedAt: input.movementType === 'RETURN' ? new Date() : undefined,
            issuedAt: input.movementType === 'DISPATCH' ? new Date() : undefined,
            damagedAt: input.movementType === 'DAMAGED' ? new Date() : undefined,
          },
        });
      }
    }

    if (input.movementType === 'DISPATCH') {
      await db.epcProject.update({
        where: { id: input.projectId },
        data: { stage: 'DISPATCHED', nextAction: 'Plan installation' },
      });
    }

    await this.audit({
      entityType: 'WAREHOUSE',
      entityId: movement.id,
      action: `MATERIAL_${input.movementType}`,
      newValue: { itemCount: input.items.length, challanNumber: input.challanNumber },
      changedBy: input.actor.id,
    });

    return movement;
  }

  async upsertPaymentPlan(input: {
    projectId: string;
    milestones: Array<{
      milestone: string;
      expectedAmount: number;
      receivedAmount?: number;
      dueAt?: string;
      isAdvance?: boolean;
      isFinal?: boolean;
    }>;
    actor: Actor;
  }) {
    const existingLocked = await db.epcPaymentMilestonePlan.count({
      where: { projectId: input.projectId, lockedAt: { not: null } },
    });
    if (existingLocked > 0 && !['ADMIN', 'PROJECT_HEAD'].includes(input.actor.role || '')) {
      throw new Error('Payment plan is locked after posting. Founder/project-head approval is required to change it.');
    }

    await db.epcPaymentMilestonePlan.deleteMany({ where: { projectId: input.projectId } });
    await db.epcPaymentMilestonePlan.createMany({
      data: input.milestones.map((m) => ({
        projectId: input.projectId,
        milestone: m.milestone,
        expectedAmount: money(m.expectedAmount),
        receivedAmount: money(m.receivedAmount),
        dueAt: m.dueAt ? new Date(m.dueAt) : undefined,
        isAdvance: Boolean(m.isAdvance),
        isFinal: Boolean(m.isFinal),
        status: money(m.receivedAmount) >= money(m.expectedAmount) ? 'PAID' : 'PENDING',
        lockedAt: new Date(),
        lockedBy: input.actor.id,
      })),
    });

    await this.audit({
      entityType: 'PAYMENT',
      entityId: input.projectId,
      action: 'PAYMENT_PLAN_UPSERTED',
      newValue: { milestones: input.milestones },
      changedBy: input.actor.id,
    });

    return db.epcPaymentMilestonePlan.findMany({ where: { projectId: input.projectId } });
  }

  async generatePaymentReminders(actor: Actor) {
    const now = new Date();
    const plans = await db.epcPaymentMilestonePlan.findMany({
      where: { status: { not: 'PAID' }, dueAt: { lt: now } },
      take: 200,
    });
    const projectMap = await this.projectContext(plans.map((plan: any) => plan.projectId));
    let created = 0;

    for (const plan of plans as any[]) {
      const context = projectMap.get(plan.projectId);
      const project = await db.epcProject.findUnique({ where: { id: plan.projectId } });
      const notifyUserId = project?.accountsOwnerId || project?.salesOwnerId || project?.projectOwnerId;
      if (!notifyUserId) continue;

      const existing = await db.notification.findFirst({
        where: {
          userId: notifyUserId,
          type: 'PAYMENT_REMINDER',
          entityId: plan.id,
          isRead: false,
        },
      });
      if (existing) continue;

      await db.notification.create({
        data: {
          userId: notifyUserId,
          type: 'PAYMENT_REMINDER',
          title: 'Overdue payment reminder',
          message: `${context?.customerName || context?.projectCode || 'Project'} has overdue ${plan.milestone} payment of ${money(plan.expectedAmount) - money(plan.receivedAmount)}.`,
          entityType: 'PAYMENT',
          entityId: plan.id,
        },
      });
      await db.epcPaymentMilestonePlan.update({
        where: { id: plan.id },
        data: { reminderSentAt: now },
      });
      created += 1;
    }

    await this.audit({
      entityType: 'PAYMENT',
      entityId: 'PAYMENT_REMINDERS',
      action: 'PAYMENT_REMINDERS_GENERATED',
      newValue: { checked: plans.length, created },
      changedBy: actor.id,
    });

    return { checked: plans.length, created };
  }

  async recordActualProjectCost(input: {
    projectId: string;
    category: string;
    amount: number;
    source?: string;
    reference?: string;
    notes?: string;
    actor: Actor;
  }) {
    if (!input.category?.trim()) throw new Error('Actual cost category is mandatory.');
    if (money(input.amount) <= 0) throw new Error('Actual cost amount must be greater than zero.');

    const cost = await db.epcActualProjectCost.create({
      data: {
        projectId: input.projectId,
        category: input.category,
        amount: money(input.amount),
        source: input.source,
        reference: input.reference,
        notes: input.notes,
        recordedBy: input.actor.id,
      },
    });

    await this.audit({
      entityType: 'REPORT',
      entityId: cost.id,
      action: 'ACTUAL_PROJECT_COST_RECORDED',
      newValue: cost,
      changedBy: input.actor.id,
    });

    return cost;
  }

  async getActualProjectCosts(projectId?: string) {
    return db.epcActualProjectCost.findMany({
      where: projectId ? { projectId } : undefined,
      orderBy: { recordedAt: 'desc' },
      take: 500,
    });
  }

  async requestFounderOverride(input: {
    projectId?: string;
    entityType: string;
    entityId: string;
    reason: string;
    actor: Actor;
  }) {
    const override = await db.epcFounderOverride.create({
      data: {
        projectId: input.projectId,
        entityType: input.entityType,
        entityId: input.entityId,
        reason: input.reason,
        requestedBy: input.actor.id,
      },
    });

    await this.audit({
      entityType: input.entityType,
      entityId: input.entityId,
      action: 'FOUNDER_OVERRIDE_REQUESTED',
      newValue: { reason: input.reason },
      changedBy: input.actor.id,
    });

    return override;
  }

  async approveFounderOverride(id: string, actor: Actor) {
    const override = await db.epcFounderOverride.update({
      where: { id },
      data: { status: 'APPROVED', approvedBy: actor.id, approvedAt: new Date() },
    });

    await this.audit({
      entityType: override.entityType,
      entityId: override.entityId,
      action: 'FOUNDER_OVERRIDE_APPROVED',
      approvalId: override.id,
      changedBy: actor.id,
      newValue: override,
    });

    return override;
  }

  async saveInstallation(input: {
    projectId: string;
    installationTeamId?: string;
    plannedInstallationAt?: string;
    actualInstallationAt?: string;
    statuses: JsonObject;
    mandatoryPhotoUrls?: string[];
    delayReason?: string;
    delayOwnerDepartment?: string;
    qcStatus?: string;
    punchPoints?: Array<{
      title: string;
      ownerDepartment: string;
      ownerUserId?: string;
      severity?: string;
      dueAt?: string;
      proofUrl?: string;
    }>;
    actor: Actor;
  }) {
    const requiredStatuses = [
      'structureStatus',
      'moduleMountingStatus',
      'dcWiringStatus',
      'acWiringStatus',
      'inverterInstallationStatus',
      'earthingStatus',
      'testingStatus',
      'handoverStatus',
    ];

    const isClosing = Boolean(input.actualInstallationAt);
    if (isClosing) {
      const incomplete = requiredStatuses.filter((key) => input.statuses[key] !== 'DONE');
      if (incomplete.length) throw new Error(`Installation close blocked. Incomplete checklist: ${incomplete.join(', ')}`);
      if (!input.mandatoryPhotoUrls?.length) throw new Error('Installation close blocked. Site photos are mandatory.');
      if (input.plannedInstallationAt && new Date(input.actualInstallationAt!) > new Date(input.plannedInstallationAt)) {
        if (!input.delayReason) throw new Error('Delay reason is mandatory when actual installation is after planned date.');
        if (!input.delayOwnerDepartment) throw new Error('Delay owner department is mandatory when installation is delayed.');
      }
    }

    const installation = await db.epcInstallationControl.upsert({
      where: { projectId: input.projectId },
      update: {
        installationTeamId: input.installationTeamId,
        plannedInstallationAt: input.plannedInstallationAt ? new Date(input.plannedInstallationAt) : undefined,
        actualInstallationAt: input.actualInstallationAt ? new Date(input.actualInstallationAt) : undefined,
        ...input.statuses,
        mandatoryPhotoUrls: input.mandatoryPhotoUrls || [],
        delayReason: input.delayReason,
        delayOwnerDepartment: input.delayOwnerDepartment,
        qcStatus: input.qcStatus || 'PENDING',
      },
      create: {
        projectId: input.projectId,
        installationTeamId: input.installationTeamId,
        plannedInstallationAt: input.plannedInstallationAt ? new Date(input.plannedInstallationAt) : undefined,
        actualInstallationAt: input.actualInstallationAt ? new Date(input.actualInstallationAt) : undefined,
        ...input.statuses,
        mandatoryPhotoUrls: input.mandatoryPhotoUrls || [],
        delayReason: input.delayReason,
        delayOwnerDepartment: input.delayOwnerDepartment,
        qcStatus: input.qcStatus || 'PENDING',
      },
    });

    if (isClosing) {
      const openPunchPoints = await db.epcPunchPoint.count({
        where: { projectId: input.projectId, status: { not: 'DONE' } },
      });
      if (openPunchPoints > 0) {
        throw new Error(`Installation close blocked. ${openPunchPoints} punch point(s) are still open.`);
      }

      const finalMilestones = await db.epcPaymentMilestonePlan.findMany({
        where: { projectId: input.projectId, isFinal: true },
      });
      const finalPending = finalMilestones.find(
        (plan: any) => plan.status !== 'PAID' || money(plan.receivedAmount) < money(plan.expectedAmount)
      );
      if (finalPending) {
        await db.notification.create({
          data: {
            userId: input.actor.id,
            type: 'FINAL_PAYMENT_PENDING',
            title: 'Final payment pending after installation',
            message: `Final payment milestone ${finalPending.milestone} is still pending after installation close.`,
            entityType: 'PAYMENT',
            entityId: finalPending.id,
          },
        });
      }

      await db.epcProject.update({
        where: { id: input.projectId },
        data: { stage: 'INSTALLATION_DONE', installationGateStatus: 'OPEN', nextAction: 'Complete QC' },
      });
    }

    if (input.punchPoints?.length) {
      await db.epcPunchPoint.createMany({
        data: input.punchPoints.map((point) => ({
          projectId: input.projectId,
          installationId: installation.id,
          title: point.title,
          ownerDepartment: point.ownerDepartment,
          ownerUserId: point.ownerUserId,
          severity: point.severity || 'MEDIUM',
          dueAt: point.dueAt ? new Date(point.dueAt) : undefined,
          proofUrl: point.proofUrl,
          createdBy: input.actor.id,
        })),
      });
    }

    await this.audit({
      entityType: 'INSTALLATION',
      entityId: installation.id,
      action: isClosing ? 'INSTALLATION_CLOSED_WITH_PROOF' : 'INSTALLATION_UPDATED',
      newValue: { isClosing },
      changedBy: input.actor.id,
    });

    return installation;
  }

  async createPunchPoint(input: {
    projectId: string;
    installationId?: string;
    title: string;
    ownerDepartment: string;
    ownerUserId?: string;
    severity?: string;
    dueAt?: string;
    proofUrl?: string;
    actor: Actor;
  }) {
    const point = await db.epcPunchPoint.create({
      data: {
        projectId: input.projectId,
        installationId: input.installationId,
        title: input.title,
        ownerDepartment: input.ownerDepartment,
        ownerUserId: input.ownerUserId,
        severity: input.severity || 'MEDIUM',
        dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
        proofUrl: input.proofUrl,
        createdBy: input.actor.id,
      },
    });

    await this.audit({
      entityType: 'INSTALLATION',
      entityId: point.id,
      action: 'PUNCH_POINT_CREATED',
      newValue: point,
      changedBy: input.actor.id,
    });

    return point;
  }

  async closePunchPoint(id: string, input: { proofUrl?: string; actor: Actor }) {
    const oldValue = await db.epcPunchPoint.findUnique({ where: { id } });
    if (!oldValue) throw new Error('Punch point not found.');
    if (!input.proofUrl && !oldValue.proofUrl) throw new Error('Punch point closure requires proofUrl.');

    const point = await db.epcPunchPoint.update({
      where: { id },
      data: {
        status: 'DONE',
        closedAt: new Date(),
        proofUrl: input.proofUrl || oldValue.proofUrl,
      },
    });

    await this.audit({
      entityType: 'INSTALLATION',
      entityId: id,
      action: 'PUNCH_POINT_CLOSED',
      oldValue,
      newValue: point,
      changedBy: input.actor.id,
    });

    return point;
  }

  async listPunchPoints(projectId?: string) {
    const points = await db.epcPunchPoint.findMany({
      where: projectId ? { projectId } : undefined,
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
      take: 200,
    });
    const projectMap = await this.projectContext(points.map((point: any) => point.projectId));
    return points.map((point: any) => ({
      ...projectMap.get(point.projectId),
      punchPointId: point.id,
      title: point.title,
      ownerDepartment: point.ownerDepartment,
      severity: point.severity,
      status: point.status,
      dueAt: point.dueAt,
      closedAt: point.closedAt,
      proofUrl: point.proofUrl || '',
      daysOpen: point.closedAt ? this.daysBetween(point.createdAt, point.closedAt) : this.daysBetween(point.createdAt),
    }));
  }

  async upsertSubsidyTracker(input: JsonObject & { projectId: string; actor: Actor }) {
    const tracker = await db.epcSubsidyTracker.upsert({
      where: { projectId: input.projectId },
      update: {
        customerId: input.customerId as string | undefined,
        caNumber: input.caNumber as string | undefined,
        subsidyId: input.subsidyId as string | undefined,
        b2cClaimId: input.b2cClaimId as string | undefined,
        dcrCertificateStatus: input.dcrCertificateStatus || undefined,
        customerDocsStatus: input.customerDocsStatus || undefined,
        firstStageApplicationStatus: input.firstStageApplicationStatus || undefined,
        discomApprovalStatus: input.discomApprovalStatus || undefined,
        netMeterFileStatus: input.netMeterFileStatus || undefined,
        inspectionStatus: input.inspectionStatus || undefined,
        netMeterInstalledStatus: input.netMeterInstalledStatus || undefined,
        subsidyClaimSubmittedStatus: input.subsidyClaimSubmittedStatus || undefined,
        subsidyReceivedStatus: input.subsidyReceivedStatus || undefined,
        currentStage: input.currentStage || undefined,
        delayReason: input.delayReason as string | undefined,
        delayOwnerDepartment: input.delayOwnerDepartment as string | undefined,
        assignedTo: input.assignedTo as string | undefined,
      },
      create: {
        projectId: input.projectId,
        customerId: input.customerId as string | undefined,
        caNumber: input.caNumber as string | undefined,
        subsidyId: input.subsidyId as string | undefined,
        b2cClaimId: input.b2cClaimId as string | undefined,
        dcrCertificateStatus: input.dcrCertificateStatus || 'PENDING',
        customerDocsStatus: input.customerDocsStatus || 'PENDING',
        firstStageApplicationStatus: input.firstStageApplicationStatus || 'PENDING',
        discomApprovalStatus: input.discomApprovalStatus || 'PENDING',
        netMeterFileStatus: input.netMeterFileStatus || 'PENDING',
        inspectionStatus: input.inspectionStatus || 'PENDING',
        netMeterInstalledStatus: input.netMeterInstalledStatus || 'PENDING',
        subsidyClaimSubmittedStatus: input.subsidyClaimSubmittedStatus || 'PENDING',
        subsidyReceivedStatus: input.subsidyReceivedStatus || 'PENDING',
        currentStage: input.currentStage || 'CUSTOMER_DOCS',
        delayReason: input.delayReason as string | undefined,
        delayOwnerDepartment: input.delayOwnerDepartment as string | undefined,
        assignedTo: input.assignedTo as string | undefined,
      },
    });

    await this.audit({
      entityType: 'DOCUMENTATION',
      entityId: tracker.id,
      action: 'SUBSIDY_TRACKER_UPDATED',
      newValue: tracker,
      changedBy: input.actor.id,
    });

    return tracker;
  }

  async getFounderControlRoom() {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const start = new Date(`${today}T00:00:00.000Z`);
    const end = new Date(`${today}T23:59:59.999Z`);

    const [
      dailyLeads,
      missedFollowUps,
      siteVisitsPlanned,
      siteVisitsDone,
      quotationsSent,
      lowMarginQuotations,
      advanceReceived,
      dispatchCount,
      materialReturnCount,
      paymentPending,
      materialStuck,
      installationStuck,
      netMeteringStuck,
      qcPending,
      lateAttendance,
      designPending,
      openPunchPoints,
    ] = await Promise.all([
      db.lead.count({ where: { createdAt: { gte: start, lte: end } } }),
      db.epcLeadControl.count({ where: { nextFollowUpAt: { lt: now }, missedFollowUpAt: null } }),
      db.visit.count({ where: { scheduledAt: { gte: start, lte: end } } }),
      db.visit.count({ where: { scheduledAt: { gte: start, lte: end }, status: 'COMPLETED' } }),
      db.epcQuotationCostSheet.count({ where: { sentAt: { gte: start, lte: end } } }),
      db.epcQuotationCostSheet.count({ where: { lowMarginWarning: true, createdAt: { gte: start, lte: end } } }),
      db.payment.aggregate({ where: { milestone: 'BOOKING', paymentDate: { gte: start, lte: end } }, _sum: { amount: true } }),
      db.epcMaterialMovement.count({ where: { movementType: 'DISPATCH', performedAt: { gte: start, lte: end } } }),
      db.epcMaterialMovement.count({ where: { movementType: 'RETURN', performedAt: { gte: start, lte: end } } }),
      db.epcPaymentMilestonePlan.count({ where: { status: { not: 'PAID' }, dueAt: { lt: now } } }),
      db.epcProject.count({ where: { stage: { in: ['BOM_APPROVED', 'PAYMENT_GATE_PENDING'] }, dispatchGateStatus: 'BLOCKED' } }),
      db.epcProject.count({ where: { stage: { in: ['DISPATCHED', 'INSTALLATION_PLANNED'] } } }),
      db.epcSubsidyTracker.count({ where: { subsidyReceivedStatus: { not: 'DONE' } } }),
      db.epcInstallationControl.count({ where: { qcStatus: { not: 'DONE' } } }),
      db.dailyAttendance.count({ where: { date: today, status: { not: 'PRESENT' } } }),
      db.epcDesignControl.count({ where: { requiredStatus: { not: 'NOT_REQUIRED' }, status: { not: 'DONE' } } }),
      db.epcPunchPoint.count({ where: { status: { not: 'DONE' } } }),
    ]);

    const redAlerts = {
      paymentPending,
      materialStuck,
      installationStuck,
      netMeteringStuck,
      qcPending,
      missedFollowUps,
      designPending,
      openPunchPoints,
    };

    const snapshot = {
      snapshotDate: today,
      dailyLeads,
      missedFollowUps,
      siteVisitsPlanned,
      siteVisitsDone,
      quotationsSent,
      lowMarginQuotations,
      advanceReceivedAmount: money(advanceReceived._sum.amount),
      dispatchCount,
      materialReturnCount,
      criticalPaymentPendingCount: paymentPending,
      materialStuckCount: materialStuck,
      installationStuckCount: installationStuck,
      netMeteringStuckCount: netMeteringStuck,
      qcPendingCount: qcPending,
      lateAttendanceCount: lateAttendance,
      designPendingCount: designPending,
      openPunchPointCount: openPunchPoints,
      redAlerts,
      departmentAccountability: {
        Sales: { missedFollowUps, lowMarginQuotations },
        Warehouse: { materialStuck, dispatchCount, materialReturnCount },
        Accounts: { paymentPending },
        Installation: { installationStuck, qcPending },
        Documentation: { netMeteringStuck },
        Design: { designPending },
        Project: { openPunchPoints },
      },
      autoSummary: `Today: ${dailyLeads} leads, ${missedFollowUps} missed follow-ups, ${paymentPending} overdue payments, ${materialStuck} material-stuck projects, ${installationStuck} installation-stuck projects, ${designPending} design pending, ${openPunchPoints} open punch points.`,
    };

    await db.epcFounderDailySnapshot.upsert({
      where: { snapshotDate: today },
      update: snapshot,
      create: snapshot,
    });

    return snapshot;
  }

  async getFounderControlRoomDrilldown(type: string) {
    const { now, today, start, end } = this.dayWindow();

    switch (type) {
      case 'daily-leads': {
        const leads = await db.lead.findMany({
          where: { createdAt: { gte: start, lte: end } },
          orderBy: { createdAt: 'desc' },
          take: 100,
        });
        const leadMap = await this.leadContext(leads.map((lead: any) => lead.id));
        return this.drilldownResponse(
          type,
          'Daily Leads',
          leads.map((lead: any) => ({
            ...leadMap.get(lead.id),
            source: lead.source || '',
            createdAt: lead.createdAt,
            remarks: lead.lostReason || '',
          }))
        );
      }

      case 'missed-followups': {
        const controls = await db.epcLeadControl.findMany({
          where: { nextFollowUpAt: { lt: now }, missedFollowUpAt: null },
          orderBy: { nextFollowUpAt: 'asc' },
          take: 100,
        });
        const leadMap = await this.leadContext(controls.map((control: any) => control.leadId));
        return this.drilldownResponse(
          type,
          'Missed Follow-ups',
          controls.map((control: any) => ({
            ...leadMap.get(control.leadId),
            mobile: control.mobile,
            caNumber: control.caNumber || '',
            nextFollowUpAt: control.nextFollowUpAt,
            daysOverdue: this.daysBetween(control.nextFollowUpAt, now),
            hotScore: control.hotScore,
            isHot: control.isHot ? 'Yes' : 'No',
            sourceDetail: control.sourceDetail || '',
            remarks: control.lostReason || '',
          }))
        );
      }

      case 'site-visits': {
        const visits = await db.visit.findMany({
          where: { scheduledAt: { gte: start, lte: end } },
          include: {
            lead: true,
            customer: true,
            assignee: { select: { name: true, role: true } },
          },
          orderBy: { scheduledAt: 'asc' },
          take: 100,
        });
        return this.drilldownResponse(
          type,
          'Site Visits Planned vs Done',
          visits.map((visit: any) => ({
            visitType: visit.visitType,
            customerName: visit.customer?.name || visit.lead?.name || 'Not linked',
            customerPhone: visit.customer?.phone || visit.lead?.phone || '',
            city: visit.customer?.city || visit.lead?.city || '',
            address: visit.address,
            status: visit.status,
            assignedTo: visit.assignee?.name || 'Unassigned',
            scheduledAt: visit.scheduledAt,
            checkInAt: visit.checkInAt,
            remarks: visit.notes || '',
          }))
        );
      }

      case 'quotations-sent':
      case 'low-margin-quotations': {
        const where =
          type === 'quotations-sent'
            ? { sentAt: { gte: start, lte: end } }
            : { lowMarginWarning: true, createdAt: { gte: start, lte: end } };
        const quotations = await db.epcQuotationCostSheet.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: 100,
        });
        const projectMap = await this.projectContext(quotations.map((quotation: any) => quotation.projectId).filter(Boolean));
        const leadMap = await this.leadContext(quotations.map((quotation: any) => quotation.leadId).filter(Boolean));
        return this.drilldownResponse(
          type,
          type === 'quotations-sent' ? 'Quotations Sent Today' : 'Low Margin Quotations',
          quotations.map((quotation: any) => ({
            ...(quotation.projectId ? projectMap.get(quotation.projectId) : leadMap.get(quotation.leadId)),
            quotationId: quotation.id,
            revisionNo: quotation.revisionNo,
            module: `${quotation.moduleBrand} ${quotation.moduleWattage}W`,
            inverter: `${quotation.inverterBrand} ${quotation.inverterKw}kW`,
            totalCost: quotation.totalCost,
            sellingPrice: quotation.sellingPrice,
            grossProfit: quotation.grossProfit,
            marginPercent: quotation.marginPercent,
            founderApprovalStatus: quotation.founderApprovalStatus,
            sentAt: quotation.sentAt,
            remarks: quotation.lowMarginWarning ? 'Low margin warning active' : '',
          }))
        );
      }

      case 'advance-received': {
        const payments = await db.payment.findMany({
          where: { milestone: 'BOOKING', paymentDate: { gte: start, lte: end } },
          include: {
            customer: true,
            recorder: { select: { name: true, role: true } },
          },
          orderBy: { paymentDate: 'desc' },
          take: 100,
        });
        return this.drilldownResponse(
          type,
          'Advance Received Today',
          payments.map((payment: any) => ({
            customerCode: payment.customer?.customerCode || '',
            customerName: payment.customer?.name || 'Not linked',
            customerPhone: payment.customer?.phone || '',
            city: payment.customer?.city || '',
            amount: payment.amount,
            mode: payment.mode,
            milestone: payment.milestone,
            paymentDate: payment.paymentDate,
            recordedBy: payment.recorder?.name || '',
            transactionRef: payment.transactionRef || '',
            remarks: payment.notes || '',
          }))
        );
      }

      case 'dispatches-today':
      case 'material-returns-today': {
        const movementType = type === 'dispatches-today' ? 'DISPATCH' : 'RETURN';
        const movements = await db.epcMaterialMovement.findMany({
          where: { movementType, performedAt: { gte: start, lte: end } },
          orderBy: { performedAt: 'desc' },
          take: 100,
        });
        const projectMap = await this.projectContext(movements.map((movement: any) => movement.projectId));
        return this.drilldownResponse(
          type,
          movementType === 'DISPATCH' ? 'Material Dispatches Today' : 'Material Returns Today',
          movements.map((movement: any) => ({
            ...projectMap.get(movement.projectId),
            challanNumber: movement.challanNumber || '',
            receiverName: movement.receiverName || '',
            receiverPhone: movement.receiverPhone || '',
            extraMaterial: movement.extraMaterial ? 'Yes' : 'No',
            extraApprovalStatus: movement.extraApprovalStatus,
            performedAt: movement.performedAt,
            remarks: movement.returnReason || movement.damageReason || '',
          }))
        );
      }

      case 'payment-pending': {
        const plans = await db.epcPaymentMilestonePlan.findMany({
          where: { status: { not: 'PAID' }, dueAt: { lt: now } },
          orderBy: { dueAt: 'asc' },
          take: 100,
        });
        const projectMap = await this.projectContext(plans.map((plan: any) => plan.projectId));
        return this.drilldownResponse(
          type,
          'Overdue Payment Pending',
          plans.map((plan: any) => ({
            ...projectMap.get(plan.projectId),
            milestone: plan.milestone,
            expectedAmount: plan.expectedAmount,
            receivedAmount: plan.receivedAmount,
            pendingAmount: money(plan.expectedAmount) - money(plan.receivedAmount),
            dueAt: plan.dueAt,
            daysOverdue: this.daysBetween(plan.dueAt, now),
            status: plan.status,
            reminderSentAt: plan.reminderSentAt,
            remarks: 'Dispatch/payment gate should stay blocked unless founder approves override.',
          }))
        );
      }

      case 'material-stuck': {
        const projects = await db.epcProject.findMany({
          where: { stage: { in: ['BOM_APPROVED', 'PAYMENT_GATE_PENDING'] }, dispatchGateStatus: 'BLOCKED' },
          orderBy: { updatedAt: 'asc' },
          take: 100,
        });
        const projectMap = await this.projectContext(projects.map((project: any) => project.id));
        const boms = await db.epcBom.findMany({
          where: { projectId: { in: projects.map((project: any) => project.id) } },
          orderBy: { updatedAt: 'desc' },
        });
        const bomMap = new Map(boms.map((bom: any) => [bom.projectId, bom]));
        return this.drilldownResponse(
          type,
          'Material Stuck Projects',
          projects.map((project: any) => {
            const bom: any = bomMap.get(project.id);
            return {
              ...projectMap.get(project.id),
              dispatchGateStatus: project.dispatchGateStatus,
              paymentGateStatus: project.paymentGateStatus,
              bomStatus: bom?.status || 'No BOM',
              dispatchReadiness: bom?.dispatchReadiness || '',
              shortageSummary: bom?.shortageSummary ? JSON.stringify(bom.shortageSummary) : '',
              updatedAt: project.updatedAt,
              daysStuck: this.daysBetween(project.updatedAt, now),
              remarks: project.delayReason || 'Dispatch blocked, check BOM/payment/stock readiness.',
            };
          })
        );
      }

      case 'installation-stuck': {
        const projects = await db.epcProject.findMany({
          where: { stage: { in: ['DISPATCHED', 'INSTALLATION_PLANNED'] } },
          orderBy: { updatedAt: 'asc' },
          take: 100,
        });
        const projectMap = await this.projectContext(projects.map((project: any) => project.id));
        const controls = await db.epcInstallationControl.findMany({
          where: { projectId: { in: projects.map((project: any) => project.id) } },
        });
        const controlMap = new Map(controls.map((control: any) => [control.projectId, control]));
        return this.drilldownResponse(
          type,
          'Installation Stuck Projects',
          projects.map((project: any) => {
            const control: any = controlMap.get(project.id);
            return {
              ...projectMap.get(project.id),
              plannedInstallationAt: control?.plannedInstallationAt || '',
              actualInstallationAt: control?.actualInstallationAt || '',
              structureStatus: control?.structureStatus || 'PENDING',
              moduleMountingStatus: control?.moduleMountingStatus || 'PENDING',
              testingStatus: control?.testingStatus || 'PENDING',
              handoverStatus: control?.handoverStatus || 'PENDING',
              qcStatus: control?.qcStatus || 'PENDING',
              daysStuck: this.daysBetween(control?.plannedInstallationAt || project.updatedAt, now),
              remarks: control?.delayReason || project.delayReason || 'Installation needs owner follow-up.',
            };
          })
        );
      }

      case 'net-metering-stuck': {
        const trackers = await db.epcSubsidyTracker.findMany({
          where: { subsidyReceivedStatus: { not: 'DONE' } },
          orderBy: { updatedAt: 'asc' },
          take: 100,
        });
        const projectMap = await this.projectContext(trackers.map((tracker: any) => tracker.projectId));
        return this.drilldownResponse(
          type,
          'Net Metering / Subsidy Stuck',
          trackers.map((tracker: any) => ({
            ...projectMap.get(tracker.projectId),
            caNumber: tracker.caNumber || '',
            subsidyId: tracker.subsidyId || '',
            b2cClaimId: tracker.b2cClaimId || '',
            currentStage: tracker.currentStage,
            customerDocsStatus: tracker.customerDocsStatus,
            discomApprovalStatus: tracker.discomApprovalStatus,
            inspectionStatus: tracker.inspectionStatus,
            netMeterInstalledStatus: tracker.netMeterInstalledStatus,
            subsidyClaimSubmittedStatus: tracker.subsidyClaimSubmittedStatus,
            subsidyReceivedStatus: tracker.subsidyReceivedStatus,
            updatedAt: tracker.updatedAt,
            daysStuck: this.daysBetween(tracker.updatedAt, now),
            remarks: tracker.delayReason || 'Documentation/subsidy stage pending.',
          }))
        );
      }

      case 'qc-pending': {
        const controls = await db.epcInstallationControl.findMany({
          where: { qcStatus: { not: 'DONE' } },
          orderBy: { updatedAt: 'asc' },
          take: 100,
        });
        const projectMap = await this.projectContext(controls.map((control: any) => control.projectId));
        return this.drilldownResponse(
          type,
          'QC Pending Projects',
          controls.map((control: any) => ({
            ...projectMap.get(control.projectId),
            plannedInstallationAt: control.plannedInstallationAt,
            actualInstallationAt: control.actualInstallationAt,
            structureStatus: control.structureStatus,
            moduleMountingStatus: control.moduleMountingStatus,
            dcWiringStatus: control.dcWiringStatus,
            acWiringStatus: control.acWiringStatus,
            inverterInstallationStatus: control.inverterInstallationStatus,
            earthingStatus: control.earthingStatus,
            testingStatus: control.testingStatus,
            handoverStatus: control.handoverStatus,
            qcStatus: control.qcStatus,
            updatedAt: control.updatedAt,
            daysPending: this.daysBetween(control.updatedAt, now),
            remarks: control.delayReason || 'QC cannot be closed without proof/photos.',
          }))
        );
      }

      case 'late-attendance': {
        const rows = await db.dailyAttendance.findMany({
          where: { date: today, status: { not: 'PRESENT' } },
          include: { user: { select: { name: true, email: true, role: true, phone: true } } },
          orderBy: { createdAt: 'desc' },
          take: 100,
        });
        return this.drilldownResponse(
          type,
          'Late / Missing Attendance',
          rows.map((row: any) => ({
            userName: row.user?.name || 'Unknown',
            role: row.user?.role || '',
            phone: row.user?.phone || '',
            email: row.user?.email || '',
            date: row.date,
            status: row.status,
            checkInAt: row.checkInAt,
            locationType: row.locationType || '',
            remarks: row.notes || '',
          }))
        );
      }

      case 'design-pending': {
        return this.drilldownResponse(type, 'Design Pending / Overdue', await this.getDesignQueue());
      }

      case 'punch-points': {
        const rows = await this.listPunchPoints();
        return this.drilldownResponse(
          type,
          'Open Punch Points',
          rows.filter((row: any) => row.status !== 'DONE')
        );
      }

      default:
        throw new Error(`Unknown founder drilldown type: ${type}`);
    }
  }

  async getProjectProfitabilityReport() {
    const projects = await db.epcProject.findMany({ orderBy: { updatedAt: 'desc' }, take: 200 });
    const projectIds = projects.map((project: any) => project.id);
    const projectMap = await this.projectContext(projectIds);
    const [quotations, paymentPlans, movements, boms, actualCosts] = await Promise.all([
      db.epcQuotationCostSheet.findMany({ where: { projectId: { in: projectIds } }, orderBy: { revisionNo: 'desc' } }),
      db.epcPaymentMilestonePlan.findMany({ where: { projectId: { in: projectIds } } }),
      db.epcMaterialMovement.findMany({ where: { projectId: { in: projectIds } } }),
      db.epcBom.findMany({ where: { projectId: { in: projectIds } } }),
      db.epcActualProjectCost.findMany({ where: { projectId: { in: projectIds } } }),
    ]);

    const latestQuote = new Map<string, any>();
    for (const quote of quotations) {
      if (!latestQuote.has(quote.projectId)) latestQuote.set(quote.projectId, quote);
    }

    return projects.map((project: any) => {
      const quote = latestQuote.get(project.id);
      const plans = paymentPlans.filter((plan: any) => plan.projectId === project.id);
      const projectMovements = movements.filter((movement: any) => movement.projectId === project.id);
      const projectBoms = boms.filter((bom: any) => bom.projectId === project.id);
      const expectedCollection = plans.reduce((sum: number, plan: any) => sum + money(plan.expectedAmount), 0);
      const receivedCollection = plans.reduce((sum: number, plan: any) => sum + money(plan.receivedAmount), 0);
      const pendingCollection = Math.max(expectedCollection - receivedCollection, 0);
      const dispatchCount = projectMovements.filter((movement: any) => movement.movementType === 'DISPATCH').length;
      const returnCount = projectMovements.filter((movement: any) => movement.movementType === 'RETURN').length;
      const estimatedProfit = money(quote?.grossProfit);
      const estimatedMarginPercent = money(quote?.marginPercent);
      const actualCost = actualCosts
        .filter((cost: any) => cost.projectId === project.id)
        .reduce((sum: number, cost: any) => sum + money(cost.amount), 0);
      const actualProfit = money(project.projectValue) - actualCost;
      const actualMarginPercent = money(project.projectValue) > 0 ? Number(((actualProfit / money(project.projectValue)) * 100).toFixed(2)) : 0;

      return {
        ...projectMap.get(project.id),
        projectValue: project.projectValue,
        estimatedCost: money(quote?.totalCost),
        estimatedProfit,
        estimatedMarginPercent,
        actualCost,
        actualProfit,
        actualMarginPercent,
        marginVariancePercent: Number((actualMarginPercent - estimatedMarginPercent).toFixed(2)),
        expectedCollection,
        receivedCollection,
        pendingCollection,
        dispatchCount,
        returnCount,
        bomRevisionCount: projectBoms.length,
        paymentGateStatus: project.paymentGateStatus,
        dispatchGateStatus: project.dispatchGateStatus,
        remarks: quote ? 'Estimated and actual margin compared from latest quotation and actual project cost ledger.' : 'No quotation cost sheet linked.',
      };
    });
  }

  async getBomDispatchComparisonReport() {
    const boms = await db.epcBom.findMany({ where: { status: 'APPROVED' }, orderBy: { updatedAt: 'desc' }, take: 200 });
    const bomIds = boms.map((bom: any) => bom.id);
    const [lines, movements] = await Promise.all([
      db.epcBomLine.findMany({ where: { bomId: { in: bomIds } } }),
      db.epcMaterialMovement.findMany({ where: { bomId: { in: bomIds }, movementType: 'DISPATCH' } }),
    ]);
    const projectMap = await this.projectContext(boms.map((bom: any) => bom.projectId));

    return lines.map((line: any) => {
      const bom = boms.find((candidate: any) => candidate.id === line.bomId);
      const dispatchedQty = movements
        .filter((movement: any) => movement.bomId === line.bomId)
        .flatMap((movement: any) => movement.items || [])
        .filter((item: any) => item.sku === line.sku)
        .reduce((sum: number, item: any) => sum + money(item.qty || item.quantity), 0);
      return {
        ...projectMap.get(bom?.projectId),
        bomId: line.bomId,
        revisionNo: bom?.revisionNo,
        sku: line.sku,
        itemName: line.itemName,
        brand: line.brand || '',
        wattage: line.wattage || '',
        dcrType: line.dcrType || '',
        approvedQty: line.approvedQty || line.quantity,
        dispatchedQty,
        varianceQty: dispatchedQty - money(line.approvedQty || line.quantity),
        status: dispatchedQty === money(line.approvedQty || line.quantity) ? 'MATCHED' : dispatchedQty > money(line.approvedQty || line.quantity) ? 'OVER_DISPATCH' : 'SHORT_DISPATCH',
      };
    });
  }

  async getSerialReport() {
    const serials = await db.epcInventorySerial.findMany({ orderBy: { updatedAt: 'desc' }, take: 500 });
    const projectMap = await this.projectContext(serials.map((serial: any) => serial.projectId).filter(Boolean));
    return serials.map((serial: any) => ({
      ...projectMap.get(serial.projectId),
      serialNumber: serial.serialNumber,
      sku: serial.sku,
      itemType: serial.itemType,
      brand: serial.brand || '',
      model: serial.model || '',
      wattage: serial.wattage || '',
      dcrType: serial.dcrType || '',
      status: serial.status,
      issuedAt: serial.issuedAt,
      returnedAt: serial.returnedAt,
      damagedAt: serial.damagedAt,
    }));
  }

  async getDamagedMaterialReport() {
    const movements = await db.epcMaterialMovement.findMany({
      where: { OR: [{ movementType: 'DAMAGED' }, { damageReason: { not: null } }] },
      orderBy: { performedAt: 'desc' },
      take: 200,
    });
    const projectMap = await this.projectContext(movements.map((movement: any) => movement.projectId));
    return movements.map((movement: any) => ({
      ...projectMap.get(movement.projectId),
      movementType: movement.movementType,
      challanNumber: movement.challanNumber || '',
      itemCount: Array.isArray(movement.items) ? movement.items.length : 0,
      damageReason: movement.damageReason || '',
      performedAt: movement.performedAt,
    }));
  }

  async getCollectionReport() {
    const plans = await db.epcPaymentMilestonePlan.findMany({ orderBy: { dueAt: 'asc' }, take: 500 });
    const projectMap = await this.projectContext(plans.map((plan: any) => plan.projectId));
    return plans.map((plan: any) => ({
      ...projectMap.get(plan.projectId),
      milestone: plan.milestone,
      expectedAmount: plan.expectedAmount,
      receivedAmount: plan.receivedAmount,
      pendingAmount: Math.max(money(plan.expectedAmount) - money(plan.receivedAmount), 0),
      dueAt: plan.dueAt,
      isFinal: plan.isFinal ? 'Yes' : 'No',
      status: plan.status,
      reminderSentAt: plan.reminderSentAt,
      lockedAt: plan.lockedAt,
    }));
  }

  async getSalespersonPaymentPendingReport() {
    const rows = await this.getCollectionReport();
    return rows
      .filter((row: any) => money(row.pendingAmount) > 0)
      .map((row: any) => ({
        salesperson: row.ownerName,
        projectCode: row.projectCode,
        customerName: row.customerName,
        customerPhone: row.customerPhone,
        milestone: row.milestone,
        pendingAmount: row.pendingAmount,
        dueAt: row.dueAt,
        daysOverdue: row.dueAt ? this.daysBetween(row.dueAt) : 0,
      }));
  }

  async getProjectDeadlineReport() {
    const projects = await db.epcProject.findMany({
      where: { projectDeadlineAt: { not: null }, stage: { notIn: ['COMPLETED', 'CANCELLED'] } },
      orderBy: { projectDeadlineAt: 'asc' },
      take: 200,
    });
    const projectMap = await this.projectContext(projects.map((project: any) => project.id));
    return projects.map((project: any) => ({
      ...projectMap.get(project.id),
      projectDeadlineAt: project.projectDeadlineAt,
      daysToDeadline: project.projectDeadlineAt ? Math.ceil((project.projectDeadlineAt.getTime() - Date.now()) / 86400000) : null,
      breached: project.projectDeadlineAt && project.projectDeadlineAt < new Date() ? 'Yes' : 'No',
      deadlineBreachedAt: project.deadlineBreachedAt,
    }));
  }

  async getInstallationDelayReport() {
    const controls = await db.epcInstallationControl.findMany({
      where: {
        OR: [
          { delayReason: { not: null } },
          { qcStatus: { not: 'DONE' } },
          { actualInstallationAt: null },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
    const projectMap = await this.projectContext(controls.map((control: any) => control.projectId));
    return controls.map((control: any) => ({
      ...projectMap.get(control.projectId),
      plannedInstallationAt: control.plannedInstallationAt,
      actualInstallationAt: control.actualInstallationAt,
      delayDays:
        control.plannedInstallationAt && (control.actualInstallationAt || new Date()) > control.plannedInstallationAt
          ? this.daysBetween(control.plannedInstallationAt, control.actualInstallationAt || new Date())
          : 0,
      delayReason: control.delayReason || '',
      delayOwnerDepartment: control.delayOwnerDepartment || '',
      qcStatus: control.qcStatus,
      testingStatus: control.testingStatus,
      handoverStatus: control.handoverStatus,
    }));
  }

  async getNetMeteringDelayReport() {
    const trackers = await db.epcSubsidyTracker.findMany({
      where: { subsidyReceivedStatus: { not: 'DONE' } },
      orderBy: { updatedAt: 'asc' },
      take: 200,
    });
    const projectMap = await this.projectContext(trackers.map((tracker: any) => tracker.projectId));
    return trackers.map((tracker: any) => ({
      ...projectMap.get(tracker.projectId),
      caNumber: tracker.caNumber || '',
      currentStage: tracker.currentStage,
      discomApprovalStatus: tracker.discomApprovalStatus,
      inspectionStatus: tracker.inspectionStatus,
      netMeterInstalledStatus: tracker.netMeterInstalledStatus,
      subsidyClaimSubmittedStatus: tracker.subsidyClaimSubmittedStatus,
      subsidyReceivedStatus: tracker.subsidyReceivedStatus,
      delayReason: tracker.delayReason || '',
      delayOwnerDepartment: tracker.delayOwnerDepartment || '',
      daysInCurrentStage: this.daysBetween(tracker.updatedAt),
    }));
  }

  async getSalesPerformanceReport() {
    const users = await db.user.findMany({ where: { role: 'SALESPERSON' }, select: { id: true, name: true, email: true } });
    const leads = await db.lead.findMany({ where: { assignedSalesperson: { in: users.map((user: any) => user.id) } } });
    const projects = await db.epcProject.findMany({ where: { salesOwnerId: { in: users.map((user: any) => user.id) } } });
    const payments = await db.epcPaymentMilestonePlan.findMany({ where: { projectId: { in: projects.map((project: any) => project.id) } } });

    return users.map((user: any) => {
      const userLeads = leads.filter((lead: any) => lead.assignedSalesperson === user.id);
      const userProjects = projects.filter((project: any) => project.salesOwnerId === user.id);
      const userPayments = payments.filter((plan: any) => userProjects.some((project: any) => project.id === plan.projectId));
      const received = userPayments.reduce((sum: number, plan: any) => sum + money(plan.receivedAmount), 0);
      const pending = userPayments.reduce((sum: number, plan: any) => sum + Math.max(money(plan.expectedAmount) - money(plan.receivedAmount), 0), 0);
      return {
        salesperson: user.name,
        email: user.email,
        leadsAssigned: userLeads.length,
        wonLeads: userLeads.filter((lead: any) => lead.status === 'WON').length,
        lostLeads: userLeads.filter((lead: any) => lead.status === 'LOST').length,
        projectsOwned: userProjects.length,
        collectionReceived: received,
        paymentPending: pending,
        conversionPercent: userLeads.length ? Number(((userProjects.length / userLeads.length) * 100).toFixed(2)) : 0,
      };
    });
  }

  async getCustomerFullProjectReport(customerId?: string) {
    const customers = await db.customer.findMany({
      where: customerId ? { id: customerId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: customerId ? 1 : 100,
    });
    const projects = await db.epcProject.findMany({ where: { customerId: { in: customers.map((customer: any) => customer.id) } } });
    const projectIds = projects.map((project: any) => project.id);
    const [payments, installations, trackers, movements, punchPoints] = await Promise.all([
      db.epcPaymentMilestonePlan.findMany({ where: { projectId: { in: projectIds } } }),
      db.epcInstallationControl.findMany({ where: { projectId: { in: projectIds } } }),
      db.epcSubsidyTracker.findMany({ where: { projectId: { in: projectIds } } }),
      db.epcMaterialMovement.findMany({ where: { projectId: { in: projectIds } } }),
      db.epcPunchPoint.findMany({ where: { projectId: { in: projectIds } } }),
    ]);

    return customers.map((customer: any) => {
      const customerProjects = projects.filter((project: any) => project.customerId === customer.id);
      return {
        customerCode: customer.customerCode,
        customerName: customer.name,
        phone: customer.phone,
        city: customer.city,
        caNumber: customer.electricityConsumerNo || '',
        projectCount: customerProjects.length,
        projects: customerProjects.map((project: any) => ({
          projectCode: project.projectCode,
          stage: project.stage,
          projectValue: project.projectValue,
          payments: payments.filter((payment: any) => payment.projectId === project.id),
          installation: installations.find((installation: any) => installation.projectId === project.id) || null,
          documentation: trackers.find((tracker: any) => tracker.projectId === project.id) || null,
          movements: movements.filter((movement: any) => movement.projectId === project.id),
          punchPoints: punchPoints.filter((point: any) => point.projectId === project.id),
        })),
      };
    });
  }
}

export const epcV2Service = new EpcV2Service();
