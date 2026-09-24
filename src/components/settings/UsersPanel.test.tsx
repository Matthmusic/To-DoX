import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { UsersPanel } from './UsersPanel';
import useStore from '../../store/useStore';
import { ApiError } from '../../services/api';
import { alertModal, confirmModal } from '../../utils/confirm';

vi.mock('../../utils/confirm', () => ({
    alertModal: vi.fn().mockResolvedValue(true),
    confirmModal: vi.fn().mockResolvedValue(true),
}));

const ADMIN = { id: 'admin1', name: 'Admin', email: 'admin@test.com', role: 'admin' as const };
const MEMBER = { id: 'm1', name: 'Membre', email: 'membre@test.com', role: 'member' as const };

function fillAddForm({ name = 'Nouveau Membre', email = 'nouveau@test.com', password = 'motdepasse1' } = {}) {
    fireEvent.change(screen.getByLabelText('Nom du nouvel utilisateur'), { target: { value: name } });
    fireEvent.change(screen.getByLabelText('Email du nouvel utilisateur'), { target: { value: email } });
    fireEvent.change(screen.getByLabelText('Mot de passe initial'), { target: { value: password } });
}

describe('UsersPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useStore.setState({ users: [ADMIN, MEMBER], currentUser: 'admin1', createUser: vi.fn() });
    });

    it('avertit que la modification et la suppression peuvent ne pas persister', () => {
        render(<UsersPanel onClose={() => {}} />);

        expect(screen.getByText(/peuvent ne pas persister/i)).toBeInTheDocument();
    });

    it("crée l'utilisateur sur le serveur (email en minuscules, sans espaces) puis l'affiche dans la liste", async () => {
        const createUser = vi.fn().mockResolvedValue({ id: 'new-uuid', name: 'Nouveau Membre', email: 'nouveau@test.com', role: 'member' });
        useStore.setState({ createUser });
        render(<UsersPanel onClose={() => {}} />);

        fillAddForm({ name: '  Nouveau Membre ', email: ' Nouveau@Test.com ' });
        fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));

        await waitFor(() => expect(createUser).toHaveBeenCalledWith({ name: 'Nouveau Membre', email: 'nouveau@test.com', password: 'motdepasse1' }));
        await waitFor(() => expect(screen.getByDisplayValue('Nouveau Membre')).toBeInTheDocument());
        expect(screen.getByLabelText('Nom du nouvel utilisateur')).toHaveValue('');
        expect(screen.getByLabelText('Mot de passe initial')).toHaveValue('');
    });

    it('refuse un mot de passe de moins de 8 caractères sans appeler le serveur', async () => {
        const createUser = vi.fn();
        useStore.setState({ createUser });
        render(<UsersPanel onClose={() => {}} />);

        fillAddForm({ password: 'court' });
        fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));

        await waitFor(() => expect(alertModal).toHaveBeenCalledWith(expect.stringContaining('8 caractères')));
        expect(createUser).not.toHaveBeenCalled();
    });

    it("affiche l'erreur du serveur et conserve la saisie quand la création échoue", async () => {
        const createUser = vi.fn().mockRejectedValue(new ApiError(409, 'Email déjà utilisé'));
        useStore.setState({ createUser });
        render(<UsersPanel onClose={() => {}} />);

        fillAddForm();
        fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));

        await waitFor(() => expect(alertModal).toHaveBeenCalledWith('Email déjà utilisé'));
        expect(screen.getByLabelText('Nom du nouvel utilisateur')).toHaveValue('Nouveau Membre');
        expect(screen.getAllByDisplayValue('nouveau@test.com')).toHaveLength(1);
    });

    it("n'envoie qu'une seule création si on clique deux fois pendant l'appel", async () => {
        let resolveCreate!: (user: unknown) => void;
        const createUser = vi.fn().mockReturnValue(new Promise(resolve => { resolveCreate = resolve; }));
        useStore.setState({ createUser });
        render(<UsersPanel onClose={() => {}} />);

        fillAddForm();
        const addButton = screen.getByRole('button', { name: 'Ajouter' });
        fireEvent.click(addButton);
        fireEvent.click(addButton);

        expect(createUser).toHaveBeenCalledTimes(1);
        await act(async () => { resolveCreate({ id: 'new-uuid', name: 'Nouveau Membre', email: 'nouveau@test.com', role: 'member' }); });
    });

    it("conserve un utilisateur créé pendant qu'une confirmation de suppression est en attente", async () => {
        let resolveConfirm!: (confirmed: boolean) => void;
        vi.mocked(confirmModal).mockReturnValueOnce(new Promise<boolean>(resolve => { resolveConfirm = resolve; }));
        const created = { id: 'new-uuid', name: 'Nouveau Membre', email: 'nouveau@test.com', role: 'member' as const };
        useStore.setState({ createUser: vi.fn().mockResolvedValue(created) });
        render(<UsersPanel onClose={() => {}} />);

        // 1. "Supprimer" sur la ligne MEMBRE (2e ligne, après ADMIN) : la confirmation reste ouverte.
        fireEvent.click(screen.getAllByRole('button', { name: 'Supprimer' })[1]);
        expect(confirmModal).toHaveBeenCalledTimes(1);

        // 2. Pendant ce temps, l'ajout aboutit et le compte créé apparaît dans la liste.
        fillAddForm();
        fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
        await waitFor(() => expect(screen.getByDisplayValue('Nouveau Membre')).toBeInTheDocument());

        // 3. L'admin confirme la suppression : elle ne doit pas écraser le compte créé entre-temps.
        await act(async () => { resolveConfirm(true); });

        expect(screen.queryByDisplayValue('Membre')).not.toBeInTheDocument();
        expect(screen.getByDisplayValue('Nouveau Membre')).toBeInTheDocument();

        // 4. "Enregistrer" valide le brouillon : le compte créé doit survivre dans le store.
        fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
        const savedIds = useStore.getState().users.map(u => u.id);
        expect(savedIds).toContain('new-uuid');
        expect(savedIds).not.toContain('m1');
    });

    it("remplace le formulaire par une note pour un utilisateur non administrateur", () => {
        useStore.setState({ currentUser: 'm1' });
        render(<UsersPanel onClose={() => {}} />);

        expect(screen.getByText(/Seuls les administrateurs/i)).toBeInTheDocument();
        expect(screen.queryByLabelText('Mot de passe initial')).not.toBeInTheDocument();
    });

    it("traite un utilisateur connecté sans rôle (avant la première synchro) comme non-administrateur", () => {
        useStore.setState({ users: [{ id: 'norole', name: 'Sans rôle', email: 'x@test.com' }], currentUser: 'norole' });
        render(<UsersPanel onClose={() => {}} />);

        expect(screen.getByText(/Seuls les administrateurs/i)).toBeInTheDocument();
    });
});
