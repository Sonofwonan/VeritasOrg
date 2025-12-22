import { z } from 'zod';
import { insertUserSchema, insertAccountSchema, insertTransactionSchema, insertInvestmentSchema, users, accounts, transactions, investments } from './schema';

export * from './schema';

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

export const api = {
  auth: {
    register: {
      method: 'POST' as const,
      path: '/api/register',
      input: insertUserSchema,
      responses: {
        201: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    login: {
      method: 'POST' as const,
      path: '/api/login',
      input: z.object({ username: z.string(), password: z.string() }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.validation,
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/logout',
      responses: {
        200: z.void(),
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/user',
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: z.void(),
      },
    },
  },
  accounts: {
    list: {
      method: 'GET' as const,
      path: '/api/accounts',
      responses: {
        200: z.array(z.custom<typeof accounts.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/accounts',
      input: insertAccountSchema,
      responses: {
        201: z.custom<typeof accounts.$inferSelect>(),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/accounts/:id',
      responses: {
        200: z.custom<typeof accounts.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },
  transactions: {
    transfer: {
      method: 'POST' as const,
      path: '/api/transactions/transfer',
      input: z.object({
        fromAccountId: z.number(),
        toAccountId: z.number(),
        amount: z.string(),
      }),
      responses: {
        201: z.custom<typeof transactions.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
  investments: {
    list: {
      method: 'GET' as const,
      path: '/api/investments',
      responses: {
        200: z.array(z.custom<typeof investments.$inferSelect>()),
      },
    },
    buy: {
      method: 'POST' as const,
      path: '/api/investments/buy',
      input: z.object({
        accountId: z.number(),
        symbol: z.string(),
        amount: z.string(),
      }),
      responses: {
        201: z.custom<typeof investments.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    sell: {
      method: 'POST' as const,
      path: '/api/investments/sell',
      input: z.object({
        accountId: z.number(),
        symbol: z.string(),
        shares: z.string(),
      }),
      responses: {
        201: z.custom<typeof investments.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
  market: {
    quote: {
      method: 'GET' as const,
      path: '/api/market/quote/:symbol',
      responses: {
        200: z.object({
          symbol: z.string(),
          price: z.number(),
          change: z.number(),
          changePercent: z.number(),
        }),
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
