import express, { type Request, type Response } from 'express';
import dotenv from 'dotenv';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket, WebSocketServer } from 'ws';
import { WorkspaceStore } from './server/store.ts';
import type { AppNotification } from './src/types/index.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const store = new WorkspaceStore();
const wss = new WebSocketServer({ noServer: true });

app.use(express.json({ limit: '10mb' }));

function broadcast(payload: { type: string; data?: unknown; notification?: AppNotification }) {
  const message = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function broadcastFullSync(notifications: AppNotification[] = []) {
  broadcast({ type: 'workspace:sync', data: store.getState() });
  for (const notification of notifications) {
    broadcast({ type: 'notification:push', notification });
  }
}

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'ServoMedia API', time: new Date().toISOString() });
});

// Full workspace state
app.get('/api/workspace', (_req: Request, res: Response) => {
  const autoNotifications = store.enforceAutoStopTimers();
  if (autoNotifications.length > 0) {
    broadcastFullSync(autoNotifications);
  }
  res.json(store.getState());
});

// Create work item (Project by Ketua Project, Routine/Flexible by Crew)
app.post('/api/work-items', (req: Request, res: Response) => {
  const { item, triggeredNotifications, error } = store.createWorkItem(req.body);
  if (error || !item) {
    res.status(403).json({ error: error || 'Tidak memiliki izin untuk membuat pekerjaan ini.' });
    return;
  }
  broadcastFullSync(triggeredNotifications);
  res.status(201).json({ item, triggeredNotifications, state: store.getState() });
});

// Update work item (Kanban move, Gantt reschedule, reassign, checklist, status)
app.patch('/api/work-items/:id', (req: Request, res: Response) => {
  const { item, triggeredNotifications } = store.updateWorkItem(req.params.id, req.body);
  if (!item) {
    res.status(404).json({ error: 'Item pekerjaan tidak ditemukan' });
    return;
  }
  broadcastFullSync(triggeredNotifications);
  res.json({ item, triggeredNotifications, state: store.getState() });
});

// Transition project workflow (Intake -> Review Manager -> Approve/Assign -> Crew -> Handover Client)
app.post('/api/work-items/:id/workflow', (req: Request, res: Response) => {
  const { item, triggeredNotifications, error } = store.transitionProjectWorkflow(
    req.params.id,
    req.body
  );
  if (error || !item) {
    res.status(400).json({ error: error || 'Gagal memproses alur project.' });
    return;
  }
  broadcastFullSync(triggeredNotifications);
  res.json({ item, triggeredNotifications, state: store.getState() });
});

// Delete work item
app.delete('/api/work-items/:id', (req: Request, res: Response) => {
  const ok = store.deleteWorkItem(req.params.id);
  if (!ok) {
    res.status(404).json({ error: 'Item pekerjaan tidak ditemukan' });
    return;
  }
  broadcastFullSync();
  res.json({ ok: true, state: store.getState() });
});

// Start real-time timer
app.post('/api/timers/start', (req: Request, res: Response) => {
  const autoNotifications = store.enforceAutoStopTimers();
  const { workItemId, crewId, note, autoStopAt, timezoneOffsetMinutes } = req.body as {
    workItemId: string;
    crewId: string;
    note?: string;
    autoStopAt?: string;
    timezoneOffsetMinutes?: number;
  };
  const timer = store.startTimer(workItemId, crewId, note, {
    autoStopAt,
    timezoneOffsetMinutes,
  });
  if (!timer) {
    res.status(404).json({ error: 'Pekerjaan tidak ditemukan' });
    return;
  }
  broadcastFullSync(autoNotifications);
  res.status(201).json({ timer, state: store.getState() });
});

// Stop real-time timer
app.post('/api/timers/:id/stop', (req: Request, res: Response) => {
  const { endedAt, autoStopped } = (req.body || {}) as {
    endedAt?: string;
    autoStopped?: boolean;
  };
  const result = store.stopTimer(req.params.id, { endedAt, autoStopped });
  if (!result) {
    res.status(404).json({ error: 'Timer aktif tidak ditemukan' });
    return;
  }
  broadcastFullSync(result.notification ? [result.notification] : []);
  res.json({ ...result, state: store.getState() });
});

// Add manual crew work log hours
app.post('/api/time-logs/manual', (req: Request, res: Response) => {
  const { log, error } = store.addManualTimeLog(req.body);
  if (error || !log) {
    res.status(400).json({ error: error || 'Gagal mencatat log manual.' });
    return;
  }
  broadcastFullSync();
  res.status(201).json({ log, state: store.getState() });
});

// Update crew member capacity limit
app.patch('/api/crew/:id/capacity', (req: Request, res: Response) => {
  const { maxWeeklyHours } = req.body as { maxWeeklyHours: number };
  const { crew, overloadNotif } = store.updateCrewCapacity(req.params.id, Number(maxWeeklyHours));
  if (!crew) {
    res.status(404).json({ error: 'Anggota kru tidak ditemukan' });
    return;
  }
  broadcastFullSync(overloadNotif ? [overloadNotif] : []);
  res.json({ crew, overloadNotif, state: store.getState() });
});

// Customizable per-user dashboard layout
app.patch('/api/dashboard-config/:crewId', (req: Request, res: Response) => {
  const config = store.updateDashboardConfig(req.params.crewId, req.body);
  broadcastFullSync();
  res.json({ config, state: store.getState() });
});

// Mark single notification read
app.patch('/api/notifications/:id/read', (req: Request, res: Response) => {
  store.markNotificationRead(req.params.id);
  broadcastFullSync();
  res.json({ ok: true, state: store.getState() });
});

// Mark all notifications read
app.post('/api/notifications/read-all', (_req: Request, res: Response) => {
  store.markAllNotificationsRead();
  broadcastFullSync();
  res.json({ ok: true, state: store.getState() });
});

// Trigger urgent push notification broadcast manually or from workflow
app.post('/api/notifications/push', (req: Request, res: Response) => {
  const notif = store.pushNotification(req.body);
  broadcastFullSync([notif]);
  res.status(201).json({ notification: notif, state: store.getState() });
});

// Auto monthly report settings
app.patch('/api/reports/settings', (req: Request, res: Response) => {
  const settings = store.updateAutoReportSettings(req.body);
  broadcastFullSync();
  res.json({ settings, state: store.getState() });
});

// Generate monthly report now
app.post('/api/reports/generate', (req: Request, res: Response) => {
  const { monthKey, autoGenerated } = (req.body || {}) as {
    monthKey?: string;
    autoGenerated?: boolean;
  };
  const { report, notification } = store.generateMonthlyReport(
    monthKey || '2026-11',
    Boolean(autoGenerated)
  );
  broadcastFullSync([notification]);
  res.status(201).json({ report, notification, state: store.getState() });
});

async function startServer() {
  const server = http.createServer(app);

  // WebSocket upgrade on /ws
  server.on('upgrade', (request, socket, head) => {
    const reqUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    if (reqUrl.pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'workspace:sync', data: store.getState() }));
  });

  // Mount Vite middleware in dev, or serve dist in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Background enforcement: auto-stop Editing project timers at 16:30
  setInterval(() => {
    const autoNotifications = store.enforceAutoStopTimers();
    if (autoNotifications.length > 0) {
      broadcastFullSync(autoNotifications);
    }
  }, 15_000);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`ServoMedia server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
