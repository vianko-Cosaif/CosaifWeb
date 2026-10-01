// @vitest-environment jsdom
import React, { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Modal from '@/components/ui/Modal/Modal';
beforeEach(() => { vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{ width: 10 }] as unknown as DOMRectList); });
afterEach(cleanup);
function Fixture() {
  const [open, setOpen] = useState(false), [child, setChild] = useState(false);
  return <><button onClick={() => setOpen(true)}>Abrir</button>{open ? <Modal title="Principal" onClose={() => setOpen(false)}><input aria-label="Nombre"/><button onClick={() => setChild(true)}>Abrir detalle</button>{child ? <Modal title="Detalle" onClose={() => setChild(false)}><button onClick={() => setOpen(false)}>Cerrar todo</button></Modal> : null}</Modal> : null}</>;
}
describe('shared modal keyboard behavior', () => {
  it('moves focus into the dialog, traps Tab and restores the trigger after Escape', async () => {
    const user = userEvent.setup(); render(<Fixture/>); await user.click(screen.getByText('Abrir'));
    const dialog = screen.getByRole('dialog', { name: 'Principal' }); expect(dialog.contains(document.activeElement)).toBe(true);
    screen.getByText('Abrir detalle').focus(); await user.tab(); expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cerrar' }));
    await user.tab({ shift: true }); expect(document.activeElement).toBe(screen.getByText('Abrir detalle'));
    await user.keyboard('{Escape}'); expect(screen.queryByRole('dialog')).toBeNull(); expect(document.activeElement).toBe(screen.getByText('Abrir'));
  });
  it('only closes the top dialog and keeps its parent usable', async () => {
    const user = userEvent.setup(); render(<Fixture/>); await user.click(screen.getByText('Abrir')); await user.click(screen.getByText('Abrir detalle'));
    await user.keyboard('{Escape}'); expect(screen.queryByRole('dialog', { name: 'Detalle' })).toBeNull(); expect(screen.getByRole('dialog', { name: 'Principal' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByText('Abrir detalle'));
  });
  it('restores inert and scroll state when nested dialogs close at once', async () => {
    const user = userEvent.setup(); const { container } = render(<Fixture/>); await user.click(screen.getByText('Abrir')); await user.click(screen.getByText('Abrir detalle'));
    expect(container.inert).toBe(true); await user.click(screen.getByText('Cerrar todo'));
    await waitFor(() => expect(container.inert).not.toBe(true)); expect(document.body.style.overflow).toBe(''); expect(document.activeElement).toBe(screen.getByText('Abrir'));
  });
  it('does not close from a click inside the form', async () => {
    const user = userEvent.setup(); render(<Fixture/>); await user.click(screen.getByText('Abrir')); fireEvent.mouseDown(screen.getByLabelText('Nombre')); expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
