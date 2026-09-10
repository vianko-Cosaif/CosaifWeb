import { EventEmitter } from 'node:events';
import { type ChildProcess, type spawn } from 'node:child_process';
import { constants } from 'node:os';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startLocal } from '../scripts/start-local.mjs';
import packageJson from '../package.json';

function harness() {
  const inheritedEnv = {
    API_ORIGIN: 'https://remote-api.invalid:3001',
    NODE_ENV: 'development',
    SESSION_SECRET: 'synthetic-session-secret-for-launcher-tests',
    JWT_SECRET: 'synthetic-jwt-secret-for-launcher-tests',
    CUSTOM_OPTION: 'synthetic-option',
  };
  const runtime = Object.assign(new EventEmitter(), {
    env: inheritedEnv,
    execPath: '/synthetic/node',
    exitCode: undefined as number | undefined,
  }) as unknown as NodeJS.Process;
  const child = Object.assign(new EventEmitter(), {
    kill: vi.fn(() => true),
  }) as unknown as ChildProcess;
  const spawnProcess = vi.fn<typeof spawn>().mockReturnValue(child);
  return { inheritedEnv, runtime, child, spawnProcess };
}

afterEach(() => vi.restoreAllMocks());

describe('local production launcher', () => {
  it('overrides a remote API only for the child while preserving other inherited settings', () => {
    const { inheritedEnv, runtime, child, spawnProcess } = harness();
    const before = { ...inheritedEnv };
    expect(packageJson.scripts['start:local']).toBe('node scripts/start-local.mjs');
    expect(startLocal({ runtime, spawnProcess })).toBe(child);
    expect(spawnProcess).toHaveBeenCalledOnce();
    const [command, args, options] = spawnProcess.mock.calls[0];
    expect(command).toBe(runtime.execPath);
    expect(args).toEqual([
      expect.stringMatching(/next[/\\]dist[/\\]bin[/\\]next$/),
      'start', '--hostname', '127.0.0.1', '--port', '3012',
    ]);
    expect(options).toEqual({
      cwd: fileURLToPath(new URL('../', import.meta.url)),
      env: { ...before, NODE_ENV: 'production', API_ORIGIN: 'http://127.0.0.1:3001' },
      stdio: 'inherit',
      shell: false,
    });
    expect(inheritedEnv).toEqual(before);
    child.emit('close', 0, null);
  });

  it.each([0, 1, 42])('preserves child exit code %s without restarting it', (exitCode) => {
    const { runtime, child, spawnProcess } = harness();
    startLocal({ runtime, spawnProcess });
    child.emit('close', exitCode, null);
    expect(runtime.exitCode).toBe(exitCode);
    expect(runtime.listenerCount('SIGINT')).toBe(0);
    expect(runtime.listenerCount('SIGTERM')).toBe(0);
    expect(spawnProcess).toHaveBeenCalledOnce();
  });

  it.each(['SIGINT', 'SIGTERM'] as const)('forwards %s and waits for Next to close', (signal) => {
    const { runtime, child, spawnProcess } = harness();
    startLocal({ runtime, spawnProcess });
    runtime.emit(signal);
    expect(child.kill).toHaveBeenCalledWith(signal);
    expect(runtime.exitCode).toBeUndefined();
    child.emit('close', null, signal);
    expect(runtime.exitCode).toBe(128 + constants.signals[signal]);
  });

  it('reports spawn errors safely and does not overwrite failure on close', () => {
    const report = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { runtime, child, spawnProcess } = harness();
    startLocal({ runtime, spawnProcess });
    child.emit('error', new Error('synthetic-private-error-details'));
    child.emit('close', 0, null);
    expect(runtime.exitCode).toBe(1);
    expect(runtime.listenerCount('SIGTERM')).toBe(0);
    expect(report).toHaveBeenCalledOnce();
    expect(String(report.mock.calls)).not.toContain('synthetic-private-error-details');
  });

  it('returns failure when spawning throws before a child exists', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { runtime, spawnProcess } = harness();
    spawnProcess.mockImplementation(() => { throw new Error('synthetic launch failure'); });
    expect(startLocal({ runtime, spawnProcess })).toBeNull();
    expect(runtime.exitCode).toBe(1);
    expect(runtime.listenerCount('SIGINT')).toBe(0);
  });
});
