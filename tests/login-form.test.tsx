// @vitest-environment jsdom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginForm from '@/features/auth/LoginForm';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/login'); });
async function fillForm() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Usuario'), 'operador-prueba');
  await user.type(screen.getByLabelText('Contraseña'), 'synthetic-password');
  return user;
}
describe('login form interactions', () => {
  it('announces an expired session while preserving safe form submission and removing legacy credentials from the URL', () => {
    window.history.replaceState(null, '', '/login?sesion=expirada&username=synthetic&password=synthetic&next=%2Fcliente%2Fmovimientos');
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const { container } = render(<LoginForm />);
    const notice = screen.getByRole('status');
    expect(notice.textContent).toContain('Tu sesión terminó. Ingresa de nuevo para continuar.');
    expect(container.querySelector('form')?.getAttribute('aria-describedby')).toBe(notice.id);
    expect(container.querySelector('form')?.method).toBe('post');
    expect(container.querySelector('form')?.getAttribute('action')).toBe('/bff/login');
    expect(screen.getByLabelText('Contraseña').getAttribute('type')).toBe('password');
    expect(window.location.search).toBe('?sesion=expirada&next=%2Fcliente%2Fmovimientos');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each(['/login', '/login?sesion=activa'])('does not show a session-expired notice on %s', (url) => {
    window.history.replaceState(null, '', url);
    const { container } = render(<LoginForm />);
    expect(screen.queryByText('Tu sesión terminó. Ingresa de nuevo para continuar.')).toBeNull();
    expect(container.querySelector('form')?.hasAttribute('aria-describedby')).toBe(false);
  });

  it('keeps the expiration notice when incomplete credentials prevent a request', () => {
    window.history.replaceState(null, '', '/login?sesion=expirada');
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const { container } = render(<LoginForm />);
    fireEvent.submit(container.querySelector('form')!);
    expect(screen.getByRole('status').textContent).toContain('Tu sesión terminó.');
    expect(screen.getByRole('alert').textContent).toContain('Completa tu usuario y contraseña');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([401, 503])('clears the expiration notice immediately on a valid submission and does not restore it after HTTP %s', async (status) => {
    window.history.replaceState(null, '', '/login?sesion=expirada&next=%2Fcliente');
    let finish!: (value: Response) => void;
    const fetcher = vi.fn(() => new Promise<Response>(resolve => { finish = resolve; }));
    vi.stubGlobal('fetch', fetcher);
    const { container } = render(<LoginForm />);
    await fillForm();
    expect(screen.getByRole('status').textContent).toContain('Tu sesión terminó.');
    fireEvent.submit(container.querySelector('form')!);
    expect(screen.queryByText('Tu sesión terminó. Ingresa de nuevo para continuar.')).toBeNull();
    expect(container.querySelector('form')?.hasAttribute('aria-describedby')).toBe(false);
    expect(fetcher).toHaveBeenCalledWith('/bff/login', expect.objectContaining({
      method: 'POST', credentials: 'same-origin',
      body: JSON.stringify({ nombre: 'operador-prueba', contrasena: 'synthetic-password' }),
    }));
    expect(window.location.search).toBe('?sesion=expirada&next=%2Fcliente');
    await act(async () => finish(new Response('{}', { status })));
    expect(screen.getByRole('alert').textContent).toContain(status === 401 ? 'Usuario o contraseña incorrectos' : 'servicio de acceso');
    expect(container.querySelector('form')?.getAttribute('aria-describedby')).toBe('login-error');
    expect(screen.queryByText('Tu sesión terminó. Ingresa de nuevo para continuar.')).toBeNull();
    expect((screen.getByLabelText('Usuario') as HTMLInputElement).value).toBe('operador-prueba');
    expect((screen.getByLabelText('Contraseña') as HTMLInputElement).value).toBe('synthetic-password');
    expect((screen.getByRole('button', { name: 'Ingresar a la plataforma' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('never exposes credentials through native GET submission before hydration', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(<LoginForm />);
    expect(host.querySelector('form')?.method).toBe('post');
    expect(host.querySelector('form')?.getAttribute('action')).toBe('/bff/login');
    expect((host.querySelector('button[type=submit]') as HTMLButtonElement).disabled).toBe(true);
  });
  it('removes legacy credential parameters from the address after hydration', () => {
    window.history.replaceState(null, '', '/login?username=synthetic&password=synthetic&next=%2Fadministrador');
    render(<LoginForm />);
    expect(window.location.search).toBe('?next=%2Fadministrador');
    window.history.replaceState(null, '', '/');
  });
  it('shows and hides the password without submitting the form', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher); render(<LoginForm />);
    const user = await fillForm(); await user.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(screen.getByLabelText('Contraseña').getAttribute('type')).toBe('text');
    await user.click(screen.getByRole('button', { name: 'Ocultar contraseña' }));
    expect(screen.getByLabelText('Contraseña').getAttribute('type')).toBe('password'); expect(fetcher).not.toHaveBeenCalled();
  });
  it('keeps fields and enables retry after the server fails', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 503 })).mockResolvedValueOnce(new Response('{}', { status: 401 }));
    vi.stubGlobal('fetch', fetcher); render(<LoginForm />); const user = await fillForm();
    await user.click(screen.getByRole('button', { name: 'Ingresar a la plataforma' }));
    expect((await screen.findByRole('alert')).textContent).toContain('servicio de acceso');
    expect((screen.getByLabelText('Usuario') as HTMLInputElement).value).toBe('operador-prueba');
    await user.click(screen.getByRole('button', { name: 'Ingresar a la plataforma' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Usuario o contraseña incorrectos'));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('prevents duplicate requests while a login is pending', async () => {
    let finish!: (value: Response) => void;
    const fetcher = vi.fn(() => new Promise<Response>(resolve => { finish = resolve; })); vi.stubGlobal('fetch', fetcher);
    const { container } = render(<LoginForm />); await fillForm(); const form = container.querySelector('form')!;
    fireEvent.submit(form); fireEvent.submit(form);
    expect(fetcher).toHaveBeenCalledTimes(1); expect((screen.getByRole('button', { name: 'Verificando acceso…' }) as HTMLButtonElement).disabled).toBe(true);
    finish(new Response('{}', { status: 401 })); await screen.findByRole('alert');
    expect((screen.getByRole('button', { name: 'Ingresar a la plataforma' }) as HTMLButtonElement).disabled).toBe(false);
  });
});
