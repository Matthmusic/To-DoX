import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../db/prisma';

export interface AuthRequest extends Request {
  userId?: string;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token manquant' });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.userId) { res.status(401).json({ error: 'Non authentifié' }); return; }
  // isAdmin sera disponible après prisma generate sur le serveur
  const user = await (prisma.user as any).findUnique({ where: { id: req.userId }, select: { isAdmin: true } });
  if (!user?.isAdmin) { res.status(403).json({ error: 'Droits administrateur requis' }); return; }
  next();
}
