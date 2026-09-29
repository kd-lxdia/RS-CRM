import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import { b2bPiService } from '../services/b2b-pi.service';

const actorFrom = (req: AuthenticatedRequest) => ({
  id: req.user!.id,
  role: req.user!.role,
});

const send = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({ success: true, data });

const handle = (fn: (req: AuthenticatedRequest, res: Response) => Promise<void>) =>
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await fn(req, res);
    } catch (error) {
      next(error);
    }
  };

export const listParties = handle(async (req, res) => {
  const data = await b2bPiService.listParties(req.query.search as string | undefined);
  send(res, data);
});

export const upsertParty = handle(async (req, res) => {
  const data = await b2bPiService.upsertParty({
    ...req.body,
    id: req.params.id || req.body.id,
    actor: actorFrom(req),
  });
  send(res, data, 201);
});

export const listPriceItems = handle(async (req, res) => {
  const data = await b2bPiService.listPriceItems(req.query.search as string | undefined);
  send(res, data);
});

export const createPriceItem = handle(async (req, res) => {
  const data = await b2bPiService.createPriceItem({ ...req.body, actor: actorFrom(req) });
  send(res, data, 201);
});

export const createPi = handle(async (req, res) => {
  const data = await b2bPiService.createPi({ ...req.body, actor: actorFrom(req) });
  send(res, data, 201);
});

export const listPis = handle(async (req, res) => {
  const data = await b2bPiService.listPis(req.query.status as string | undefined);
  send(res, data);
});

export const getPi = handle(async (req, res) => {
  const data = await b2bPiService.getPi(req.params.id);
  send(res, data);
});

export const approvePi = handle(async (req, res) => {
  const data = await b2bPiService.approvePi(req.params.id, actorFrom(req), req.body.remark);
  send(res, data);
});

export const rejectPi = handle(async (req, res) => {
  const data = await b2bPiService.rejectPi(req.params.id, actorFrom(req), req.body.remark);
  send(res, data);
});

export const markPiSent = handle(async (req, res) => {
  const data = await b2bPiService.markSent(req.params.id, actorFrom(req));
  send(res, data);
});
