import { Router, type Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { incidentService } from '../services/incident.service';
import { autoFixEngine } from '../selfHealing/autoFix.engine';
import { aiBrainService } from '../selfHealing/aiBrain.service';

const router = Router();

/**
 * Admin-only APIs (mounted under /api/v1/admin/incidents).
 * Keep minimal and safe; approval actions only trigger SAFE operational actions.
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.isSystemAdmin) return res.status(403).json({ error: 'Forbidden' });
    const status = (req.query.status as string) || undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const offset = req.query.offset ? Number(req.query.offset) : undefined;
    const rows = await incidentService.list({
      status: status === 'open' || status === 'resolved' ? status : undefined,
      limit,
      offset,
    });
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/approve', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.isSystemAdmin) return res.status(403).json({ error: 'Forbidden' });
    const id = String(req.params.id || '').trim();
    const action = String(req.body?.action || 'noop').trim() as any;
    const out = await autoFixEngine.runApprovedAction(id, action);
    await incidentService.setStatus(id, 'resolved');
    res.json({ ok: true, action, result: out });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/reject', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.isSystemAdmin) return res.status(403).json({ error: 'Forbidden' });
    const id = String(req.params.id || '').trim();
    await incidentService.setStatus(id, 'resolved');
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Sentry webhook receiver (optional).
 * Mount this behind admin auth in production or restrict by secret header.
 */
router.post('/sentry/webhook', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.isSystemAdmin) return res.status(403).json({ error: 'Forbidden' });
    const out = await aiBrainService.ingestSentryEvent(req.body);
    res.json({ ok: true, incidentId: out.incident.id, analysis: out.analysis });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export const incidentsRoutes = router;

