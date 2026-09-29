import { z } from 'zod';
import { UserRole, ProjectStatus } from '../types';

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(2),
  role: z.nativeEnum(UserRole),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(2),
  customerId: z.string().uuid(),
  status: z.nativeEnum(ProjectStatus),
  systemSize: z.number().positive().optional(),
  address: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date()
});
