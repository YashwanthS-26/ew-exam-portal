import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_exam_key';

export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized: No token provided' });
        return;
    }

    const parts = authHeader.split(' ');
    const token = parts[1];

    if (!token) {
        res.status(401).json({ error: 'Unauthorized: Malformed token' });
        return;
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as unknown as { id: string; email: string; role: string };
        (req as any).user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
};
