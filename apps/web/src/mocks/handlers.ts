import { http, HttpResponse } from 'msw';
import { AuthUser } from '@/store/authStore';
import { DashboardData } from '@/types/api';

const mockUser: AuthUser = {
  id: 'user-1',
  email: 'anna@foto.de',
  fullName: 'Anna Köhler',
  role: 'owner',
  tenant: {
    subdomain: 'anna-foto',
    plan: 'Pro plan',
  },
};

const mockDashboardData: DashboardData = {
  overview: {
    revenueApr: 2840,
    revenueMarChange: 18,
    activeBookingsCount: 12,
    newLeadsCount: 5,
    leadsNeedingReply: 2,
    openGalleriesCount: 3,
    expiredGalleriesCount: 1,
  },
  leads: [
    {
      id: '1',
      name: 'Maria & Klaus',
      email: 'maria@example.com',
      eventDate: '2026-06-14',
      eventType: 'WEDDING',
      budgetRange: '500_1000',
      score: 'HIGH',
      status: 'NEW',
      createdAt: '2026-04-15',
    },
    {
      id: '2',
      name: 'Sophie Richter',
      email: 'sophie@example.com',
      eventDate: '2026-05-02',
      eventType: 'PORTRAIT',
      budgetRange: '200_500',
      score: 'MED',
      status: 'NEW',
      createdAt: '2026-04-10',
    },
    {
      id: '3',
      name: 'Laura & Ben',
      email: 'laura@example.com',
      eventDate: '2026-07-20',
      eventType: 'ENGAGEMENT',
      budgetRange: '500_1000',
      score: 'HIGH',
      status: 'NEW',
      createdAt: '2026-04-09',
    },
  ],
  bookings: [
    {
      id: 'b1',
      clientName: 'Yilmaz & Chen',
      clientEmail: 'yilmaz@example.com',
      eventDate: '2026-04-22',
      packageId: 'pkg-wedding',
      depositAmount: 300,
      totalAmount: 1200,
      depositPercent: 25,
      status: 'DEPOSIT',
      createdAt: '2026-04-01',
    },
    {
      id: 'b2',
      clientName: 'Braun family',
      clientEmail: 'braun@example.com',
      eventDate: '2026-04-26',
      packageId: 'pkg-family',
      depositAmount: 150,
      totalAmount: 450,
      depositPercent: 33,
      status: 'CONFIRMED',
      createdAt: '2026-03-15',
    },
    {
      id: 'b3',
      clientName: 'Stefan & Eva',
      clientEmail: 'stefan@example.com',
      eventDate: '2026-05-03',
      packageId: 'pkg-wedding',
      depositAmount: 450,
      totalAmount: 1800,
      depositPercent: 25,
      status: 'DEPOSIT',
      createdAt: '2026-02-20',
    },
  ],
  galleries: [
    { id: 'g1', clientName: 'Müller', eventType: 'WEDDING', photoCount: 250, isPublished: true, expiresAt: '2026-05-15', createdAt: '2026-04-15' },
    { id: 'g2', clientName: 'Schmidt', eventType: 'PORTRAIT', photoCount: 45, isPublished: true, expiresAt: '2026-04-25', createdAt: '2026-04-15' },
    { id: 'g3', clientName: 'Weber', eventType: 'FAMILY', photoCount: 120, isPublished: false, expiresAt: '2026-06-01', createdAt: '2026-04-01' },
  ],
  revenueHistory: [
    { month: 'Nov', amount: 980 },
    { month: 'Dec', amount: 640 },
    { month: 'Jan', amount: 1100 },
    { month: 'Feb', amount: 1450 },
    { month: 'Mar', amount: 2410 },
    { month: 'Apr', amount: 2840 },
  ],
};

const registeredUsers = new Map<string, AuthUser>();

export const handlers = [
  http.post('/api/auth/register', async ({ request }) => {
    const body = (await request.json()) as {
      fullName: string;
      email: string;
      password: string;
      subdomain: string;
    };

    if (!body.email || !body.password || !body.fullName || !body.subdomain) {
      return HttpResponse.json({ error: 'All fields required' }, { status: 400 });
    }

    if (body.password.length < 8) {
      return HttpResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const subdomainPattern = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
    if (!subdomainPattern.test(body.subdomain)) {
      return HttpResponse.json({ error: 'Invalid subdomain format' }, { status: 400 });
    }

    const user: AuthUser = {
      id: `user-${Date.now()}`,
      email: body.email,
      fullName: body.fullName,
      role: 'owner',
      tenant: {
        subdomain: body.subdomain,
        plan: 'Pro plan',
      },
    };

    registeredUsers.set(body.email, user);
    return new HttpResponse(JSON.stringify({ success: true }), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `access_token=mock-token; Path=/`,
      },
    });
  }),

  http.post('/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    if (
      (body.email === 'anna@foto.de' && body.password === 'password') ||
      registeredUsers.has(body.email)
    ) {
      return new HttpResponse(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': `access_token=mock-token; Path=/`,
        },
      });
    }
    return HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }),

  http.get('/api/auth/me', ({ request }) => {
    const url = new URL(request.url);
    const email = url.searchParams.get('email') || 'anna@foto.de';
    const user = registeredUsers.get(email) || mockUser;
    return HttpResponse.json(user);
  }),

  http.post('/api/auth/logout', () => {
    return new HttpResponse(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `access_token=; Path=/; Max-Age=0`,
      },
    });
  }),

  http.post('/api/auth/refresh', () => {
    return HttpResponse.json({ success: true });
  }),

  http.get('/api/dashboard', () => {
    return HttpResponse.json(mockDashboardData);
  }),
];
