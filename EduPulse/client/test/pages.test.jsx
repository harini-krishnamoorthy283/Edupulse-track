import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import App from '../src/App.jsx';
import { AuthProvider } from '../src/lib/auth.jsx';
import { ToastProvider } from '../src/lib/toast.jsx';

const realFetch = globalThis.fetch;
let cookie = '';
globalThis.fetch = async (url, opts = {}) => {
  const r = await realFetch('http://localhost:4000' + url, { ...opts, headers: { ...(opts.headers || {}), cookie } });
  const sc = r.headers.getSetCookie?.() || [];
  if (sc.length) { const c = sc[0].split(';')[0]; cookie = c.endsWith('=') ? '' : c; }
  return r;
};
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));

const loginAs = async (u, p) => { cookie = ''; const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'edupulse' }, body: JSON.stringify({ identifier: u, password: p }) }); if (!r.ok) throw new Error('login failed'); };
const PATHS = ['/reports', '/dashboard', '/early-warning', '/notifications', '/attendance', '/marks', '/performance', '/results', '/missed-courses', '/fees', '/extracurricular', '/feedback', '/profile'];
const EXTRA = { admin: ['/students', '/students/1', '/admin'], teacher: ['/students', '/students/1'], student: [] };
const ACCOUNTS = { admin: ['admin', 'Admin@123'], teacher: ['teacher1', 'Teacher@123'], student: ['student1', 'Student@123'] };

for (const [role, [u, p]] of Object.entries(ACCOUNTS)) {
  describe(`${role} pages`, () => {
    beforeAll(async () => { await loginAs(u, p); });
    for (const path of [...PATHS, ...EXTRA[role]]) {
      it(`renders ${path}`, async () => {
        const errors = [];
        const spy = vi.spyOn(console, 'error').mockImplementation((...a) => errors.push(a.map(String).join(' ')));
        const { container } = render(<MemoryRouter initialEntries={[path]}><ToastProvider><AuthProvider><App /></AuthProvider></ToastProvider></MemoryRouter>);
        await waitFor(() => { expect(screen.queryByText(/Starting EduPulse/)).toBeNull(); expect(screen.queryByText('Loading…')).toBeNull(); }, { timeout: 15000 });
        await new Promise((r) => setTimeout(r, 400));
        await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull(), { timeout: 15000 });
        expect(screen.queryByText(/Something went wrong|Request failed|Internal server error|Authentication required/)).toBeNull();
        expect(container.querySelector('main')?.textContent.length).toBeGreaterThan(40);
        const bad = errors.filter((e) => !/width\(0\) and height\(0\)|not wrapped in act|ResponsiveContainer/.test(e));
        spy.mockRestore(); cleanup();
        expect(bad, bad.join('\n')).toEqual([]);
      }, 40000);
    }
  });
}
describe('auth screens', () => {
  it('shows login when logged out and logs in', async () => {
    cookie = '';
    render(<MemoryRouter initialEntries={['/dashboard']}><ToastProvider><AuthProvider><App /></AuthProvider></ToastProvider></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Welcome back')).toBeTruthy(), { timeout: 10000 });
    cleanup();
    render(<MemoryRouter initialEntries={['/signup']}><ToastProvider><AuthProvider><App /></AuthProvider></ToastProvider></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Create your account')).toBeTruthy(), { timeout: 10000 });
  });
});
