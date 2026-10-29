import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ClaudePanel, CLAUDE_ONBOARDING_KEY } from './ClaudePanel';
import useStore from '../../store/useStore';
import type { ClaudeIntegrationStatus, ElectronAPI } from '../../types';

const baseStatus: ClaudeIntegrationStatus = {
  supported: true, enabled: false, claudeDetected: true, configured: false, bundleFound: true, sessionPresent: false,
};

function mockClaude(status: ClaudeIntegrationStatus) {
  let current = status;
  const claude = {
    status: vi.fn(async () => current),
    install: vi.fn(async () => { current = { ...current, enabled: true, configured: true, sessionPresent: true }; return { success: true }; }),
    uninstall: vi.fn(async () => { current = { ...current, enabled: false, configured: false }; return { success: true }; }),
    syncSession: vi.fn(async () => ({ success: true })),
  };
  window.electronAPI = { isElectron: true, claude, openExternalUrl: vi.fn() } as unknown as ElectronAPI;
  return claude;
}

describe('ClaudePanel', () => {
  beforeEach(() => {
    localStorage.clear();
    useStore.setState({ currentUser: 'u1', localAuthUserId: 'local-u1', authToken: 'tok' });
  });
  afterEach(() => { delete window.electronAPI; });

  it('affiche les 4 étapes et connecte Claude avec la session courante', async () => {
    const claude = mockClaude(baseStatus);
    render(<ClaudePanel onClose={() => {}} />);
    expect(screen.getByText('Fermer complètement Claude')).toBeInTheDocument();
    expect(screen.getByText('Rouvrir Claude')).toBeInTheDocument();
    expect(screen.getByText('Faire un test')).toBeInTheDocument();

    fireEvent.click(await screen.findByText('Connecter Claude'));
    await waitFor(() => expect(screen.getByText('To-DoX est connecté à Claude')).toBeInTheDocument());
    expect(claude.install).toHaveBeenCalledWith({ apiUrl: expect.any(String), token: 'tok', userId: 'local-u1' });
    expect(screen.getByText('Terminé')).toBeInTheDocument();
  });

  it("propose le téléchargement si Claude n'est pas installé", async () => {
    mockClaude({ ...baseStatus, claudeDetected: false });
    render(<ClaudePanel onClose={() => {}} />);
    expect(await screen.findByText(/Télécharger Claude/)).toBeInTheDocument();
  });

  it("mémorise que l'assistant a été vu à la fermeture", async () => {
    mockClaude(baseStatus);
    const onClose = vi.fn();
    render(<ClaudePanel onClose={onClose} />);
    fireEvent.click(await screen.findByText('Plus tard'));
    expect(onClose).toHaveBeenCalled();
    expect(localStorage.getItem(CLAUDE_ONBOARDING_KEY)).toBe('1');
  });
});
