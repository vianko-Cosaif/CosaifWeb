// @vitest-environment jsdom
import React, { useEffect, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  GuidedManualProvider, GuidedTarget, useGuidedManualApi, useGuidedManualState,
} from '@/features/capacitacion/GuidedManualAtom.web';
import { ClientMovementGuideProvider } from '@/features/capacitacion/ClientMovementGuide';
import { useTrainingTour } from '@/features/capacitacion/TrainingTourContext';
import { FINISH_ROLE_TUTORIAL_EVENT, START_ROLE_TUTORIAL_EVENT } from '@/features/capacitacion/trainingEvents';

const spies = vi.hoisted(() => ({ loadTour: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => '/administrador', useRouter: () => ({ push: spies.push }) }));
vi.mock('@/features/capacitacion/liveGuide', async (importOriginal) => {
  spies.loadTour();
  return await importOriginal();
});
let manual: ReturnType<typeof useGuidedManualApi>;
let mounts = 0;
const steps = [{ id: 'intro', targetId: 'persistent-input', title: 'Revisar la ronda', description: 'Conserva el trabajo que llevas capturado.' }];
function PersistentForm() {
  const [value, setValue] = useState('');
  const api = useGuidedManualApi();
  useEffect(() => { manual = api; }, [api]);
  useEffect(() => { mounts++; }, []);
  return <GuidedTarget id="persistent-input"><input aria-label="Observación" value={value} onChange={(event) => setValue(event.target.value)} /></GuidedTarget>;
}
function TrainingStatus() {
  const training = useTrainingTour();
  const state = useGuidedManualState();
  return <output data-testid="training-status">{`${training.active}:${training.role}:${state?.isOpen}`}</output>;
}
beforeEach(() => {
  mounts = 0;
  vi.stubGlobal('React', React);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 20, y: 20, top: 20, left: 20, right: 140, bottom: 60, width: 120, height: 40, toJSON: () => ({}) });
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('on-demand training', () => {
  it('keeps forms and registered targets mounted while the visual guide loads and closes', async () => {
    render(<GuidedManualProvider steps={steps}><PersistentForm /></GuidedManualProvider>);
    const input = screen.getByLabelText('Observación');
    const target = manual?.getTarget('persistent-input');
    fireEvent.change(input, { target: { value: 'Pendiente de inspección' } });
    expect(screen.queryByText('Revisar la ronda')).toBeNull();
    expect(spies.loadTour).not.toHaveBeenCalled();
    act(() => manual?.start());
    await screen.findByText('Revisar la ronda');
    expect(screen.getByLabelText('Observación')).toBe(input);
    expect((input as HTMLInputElement).value).toBe('Pendiente de inspección');
    expect(manual?.getTarget('persistent-input')).toBe(target);
    expect(mounts).toBe(1);
    act(() => manual?.close());
    await waitFor(() => expect(screen.queryByText('Revisar la ronda')).toBeNull());
    expect(screen.getByLabelText('Observación')).toBe(input);
    expect(mounts).toBe(1);
  });

  it('starts the requested SIM training on demand and clears it when finished without resetting the page', async () => {
    render(<ClientMovementGuideProvider><main id="main"><PersistentForm /><TrainingStatus /></main></ClientMovementGuideProvider>);
    expect(screen.getByTestId('training-status').textContent).toBe('false:CLIENTE:false');
    expect(spies.loadTour).not.toHaveBeenCalled();
    const input = screen.getByLabelText('Observación');
    fireEvent.change(input, { target: { value: 'Ronda 82' } });
    act(() => window.dispatchEvent(new CustomEvent(START_ROLE_TUTORIAL_EVENT, { detail: { role: 'ADMINISTRADOR' } })));
    await waitFor(() => expect(screen.getByTestId('training-status').textContent).toBe('true:ADMINISTRADOR:true'));
    expect(spies.loadTour).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('Observación')).toBe(input);
    expect(mounts).toBe(1);
    act(() => window.dispatchEvent(new CustomEvent(FINISH_ROLE_TUTORIAL_EVENT)));
    await waitFor(() => expect(screen.getByTestId('training-status').textContent).toBe('false:ADMINISTRADOR:false'));
    expect((input as HTMLInputElement).value).toBe('Ronda 82');
  });

  it('does not reopen SIM mode after help was cancelled while its module was loading', async () => {
    render(<ClientMovementGuideProvider><main id="main"><TrainingStatus /></main></ClientMovementGuideProvider>);
    await act(async () => {
      window.dispatchEvent(new CustomEvent(START_ROLE_TUTORIAL_EVENT, { detail: { role: 'ADMINISTRADOR' } }));
      window.dispatchEvent(new CustomEvent(FINISH_ROLE_TUTORIAL_EVENT));
      await Promise.resolve();
    });
    expect(screen.getByTestId('training-status').textContent).toBe('false:CLIENTE:false');
  });
});
