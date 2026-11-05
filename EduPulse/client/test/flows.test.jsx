import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import App from '../src/App.jsx';
import { AuthProvider } from '../src/lib/auth.jsx';
import { ToastProvider } from '../src/lib/toast.jsx';

const realFetch = globalThis.fetch; let cookie = '';
globalThis.fetch = async (url, opts = {}) => { const r = await realFetch('http://localhost:4000' + url, { ...opts, headers: { ...(opts.headers || {}), cookie } }); const sc = r.headers.getSetCookie?.() || []; if (sc.length) { const c = sc[0].split(';')[0]; cookie = c.endsWith('=') ? '' : c; } return r; };
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
const mount = (p) => render(<MemoryRouter initialEntries={[p]}><ToastProvider><AuthProvider><App /></AuthProvider></ToastProvider></MemoryRouter>);
const idle = () => waitFor(() => expect(screen.queryByText('Loading…')).toBeNull(), { timeout: 15000 });

describe('UI flows', () => {
  it('logs in through the form, sees dashboard, logs out', async () => {
    cookie = ''; mount('/login');
    await screen.findByText('Welcome back');
    fireEvent.click(screen.getByText('Student'));
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByText(/Class rank/, {}, { timeout: 15000 });
    fireEvent.click(screen.getAllByLabelText('Log out')[0]);
    await screen.findByText('Welcome back', {}, { timeout: 10000 });
  }, 40000);
  it('rejects a wrong password with an error message', async () => {
    cookie = ''; cleanup(); mount('/login');
    await screen.findByText('Welcome back');
    fireEvent.change(screen.getByLabelText('Email or username'), { target: { value: 'student1' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrongpass1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByText('Invalid credentials');
  }, 20000);
  it('teacher opens Add marks modal and Mark attendance tab', async () => {
    cookie = ''; cleanup();
    await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'edupulse' }, body: JSON.stringify({ identifier: 'teacher1', password: 'Teacher@123' }) });
    mount('/marks'); await screen.findByText('Add marks', {}, { timeout: 15000 });
    fireEvent.click(screen.getAllByText('Add marks')[0]);
    await screen.findByText('Select student…'); fireEvent.click(screen.getByText('Cancel'));
    cleanup(); mount('/attendance'); await screen.findByText('Mark attendance', {}, { timeout: 15000 });
    fireEvent.click(screen.getAllByText('Mark attendance')[0]);
    await screen.findByText('All present', {}, { timeout: 10000 });
    await screen.findAllByText('absent', {}, { timeout: 10000 });
  }, 60000);
  it('student opens the Pay fee modal', async () => {
    cookie = ''; cleanup();
    await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'edupulse' }, body: JSON.stringify({ identifier: 'student1', password: 'Student@123' }) });
    mount('/fees'); await idle(); const pay = await screen.findAllByText('Pay', {}, { timeout: 15000 }); fireEvent.click(pay[0]);
    await screen.findByText('Pay fee'); expect(screen.getByText(/Demo payment/)).toBeTruthy();
  }, 40000);
  it('teacher edits a mark in the live gradebook and it saves', async () => {
    cookie = ''; cleanup();
    await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'edupulse' }, body: JSON.stringify({ identifier: 'teacher1', password: 'Teacher@123' }) });
    mount('/reports');
    const inputs = await screen.findAllByLabelText(/Model Exam/, {}, { timeout: 20000 });
    const input = inputs[0]; const orig = Number(input.value); const next = orig >= 50 ? orig - 1 : orig + 1;
    fireEvent.change(input, { target: { value: String(next) } }); expect(input.className).toContain('bg-amber-50');
    fireEvent.blur(input);
    await waitFor(() => { expect(input.className).not.toContain('bg-amber-50'); expect(Number(input.value)).toBe(next); }, { timeout: 15000 });
    fireEvent.change(input, { target: { value: String(orig) } }); fireEvent.blur(input);
    await waitFor(() => { expect(input.className).not.toContain('bg-amber-50'); expect(Number(input.value)).toBe(orig); }, { timeout: 15000 });
  }, 90000);
  it('student sees own report card with print button', async () => {
    cookie = ''; cleanup();
    await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'edupulse' }, body: JSON.stringify({ identifier: 'student1', password: 'Student@123' }) });
    mount('/reports'); await screen.findByText(/Academic report card/, {}, { timeout: 15000 }); expect(screen.getByText(/Print \/ Save as PDF/)).toBeTruthy(); expect(screen.getByText('Subject-wise performance')).toBeTruthy();
  }, 40000);
  it('landing page, forgot-password and reset-password flow work end to end', async () => {
    cookie = ''; cleanup();
    mount('/'); await screen.findByText(/before it becomes a problem/, {}, { timeout: 10000 }); expect(screen.getAllByText('Get started').length).toBeGreaterThan(0); cleanup();
    const ts = Date.now().toString(36); const email = `ui${ts}@x.edu`;
    const su = await fetch('/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'edupulse' }, body: JSON.stringify({ name: 'Ui Tester', email, username: `ui${ts}`, password: 'Password1', role: 'student', rollNo: `UI${ts}`, department: 'AI & Data Science' }) });
    expect(su.status).toBe(201); cookie = '';
    mount('/forgot-password'); await screen.findByText('Forgot your password?');
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: email } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    fireEvent.click(await screen.findByText('Open reset link', {}, { timeout: 10000 }));
    await screen.findByText('Choose a new password', {}, { timeout: 10000 });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Brand-new-9' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'Brand-new-9' } });
    await screen.findByText('Passwords match');
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }));
    await screen.findByText('Password updated', {}, { timeout: 10000 }); cleanup();
    const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'edupulse' }, body: JSON.stringify({ identifier: email, password: 'Brand-new-9' }) });
    expect(r.status).toBe(200);
  }, 60000);
  it('expired reset link shows a helpful message', async () => {
    cookie = ''; cleanup(); mount('/reset-password?token=' + '0'.repeat(64)); await screen.findByText('Link expired', {}, { timeout: 10000 }); expect(screen.getByText('Request a new link')).toBeTruthy();
  }, 20000);
  it('signup shows live password strength and match feedback', async () => {
    cookie = ''; cleanup(); mount('/signup'); await screen.findByText('Create your account');
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'abc' } }); expect(screen.getByText('Weak')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Str0ng-Password!' } }); expect(screen.getByText('Strong')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'nope' } }); expect(screen.getByText('Passwords do not match')).toBeTruthy();
  }, 20000);
});
