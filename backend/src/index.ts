import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth';
import taskRoutes from './routes/tasks';
import commentRoutes from './routes/comments';
import commentsAllRoutes from './routes/commentsAll';
import userRoutes from './routes/users';
import settingsRoutes from './routes/settings';
import timeEntryRoutes from './routes/timeEntries';
import templateRoutes from './routes/templates';
import savedReportRoutes from './routes/savedReports';
import notificationRoutes from './routes/notifications';
import eventsRoutes from './routes/events';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*' }));
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/tasks/:taskId/comments', commentRoutes);
app.use('/api/comments', commentsAllRoutes);
app.use('/api/users', userRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/time-entries', timeEntryRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/saved-reports', savedReportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/events', eventsRoutes);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', version: '1.0.0' }));

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 To-DoX API démarrée sur le port ${PORT}`);
});

export default app;
