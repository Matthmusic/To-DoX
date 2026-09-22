import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StoragePanel } from './StoragePanel';
import useStore from '../../store/useStore';
import * as api from '../../services/api';

vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();
  return { ...actual, clearToken: vi.fn(), changePassword: vi.fn() };
});

describe('StoragePanel', () => {
  beforeEach(() => {
    // currentUser (UUID backend) et localAuthUserId (id LOCAL FIXED_USERS, utilisé par
    // saveToken/clearToken) sont délibérément DIFFÉRENTS ici -- c'est le blind spot exact
    // qui laissait passer ce bug avant (clearToken(currentUser) au lieu de
    // clearToken(localAuthUserId)).
    useStore.setState({ currentUser: 'u1', localAuthUserId: 'local-u1', authToken: 'tok', users: [{ id: 'u1', name: 'A', email: 'a@b.com' }] });
    vi.mocked(api.changePassword).mockReset();
  });

  it('shows the connected server and a logout button, no folder picker', () => {
    render(<StoragePanel onClose={() => {}} />);
    expect(screen.getByText('Se déconnecter')).toBeInTheDocument();
    expect(screen.queryByText(/dossier/i)).not.toBeInTheDocument();
  });

  it('logout clears the token and the session', async () => {
    render(<StoragePanel onClose={() => {}} />);
    fireEvent.click(screen.getByText('Se déconnecter'));

    // handleLogout is async (awaits clearToken before clearing the session) —
    // wait for the store update instead of asserting synchronously.
    await waitFor(() => {
      expect(useStore.getState().currentUser).toBeNull();
    });
    // L'id LOCAL ('local-u1'), pas currentUser ('u1') -- clearToken doit purger la clé sous
    // laquelle saveToken() a réellement écrit le token.
    expect(api.clearToken).toHaveBeenCalledWith('local-u1');
    expect(useStore.getState().authToken).toBeNull();
    expect(useStore.getState().localAuthUserId).toBeNull();
  });

  describe('changer le mot de passe', () => {
    function openForm() {
      fireEvent.click(screen.getByText('Changer le mot de passe'));
    }

    function fillAndSubmit(current: string, next: string, confirm: string) {
      fireEvent.change(screen.getByLabelText('Mot de passe actuel'), { target: { value: current } });
      fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), { target: { value: next } });
      fireEvent.change(screen.getByLabelText('Confirmer le nouveau mot de passe'), { target: { value: confirm } });
      fireEvent.click(screen.getByRole('button', { name: 'Valider le changement' }));
    }

    it('soumission valide : appelle changePassword avec le token, affiche un succès, vide le formulaire', async () => {
      vi.mocked(api.changePassword).mockResolvedValue(undefined);
      render(<StoragePanel onClose={() => {}} />);
      openForm();

      fillAndSubmit('ancien-mdp', 'nouveau-mdp-123', 'nouveau-mdp-123');

      await waitFor(() => {
        expect(screen.getByText('Mot de passe changé avec succès.')).toBeInTheDocument();
      });
      expect(api.changePassword).toHaveBeenCalledWith('ancien-mdp', 'nouveau-mdp-123', 'tok');
      expect((screen.getByLabelText('Mot de passe actuel') as HTMLInputElement).value).toBe('');
    });

    it('nouveau mot de passe trop court : erreur affichée, changePassword jamais appelé', async () => {
      render(<StoragePanel onClose={() => {}} />);
      openForm();

      fillAndSubmit('ancien-mdp', 'court', 'court');

      expect(await screen.findByText(/8 caractères/i)).toBeInTheDocument();
      expect(api.changePassword).not.toHaveBeenCalled();
    });

    it('confirmation différente du nouveau mot de passe : erreur affichée, changePassword jamais appelé', async () => {
      render(<StoragePanel onClose={() => {}} />);
      openForm();

      fillAndSubmit('ancien-mdp', 'nouveau-mdp-123', 'autre-chose-123');

      expect(await screen.findByText(/ne correspondent pas/i)).toBeInTheDocument();
      expect(api.changePassword).not.toHaveBeenCalled();
    });

    it("mauvais mot de passe actuel (401) : erreur affichée, mais l'utilisateur reste connecté (pas de déconnexion forcée)", async () => {
      vi.mocked(api.changePassword).mockRejectedValue(new api.ApiError(401, 'Mot de passe actuel incorrect'));
      render(<StoragePanel onClose={() => {}} />);
      openForm();

      fillAndSubmit('mauvais-mdp', 'nouveau-mdp-123', 'nouveau-mdp-123');

      expect(await screen.findByText('Mot de passe actuel incorrect')).toBeInTheDocument();
      // Régression : un 401 métier de changePassword ne doit jamais purger la session --
      // voir api.ts, suppressGlobalErrorHandling.
      expect(useStore.getState().currentUser).toBe('u1');
      expect(useStore.getState().authToken).toBe('tok');
    });
  });
});
