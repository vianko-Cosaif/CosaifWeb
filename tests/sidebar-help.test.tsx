// @vitest-environment jsdom
import React, { useCallback, useRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SidebarHelpDialog from '@/components/Menu/SidebarHelpDialog';
import { useMobileDrawerFocus } from '@/components/Menu/useMobileDrawerFocus';

beforeEach(() => { vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{ width: 10 }] as unknown as DOMRectList); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function DrawerFixture() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null), panel = useRef<HTMLElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useMobileDrawerFocus({ open, panel, trigger, onClose: close });
  return <><button ref={trigger} onClick={() => setOpen(true)}>Abrir menú</button>
    <aside ref={panel} inert={!open} aria-hidden={!open} tabIndex={-1}><button onClick={close}>Cerrar menú</button><a href="#movimientos">Movimientos</a></aside>
    <button>Fuera del menú</button></>;
}

describe('adaptive sidebar help and keyboard navigation', () => {
  it('filters guides by role and accent-insensitive search and returns the selected guide', async () => {
    const onSelect = vi.fn(), user = userEvent.setup();
    render(<SidebarHelpDialog role="CLIENTE" onClose={vi.fn()} onSelect={onSelect} />);
    expect(screen.queryByRole('button', { name: /Usuarios, roles/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Comercial: contratos/ })).toBeNull();
    await user.type(screen.getByRole('searchbox', { name: 'Buscar ayuda' }), 'róndas ordenar');
    await user.click(screen.getByRole('button', { name: /Rondas: consultar, ordenar y cancelar/ }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'rounds-training' }));
    await user.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));
    expect(screen.getByRole('button', { name: /Entender movimientos/ })).toBeTruthy();
  });

  it('keeps focus inside the mobile menu and restores the trigger and scrolling on Escape', async () => {
    const user = userEvent.setup(); render(<DrawerFixture />);
    await user.click(screen.getByRole('button', { name: 'Abrir menú' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cerrar menú' }));
    expect(document.body.style.overflow).toBe('hidden');
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Movimientos' }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cerrar menú' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('link', { name: 'Movimientos' })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Abrir menú' }));
    expect(document.body.style.overflow).toBe('');
  });
});
