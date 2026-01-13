import { z } from 'zod';
import { 
  insertUserSchema, users, 
  insertMemberSchema, members,
  insertServiceSchema, services,
  insertAttendanceSchema, attendanceRecords,
  groups, pcfs, cells, churches
} from './schema';

// ============================================
// SHARED ERROR SCHEMAS
// ============================================
export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

// ============================================
// API CONTRACT
// ============================================
export const api = {
  // === HIERARCHY ===
  hierarchy: {
    get: {
      method: 'GET' as const,
      path: '/api/hierarchy',
      responses: {
        200: z.object({
          church: z.custom<typeof churches.$inferSelect>(),
          groups: z.array(z.custom<typeof groups.$inferSelect>()),
          pcfs: z.array(z.custom<typeof pcfs.$inferSelect>()),
          cells: z.array(z.custom<typeof cells.$inferSelect>()),
        }),
      },
    },
  },

  // === MEMBERS ===
  members: {
    list: {
      method: 'GET' as const,
      path: '/api/members',
      input: z.object({
        search: z.string().optional(),
        cellId: z.coerce.number().optional(),
        status: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof members.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/members/:id',
      responses: {
        200: z.custom<typeof members.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/members',
      input: insertMemberSchema,
      responses: {
        201: z.custom<typeof members.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/members/:id',
      input: insertMemberSchema.partial(),
      responses: {
        200: z.custom<typeof members.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/members/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },

  // === SERVICES ===
  services: {
    list: {
      method: 'GET' as const,
      path: '/api/services',
      responses: {
        200: z.array(z.custom<typeof services.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/services',
      input: insertServiceSchema,
      responses: {
        201: z.custom<typeof services.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/services/:id',
      input: insertServiceSchema.partial(),
      responses: {
        200: z.custom<typeof services.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },

  // === ATTENDANCE ===
  attendance: {
    mark: {
      method: 'POST' as const,
      path: '/api/attendance',
      input: insertAttendanceSchema,
      responses: {
        201: z.custom<typeof attendanceRecords.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    list: {
      method: 'GET' as const,
      path: '/api/attendance',
      input: z.object({
        serviceId: z.coerce.number(),
      }),
      responses: {
        200: z.array(z.custom<typeof attendanceRecords.$inferSelect & { member: typeof members.$inferSelect }>()),
      },
    },
    stats: {
      method: 'GET' as const,
      path: '/api/attendance/stats',
      input: z.object({
        serviceId: z.coerce.number().optional(),
      }).optional(),
      responses: {
        200: z.array(z.object({
          serviceId: z.number(),
          serviceName: z.string(),
          totalPresent: z.number(),
          byMethod: z.record(z.number()),
          byCell: z.record(z.number()),
        })),
      },
    },
  },

  // === ADMIN / STRUCTURE ===
  admin: {
    groups: {
      create: {
        method: 'POST' as const,
        path: '/api/admin/groups',
        input: z.object({ name: z.string(), churchId: z.number() }),
        responses: { 201: z.any() },
      },
    },
    pcfs: {
      create: {
        method: 'POST' as const,
        path: '/api/admin/pcfs',
        input: z.object({ name: z.string(), groupId: z.number() }),
        responses: { 201: z.any() },
      },
    },
    cells: {
      create: {
        method: 'POST' as const,
        path: '/api/admin/cells',
        input: z.object({ name: z.string(), pcfId: z.number() }),
        responses: { 201: z.any() },
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
