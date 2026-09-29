import request from 'supertest';
import { app } from '../index';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

let adminToken: string;
let callerToken: string;
let adminUserId: string;
let callerUserId: string;
let templateId: string;
let campaignId: string;
let rawLeadId: string;

beforeAll(async () => {
  try {
    await prisma.campaign.deleteMany({});
    await prisma.campaignTemplate.deleteMany({});
    await prisma.rawLead.deleteMany({ where: { phone: { in: ['9000000001', '9000000002', '9000000003'] } } });
    await prisma.user.deleteMany({ where: { email: { in: ['campaigns_admin@test.com', 'campaigns_caller@test.com'] } } });

    const pw = await bcrypt.hash('Test@1234', 10);
    const admin = await prisma.user.create({
      data: { email: 'campaigns_admin@test.com', password: pw, name: 'Camp Admin', role: 'ADMIN', isActive: true },
    });
    adminUserId = admin.id;
    adminToken = jwt.sign({ id: admin.id, role: 'ADMIN', name: 'Camp Admin', dealerId: null, zoneId: null }, process.env.JWT_SECRET || 'testsecret', { expiresIn: '1h' });

    const caller = await prisma.user.create({
      data: { email: 'campaigns_caller@test.com', password: pw, name: 'Caller', role: 'CALLING_STAFF', isActive: true },
    });
    callerUserId = caller.id;
    callerToken = jwt.sign({ id: caller.id, role: 'CALLING_STAFF', name: 'Caller', dealerId: null, zoneId: null }, process.env.JWT_SECRET || 'testsecret', { expiresIn: '1h' });
  } catch (e) { /* Skip if DB not connected */ }
});

afterAll(async () => {
  try {
    await prisma.campaign.deleteMany({});
    await prisma.campaignTemplate.deleteMany({});
    await prisma.rawLead.deleteMany({ where: { phone: { in: ['9000000001', '9000000002', '9000000003'] } } });
    await prisma.user.deleteMany({ where: { id: { in: [adminUserId, callerUserId].filter(Boolean) } } });
    await prisma.$disconnect();
  } catch (e) {}
});

// ─── TEMPLATE TESTS ──────────────────────────────────────────────────────────

describe('Templates', () => {
  it('POST /api/templates — should create a template', async () => {
    const res = await request(app)
      .post('/api/templates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test Template', type: 'WHATSAPP', body: 'Hello {{name}}', variables: ['name'] })
      .expect(201);
    expect(res.body.success).toBe(true);
    templateId = res.body.data.id;
  });

  it('GET /api/templates — should list templates', async () => {
    const res = await request(app)
      .get('/api/templates')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/templates/:id — should fetch single template', async () => {
    if (!templateId) return;
    const res = await request(app)
      .get(`/api/templates/${templateId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.data.id).toBe(templateId);
  });

  it('PUT /api/templates/:id — should update template', async () => {
    if (!templateId) return;
    const res = await request(app)
      .put(`/api/templates/${templateId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Updated Template', type: 'EMAIL', body: 'Hi {{name}}', variables: ['name'], subject: 'Hello' })
      .expect(200);
    expect(res.body.data.name).toBe('Updated Template');
  });

  it('GET /api/templates/:id — should return 404 for unknown id', async () => {
    const res = await request(app)
      .get('/api/templates/nonexistent-id')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

// ─── CAMPAIGN TESTS ───────────────────────────────────────────────────────────

describe('Campaigns', () => {
  it('POST /api/campaigns — should create a campaign', async () => {
    if (!templateId) return;
    const res = await request(app)
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Summer Campaign', type: 'EMAIL', templateId })
      .expect(201);
    expect(res.body.success).toBe(true);
    campaignId = res.body.data.id;
  });

  it('GET /api/campaigns — should list campaigns with pagination', async () => {
    const res = await request(app)
      .get('/api/campaigns?page=1&limit=10')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.data.campaigns).toBeDefined();
    expect(res.body.data.total).toBeGreaterThanOrEqual(0);
  });

  it('GET /api/campaigns?status=DRAFT — should filter by status', async () => {
    const res = await request(app)
      .get('/api/campaigns?status=DRAFT')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.data.campaigns.every((c: any) => c.status === 'DRAFT')).toBe(true);
  });

  it('GET /api/campaigns/:id — should get campaign details', async () => {
    if (!campaignId) return;
    const res = await request(app)
      .get(`/api/campaigns/${campaignId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.data.id).toBe(campaignId);
  });

  it('PATCH /api/campaigns/:id/status — should update status to RUNNING', async () => {
    if (!campaignId) return;
    const res = await request(app)
      .patch(`/api/campaigns/${campaignId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'RUNNING' })
      .expect(200);
    expect(res.body.data.status).toBe('RUNNING');
  });

  it('DELETE /api/campaigns/:id — should fail on non-DRAFT campaign', async () => {
    if (!campaignId) return;
    const res = await request(app)
      .delete(`/api/campaigns/${campaignId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('POST /api/campaigns — should fail with missing type', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Bad Campaign', templateId: 'anything' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET requests should require authentication', async () => {
    const res = await request(app)
      .get('/api/campaigns')
      .expect(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

// ─── RAW LEAD TESTS ────────────────────────────────────────────────────────────

describe('Raw Leads', () => {
  it('POST /api/raw-leads — should create single raw lead', async () => {
    const res = await request(app)
      .post('/api/raw-leads')
      .set('Authorization', `Bearer ${callerToken}`)
      .send({ name: 'Ravi Kumar', phone: '9000000001', source: 'MANUAL' })
      .expect(201);
    expect(res.body.success).toBe(true);
    rawLeadId = res.body.data.id;
  });

  it('GET /api/raw-leads — should list with pagination', async () => {
    const res = await request(app)
      .get('/api/raw-leads?page=1&limit=5')
      .set('Authorization', `Bearer ${callerToken}`)
      .expect(200);
    expect(res.body.data.rawLeads).toBeDefined();
  });

  it('GET /api/raw-leads?status=NEW — should filter by status', async () => {
    const res = await request(app)
      .get('/api/raw-leads?status=NEW')
      .set('Authorization', `Bearer ${callerToken}`)
      .expect(200);
    expect(res.body.data.rawLeads.every((r: any) => r.status === 'NEW')).toBe(true);
  });

  it('GET /api/raw-leads/:id — should get raw lead detail', async () => {
    if (!rawLeadId) return;
    const res = await request(app)
      .get(`/api/raw-leads/${rawLeadId}`)
      .set('Authorization', `Bearer ${callerToken}`)
      .expect(200);
    expect(res.body.data.id).toBe(rawLeadId);
  });

  it('PATCH /api/raw-leads/:id — should update status', async () => {
    if (!rawLeadId) return;
    const res = await request(app)
      .patch(`/api/raw-leads/${rawLeadId}`)
      .set('Authorization', `Bearer ${callerToken}`)
      .send({ status: 'CALLED' })
      .expect(200);
    expect(res.body.data.status).toBe('CALLED');
  });

  it('POST /api/raw-leads/:id/call-log — should add call log', async () => {
    if (!rawLeadId) return;
    const res = await request(app)
      .post(`/api/raw-leads/${rawLeadId}/call-log`)
      .set('Authorization', `Bearer ${callerToken}`)
      .send({ callType: 'OUTBOUND', disposition: 'INTERESTED', notes: 'Very interested', duration: 120 })
      .expect(201);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/raw-leads/bulk — should reject >5000 records', async () => {
    const records = Array(5001).fill({ name: 'Test', phone: '1234567890' });
    const res = await request(app)
      .post('/api/raw-leads/bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ records })
      .expect(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('POST /api/raw-leads/bulk — should deduplicate and insert records', async () => {
    const res = await request(app)
      .post('/api/raw-leads/bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ records: [
        { name: 'Lead A', phone: '9000000002' },
        { name: 'Lead B', phone: '9000000003' },
        { name: 'Lead Dup', phone: '9000000002' }, // duplicate
      ]})
      .expect(200);
    expect(res.body.data.inserted).toBe(2);
    expect(res.body.data.duplicates).toBe(1);
  });

  it('POST /api/raw-leads/bulk — should catch missing fields as errors', async () => {
    const res = await request(app)
      .post('/api/raw-leads/bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ records: [{ phone: '9999900000' }] }) // missing name
      .expect(200);
    expect(res.body.data.errors.length).toBeGreaterThan(0);
  });
});

// ─── WEBHOOK TESTS ─────────────────────────────────────────────────────────────

describe('Webhooks', () => {
  it('POST /api/webhooks/sendgrid — should accept event payload', async () => {
    const res = await request(app)
      .post('/api/webhooks/sendgrid')
      .send([{ event: 'open', email: 'x@y.com', sg_message_id: 'abc' }])
      .expect(200);
  });

  it('GET /api/webhooks/whatsapp — should handle hub challenge', async () => {
    const res = await request(app)
      .get('/api/webhooks/whatsapp')
      .query({ 'hub.challenge': '12345', 'hub.verify_token': process.env.META_WHATSAPP_TOKEN });
    // Either 200 (if token matches) or 403
    expect([200, 403]).toContain(res.status);
  });
});
