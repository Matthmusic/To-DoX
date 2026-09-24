# Création d'utilisateurs depuis To-DoX — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un administrateur crée un vrai compte depuis « Gestion des utilisateurs » (persisté sur le serveur), et la personne peut ensuite se connecter depuis son propre poste.

**Architecture:** Frontend uniquement. « Ajouter » appelle l'action de store `createUser` existante (qui renvoie désormais l'utilisateur créé) ; l'édition et la suppression restent un brouillon local inchangé. L'écran de login gagne un parcours « Autre compte » (email + mot de passe) et mémorise ces comptes dans `localStorage`, car la liste `users` n'est pas persistée.

**Tech Stack:** React 19, TypeScript, Zustand, Vitest + Testing Library, Tailwind.

**Spec:** `docs/superpowers/specs/2026-09-24-users-creation-design.md`

## Global Constraints

- Toute l'UI en **français**, accents corrects.
- `MIN_PASSWORD_LENGTH = 8`, défini une seule fois dans `src/constants.ts`.
- Aucun changement dans `todox-backend/` (pas de redéploiement du LXC 104).
- Toujours passer par les actions du store, jamais `setTasks`/état manuel pour muter les données.
- Composants en exports nommés, Tailwind uniquement, pas de commentaire sauf « pourquoi » non évident.
- Commandes lancées depuis `C:\DEV\TO DO X\To-DoX` (le dépôt git est ce dossier).
- Chaque commit se termine par la ligne `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. Ne rien pousser (`git push`) : la release est un sujet séparé.

## Review Focus

- Double clic sur « Ajouter » pendant l'appel serveur → une seule création (test Task 2).
- Utilisateur connecté sans `role` (avant la première synchro) → traité comme non-admin, note visible (test Task 2).
- Email saisi avec majuscules ou espaces → envoyé en minuscules, sans espaces (test Task 2).
- `localStorage` des comptes mémorisés corrompu → l'écran de login s'affiche quand même (test Task 3).
- Compte mémorisé dont l'email est déjà dans la liste → jamais affiché en double (test Task 3).

---

### Task 1: `createUser` renvoie l'utilisateur, constante partagée du mot de passe

**Files:**
- Modify: `src/constants.ts` (après le tableau `FIXED_USERS`)
- Modify: `src/components/settings/AccountPanel.tsx:9`
- Modify: `src/store/useStore.ts:107` et `:378-382`
- Test: `src/store/useStore.test.ts:1101-1109`

**Interfaces:**
- Produces: `MIN_PASSWORD_LENGTH: number` exporté par `src/constants.ts` ; `createUser(data: { email: string; name: string; password: string; role?: 'admin' | 'member' }): Promise<User>` (renvoie l'utilisateur renvoyé par l'API).

- [ ] **Step 1: Réécrire le test `createUser` (échec attendu)**

Dans `src/store/useStore.test.ts`, remplacer le test `createUser posts to the API and appends the result` (lignes 1101-1109) par :

```ts
    it('createUser posts to the API, appends the result and returns it', async () => {
        vi.mocked(api.apiPost).mockResolvedValue({ id: 'u2', email: 'c@d.com', name: 'C', role: 'member' });
        const { result } = renderHook(() => useStore());

        let created: unknown;
        await act(async () => { created = await result.current.createUser({ email: 'c@d.com', name: 'C', password: 'x' }); });

        // suppressGlobalErrorHandling : UsersPanel affiche lui-même l'erreur, sinon le canal global
        // ajouterait un bandeau en plus de l'alerte.
        expect(api.apiPost).toHaveBeenCalledWith('/api/users', { email: 'c@d.com', name: 'C', password: 'x' }, 'tok', { suppressGlobalErrorHandling: true });
        expect(created).toEqual({ id: 'u2', email: 'c@d.com', name: 'C', role: 'member' });
        expect(result.current.users.find(u => u.id === 'u2')).toBeTruthy();
    });
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `npm run test -- --run src/store/useStore.test.ts -t "createUser"`
Expected: FAIL (`apiPost` appelé avec 3 arguments, et `created` vaut `undefined`).

- [ ] **Step 3: Implémenter**

Dans `src/store/useStore.ts`, ligne 107, changer le type de retour :

```ts
    createUser: (data: { email: string; name: string; password: string; role?: 'admin' | 'member' }) => Promise<User>;
```

Puis remplacer l'implémentation (lignes 378-382) par :

```ts
    createUser: async (data) => {
        const token = get().authToken;
        // Pas de canal d'erreur global : l'appelant (UsersPanel) affiche lui-même l'erreur.
        const created = await apiPost<User>('/api/users', data, token ?? undefined, { suppressGlobalErrorHandling: true });
        get().setUsers([...get().users, created]);
        return created;
    },
```

Dans `src/constants.ts`, juste après le tableau `FIXED_USERS` (après la ligne `{ id: "unassigned", ... },` et son `];`), ajouter :

```ts

/** Longueur minimale d'un mot de passe — à garder synchro avec la validation serveur (todox-backend/src/routes/auth.ts). */
export const MIN_PASSWORD_LENGTH = 8;
```

Dans `src/components/settings/AccountPanel.tsx`, supprimer la ligne 9 (`const MIN_PASSWORD_LENGTH = 8; // ...`) et ajouter l'import parmi les autres imports du fichier :

```ts
import { MIN_PASSWORD_LENGTH } from "../../constants";
```

- [ ] **Step 4: Vérifier**

Run: `npm run test -- --run src/store/useStore.test.ts src/components/settings/AccountPanel.test.tsx` puis `npx tsc -b`
Expected: tests PASS, aucune erreur de typage.

- [ ] **Step 5: Commit**

```bash
git add src/constants.ts src/components/settings/AccountPanel.tsx src/store/useStore.ts src/store/useStore.test.ts
git commit -m "feat: createUser renvoie l'utilisateur créé, MIN_PASSWORD_LENGTH partagé

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Formulaire d'ajout branché sur le serveur (`UsersPanel`)

**Files:**
- Modify: `src/components/settings/UsersPanel.tsx` (réécriture complète ci-dessous)
- Test: `src/components/settings/UsersPanel.test.tsx` (réécriture complète ci-dessous)

**Interfaces:**
- Consumes: `createUser(...) : Promise<User>` du store ; `MIN_PASSWORD_LENGTH` de `src/constants.ts` ; `ApiError` de `src/services/api.ts` (`status`, `message`) ; `alertModal(message): Promise<boolean>`.

- [ ] **Step 1: Écrire les tests (échec attendu)**

Remplacer tout le contenu de `src/components/settings/UsersPanel.test.tsx` par :

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { UsersPanel } from './UsersPanel';
import useStore from '../../store/useStore';
import { ApiError } from '../../services/api';
import { alertModal } from '../../utils/confirm';

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
```

- [ ] **Step 2: Lancer les tests, vérifier qu'ils échouent**

Run: `npm run test -- --run src/components/settings/UsersPanel.test.tsx`
Expected: FAIL (`Unable to find a label with the text of: Nom du nouvel utilisateur`, etc.).

- [ ] **Step 3: Réécrire `UsersPanel.tsx`**

Remplacer tout le contenu de `src/components/settings/UsersPanel.tsx` par :

```tsx
import { useState } from "react";
import { Users, Eye, EyeOff } from "lucide-react";
import useStore from "../../store/useStore";
import { useShallow } from 'zustand/react/shallow';
import type { User } from "../../types";
import { GlassModal } from "../ui/GlassModal";
import { alertModal, confirmModal } from "../../utils/confirm";
import { useTheme } from "../../hooks/useTheme";
import { ApiError } from "../../services/api";
import { MIN_PASSWORD_LENGTH } from "../../constants";

interface UsersPanelProps {
    onClose: () => void;
}

// L'AJOUT passe par le backend (createUser -> POST /api/users, admin uniquement).
// La modification et la suppression restent un brouillon local (localUsers, validé par
// setUsers au clic "Enregistrer") : il n'existe pas encore de PUT/DELETE /api/users/:id côté
// backend, et supprimer un utilisateur qui a des tâches/commentaires assignés pose une vraie
// question produit (le schéma Prisma User n'a pas de cascade sur ces relations).
export function UsersPanel({ onClose }: UsersPanelProps) {
    const { users, setUsers, currentUser, setCurrentUser, createUser } = useStore(useShallow((s) => ({ users: s.users, setUsers: s.setUsers, currentUser: s.currentUser, setCurrentUser: s.setCurrentUser, createUser: s.createUser })));
    const { activeTheme } = useTheme();
    const primaryColor = activeTheme.palette.primary;
    const [localUsers, setLocalUsers] = useState<User[]>(() => [...users]);
    const [newUserName, setNewUserName] = useState("");
    const [newUserEmail, setNewUserEmail] = useState("");
    const [newUserPassword, setNewUserPassword] = useState("");
    const [showNewUserPassword, setShowNewUserPassword] = useState(false);
    const [creating, setCreating] = useState(false);

    // role absent = compte pas encore synchronisé avec le backend : on ne présume pas admin.
    const isAdmin = users.find(u => u.id === currentUser)?.role === 'admin';

    async function addUser() {
        if (creating) return;
        if (!newUserName.trim()) {
            alertModal("Le nom de l'utilisateur est requis");
            return;
        }
        if (!newUserEmail.trim() || !newUserEmail.includes("@")) {
            alertModal("Un email valide est requis");
            return;
        }
        if (newUserPassword.length < MIN_PASSWORD_LENGTH) {
            alertModal(`Le mot de passe initial doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères`);
            return;
        }

        setCreating(true);
        try {
            const created = await createUser({
                name: newUserName.trim(),
                email: newUserEmail.trim().toLowerCase(),
                password: newUserPassword,
            });
            // Le brouillon doit aussi contenir le compte créé : sinon "Enregistrer" (setUsers(localUsers))
            // le retirerait du store jusqu'au prochain poll.
            setLocalUsers(prev => [...prev, created]);
            setNewUserName("");
            setNewUserEmail("");
            setNewUserPassword("");
        } catch (err) {
            alertModal(err instanceof ApiError ? err.message : "Erreur de connexion au serveur");
        } finally {
            setCreating(false);
        }
    }

    async function removeUser(userId: string) {
        // Pas de DELETE /api/users/:id côté backend — voir commentaire en tête de fichier.
        if (userId === "unassigned") {
            alertModal("Impossible de supprimer l'utilisateur par défaut");
            return;
        }
        if (await confirmModal("Supprimer cet utilisateur ?")) {
            setLocalUsers(localUsers.filter(u => u.id !== userId));
        }
    }

    function updateUser(userId: string, field: keyof User, value: string) {
        // Pas de PUT /api/users/:id côté backend — voir commentaire en tête de fichier.
        setLocalUsers(localUsers.map(u =>
            u.id === userId ? { ...u, [field]: value } : u
        ));
    }

    function save() {
        // Commit local uniquement (setUsers) pour la modification/suppression — voir commentaire en tête de fichier.
        // Validation des emails
        for (const user of localUsers) {
            if (user.id !== "unassigned" && (!user.email || !user.email.includes("@"))) {
                alertModal(`L'utilisateur "${user.name}" doit avoir un email valide`);
                return;
            }
        }
        setUsers(localUsers);
        onClose();
    }

    return (
        <GlassModal isOpen={true} onClose={onClose} title={<><Users className="w-6 h-6 mr-2" style={{ color: primaryColor }} />Gestion des utilisateurs</>} size="xl">
            <p className="mt-2 text-sm text-theme-muted">
                Gérez les utilisateurs qui peuvent être assignés aux tâches. L'email sera utilisé pour les relances futures.
            </p>

            {/* Utilisateur connecté */}
            <div className="mt-4 rounded-2xl border border-blue-400/30 bg-blue-400/5 p-4">
                <h4 className="text-sm font-semibold text-blue-200 mb-3">Utilisateur connecté</h4>
                <div className="flex items-center gap-3">
                    <span className="text-sm text-theme-secondary">Session actuelle :</span>
                    <select
                        value={currentUser || "unassigned"}
                        onChange={(e) => setCurrentUser(e.target.value === "unassigned" ? null : e.target.value)}
                        className="flex-1 rounded-xl border border-[rgba(var(--overlay-rgb),0.15)] bg-[rgba(var(--overlay-rgb),0.1)] px-3 py-2 text-theme-primary focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50 cursor-pointer"
                    >
                        <option value="unassigned" className="bg-slate-800 text-theme-primary">Non assigné</option>
                        {[...users].filter(u => u.id !== "unassigned").sort((a, b) => {
                            if (a.id === currentUser) return -1;
                            if (b.id === currentUser) return 1;
                            return 0;
                        }).map(user => (
                            <option key={user.id} value={user.id} className="bg-slate-800 text-theme-primary">
                                {user.name} ({user.email})
                            </option>
                        ))}
                    </select>
                </div>
                <p className="mt-2 text-xs text-blue-300/70">
                    Cet utilisateur sera utilisé pour créer de nouvelles tâches et filtrer votre vue.
                </p>
            </div>

            {/* Liste des utilisateurs existants */}
            <div className="mt-4 max-h-[40vh] space-y-3 overflow-auto pr-1">
                {localUsers.map((user) => (
                    <div
                        key={user.id}
                        className="flex flex-col sm:grid sm:grid-cols-12 items-stretch sm:items-center gap-2 rounded-2xl border border-[rgba(var(--overlay-rgb),0.1)] bg-[rgba(var(--overlay-rgb),0.05)] p-3"
                    >
                        <div className="w-full sm:col-span-4">
                            <input
                                type="text"
                                value={user.name}
                                onChange={(e) => updateUser(user.id, "name", e.target.value)}
                                disabled={user.id === "unassigned"}
                                className="w-full rounded-xl border border-[rgba(var(--overlay-rgb),0.15)] bg-[rgba(var(--overlay-rgb),0.05)] px-2 py-1.5 text-sm text-theme-primary disabled:opacity-50 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                placeholder="Nom"
                            />
                        </div>
                        <div className="w-full sm:col-span-6">
                            <input
                                type="email"
                                value={user.email}
                                onChange={(e) => updateUser(user.id, "email", e.target.value.toLowerCase())}
                                disabled={user.id === "unassigned"}
                                className="w-full rounded-xl border border-[rgba(var(--overlay-rgb),0.15)] bg-[rgba(var(--overlay-rgb),0.05)] px-2 py-1.5 text-sm text-theme-primary disabled:opacity-50 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                placeholder="email@exemple.com"
                            />
                        </div>
                        <div className="w-full sm:col-span-2">
                            {user.id !== "unassigned" && (
                                <button
                                    onClick={() => removeUser(user.id)}
                                    className="w-full rounded-xl border border-rose-400/40 bg-rose-400/10 px-2 py-1.5 text-xs text-rose-100 transition hover:bg-rose-400/20"
                                >
                                    Supprimer
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Ajout d'un nouvel utilisateur */}
            <div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-4">
                <h4 className="text-sm font-semibold text-emerald-200">Ajouter un utilisateur</h4>
                {isAdmin ? (
                    <div className="mt-3 flex flex-col sm:grid sm:grid-cols-12 gap-2">
                        <input
                            type="text"
                            aria-label="Nom du nouvel utilisateur"
                            value={newUserName}
                            onChange={(e) => setNewUserName(e.target.value)}
                            className="w-full sm:col-span-3 rounded-xl border border-[rgba(var(--overlay-rgb),0.15)] bg-[rgba(var(--overlay-rgb),0.05)] px-3 py-2 text-theme-primary placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            placeholder="Nom complet"
                        />
                        <input
                            type="email"
                            aria-label="Email du nouvel utilisateur"
                            value={newUserEmail}
                            onChange={(e) => setNewUserEmail(e.target.value)}
                            className="w-full sm:col-span-4 rounded-xl border border-[rgba(var(--overlay-rgb),0.15)] bg-[rgba(var(--overlay-rgb),0.05)] px-3 py-2 text-theme-primary placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            placeholder="email@exemple.com"
                        />
                        <div className="relative w-full sm:col-span-3">
                            <input
                                type={showNewUserPassword ? "text" : "password"}
                                aria-label="Mot de passe initial"
                                autoComplete="new-password"
                                value={newUserPassword}
                                onChange={(e) => setNewUserPassword(e.target.value)}
                                className="w-full rounded-xl border border-[rgba(var(--overlay-rgb),0.15)] bg-[rgba(var(--overlay-rgb),0.05)] py-2 pl-3 pr-10 text-theme-primary placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                placeholder={`Mot de passe (${MIN_PASSWORD_LENGTH} car. min.)`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowNewUserPassword(v => !v)}
                                aria-label={showNewUserPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                                className="absolute inset-y-0 right-2 flex items-center text-theme-muted transition hover:text-theme-primary"
                            >
                                {showNewUserPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                        <button
                            onClick={addUser}
                            disabled={creating}
                            className="w-full sm:col-span-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-3 py-2 text-sm font-semibold text-slate-900 transition hover:brightness-110 disabled:opacity-50"
                        >
                            {creating ? "Création..." : "Ajouter"}
                        </button>
                    </div>
                ) : (
                    <p className="mt-2 text-sm text-theme-muted">
                        Seuls les administrateurs peuvent ajouter des utilisateurs.
                    </p>
                )}
            </div>

            {/* L'ajout est persisté par le serveur ; la modification et la suppression passent
                par setUsers (local) et le poll 10s de fetchUsers peut les écraser peu après. */}
            <p className="mt-6 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                ⚠️ La modification et la suppression d'utilisateurs restent locales et peuvent ne pas persister — fonctionnalité en cours de finalisation.
            </p>

            {/* Boutons d'action */}
            <div className="mt-4 flex justify-end gap-2">
                <button
                    onClick={onClose}
                    className="rounded-2xl border border-[rgba(var(--overlay-rgb),0.2)] px-4 py-2 text-theme-primary transition hover:bg-[rgba(var(--color-primary-rgb),0.6)]"
                >
                    Annuler
                </button>
                <button
                    onClick={save}
                    className="rounded-2xl bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-500 px-5 py-2 font-semibold text-slate-900 shadow-lg shadow-emerald-500/20"
                >
                    Enregistrer
                </button>
            </div>
        </GlassModal>
    );
}
```

- [ ] **Step 4: Vérifier**

Run: `npm run test -- --run src/components/settings/UsersPanel.test.tsx` puis `npx tsc -b`
Expected: 7 tests PASS, aucune erreur de typage.

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/UsersPanel.tsx src/components/settings/UsersPanel.test.tsx
git commit -m "feat: créer un utilisateur sur le serveur depuis Gestion des utilisateurs

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Écran de login « Autre compte » avec mémorisation, puis vérification finale

**Files:**
- Modify: `src/components/LoginModal.tsx`
- Test: `src/components/LoginModal.test.tsx`

**Interfaces:**
- Consumes: `login(email, password): Promise<{ token: string; user: { id: string; email: string; name: string; role: string } }>`, `saveToken(userId, token)`, `ApiError` de `src/services/api.ts` ; actions store `setAuthToken`, `setCurrentUser`, `setLocalAuthUserId`, `setAuthError`.
- Produces: clé `localStorage` `todox_extra_login_accounts` = `Array<{ id: string; name: string; email: string }>`.

- [ ] **Step 1: Écrire les tests (échec attendu)**

Dans `src/components/LoginModal.test.tsx`, remplacer le `beforeEach` par :

```tsx
  beforeEach(() => {
    localStorage.removeItem('todox_extra_login_accounts');
    localStorage.removeItem('last_login_user_id');
    useStore.setState({ users: [ALICE], currentUser: null, localAuthUserId: null, authToken: null, authStatus: 'idle', authError: null });
    vi.mocked(api.getToken).mockResolvedValue(null);
    vi.mocked(api.login).mockReset();
    vi.mocked(api.apiGet).mockReset();
  });
```

Puis ajouter, avant la `});` finale du `describe`, ces tests :

```tsx
  describe('compte absent de la liste (« Autre compte »)', () => {
    const NEW_LOGIN = { token: 'tok-new', user: { id: 'new-uuid', email: 'nouveau@test.com', name: 'Nouveau Membre', role: 'member' } };

    function loginViaOtherAccount(email = 'Nouveau@Test.com', password = 'motdepasse1') {
      fireEvent.click(screen.getByText("Mon nom n'est pas dans la liste"));
      fireEvent.change(screen.getByPlaceholderText('email@exemple.com'), { target: { value: email } });
      fireEvent.change(screen.getByPlaceholderText('Mot de passe'), { target: { value: password } });
      fireEvent.click(screen.getByText('Se connecter'));
    }

    it("connecte le compte par email et l'indexe par l'id serveur", async () => {
      vi.mocked(api.login).mockResolvedValue(NEW_LOGIN);
      render(<LoginModal />);

      loginViaOtherAccount();

      await waitFor(() => expect(useStore.getState().currentUser).toBe('new-uuid'));
      expect(api.login).toHaveBeenCalledWith('nouveau@test.com', 'motdepasse1');
      expect(api.saveToken).toHaveBeenCalledWith('new-uuid', 'tok-new');
      expect(useStore.getState().authToken).toBe('tok-new');
      expect(useStore.getState().localAuthUserId).toBe('new-uuid');
    });

    it('affiche le message du serveur sur un mauvais mot de passe', async () => {
      vi.mocked(api.login).mockRejectedValue(new api.ApiError(401, 'Email ou mot de passe incorrect'));
      render(<LoginModal />);

      loginViaOtherAccount();

      await waitFor(() => expect(screen.getByText('Email ou mot de passe incorrect')).toBeInTheDocument());
      expect(useStore.getState().currentUser).toBeNull();
    });

    it('mémorise le compte et le propose dans la liste au lancement suivant', async () => {
      vi.mocked(api.login).mockResolvedValue(NEW_LOGIN);
      const first = render(<LoginModal />);
      loginViaOtherAccount();
      await waitFor(() => expect(useStore.getState().currentUser).toBe('new-uuid'));
      first.unmount();

      useStore.setState({ currentUser: null, authToken: null, localAuthUserId: null });
      render(<LoginModal />);

      expect(screen.getByText('Nouveau Membre')).toBeInTheDocument();
    });

    it("n'affiche jamais en double un compte mémorisé dont l'email est déjà dans la liste", () => {
      localStorage.setItem('todox_extra_login_accounts', JSON.stringify([{ id: 'other-uuid', name: 'Alice Dupont', email: 'ALICE@test.com' }]));
      render(<LoginModal />);

      expect(screen.getAllByText('Alice Dupont')).toHaveLength(1);
    });

    it('affiche quand même la liste si le stockage des comptes mémorisés est corrompu', () => {
      localStorage.setItem('todox_extra_login_accounts', '{pas du json');
      render(<LoginModal />);

      expect(screen.getByText('Alice Dupont')).toBeInTheDocument();
    });
  });
```

- [ ] **Step 2: Lancer les tests, vérifier qu'ils échouent**

Run: `npm run test -- --run src/components/LoginModal.test.tsx`
Expected: les 5 nouveaux tests FAIL (`Unable to find an element with the text: Mon nom n'est pas dans la liste`), les 5 anciens PASS.

- [ ] **Step 3: Implémenter dans `LoginModal.tsx`**

(a) Après la fonction `getUserInitials` (avant `export function LoginModal()`), ajouter :

```tsx
const EXTRA_ACCOUNTS_KEY = 'todox_extra_login_accounts';

interface ExtraAccount {
  id: string;
  name: string;
  email: string;
}

// La liste `users` du store n'est pas persistée (elle repart de FIXED_USERS à chaque lancement) :
// on mémorise ici les comptes connectés via « Autre compte » pour qu'ils restent sélectionnables.
function readExtraAccounts(): ExtraAccount[] {
  try {
    const raw = JSON.parse(localStorage.getItem(EXTRA_ACCOUNTS_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter(a => a && typeof a.id === 'string' && typeof a.name === 'string' && typeof a.email === 'string');
  } catch {
    return [];
  }
}

function rememberExtraAccount(account: ExtraAccount) {
  try {
    const others = readExtraAccounts().filter(a => a.id !== account.id);
    localStorage.setItem(EXTRA_ACCOUNTS_KEY, JSON.stringify([...others, account]));
  } catch {
    /* stockage indisponible : le compte ne sera simplement pas mémorisé */
  }
}
```

(b) Juste après `const [submitting, setSubmitting] = useState(false);`, ajouter :

```tsx
  const [showOtherAccount, setShowOtherAccount] = useState(false);
  const [otherEmail, setOtherEmail] = useState('');
  const [extraAccounts] = useState(readExtraAccounts);
```

(c) Remplacer le bloc `const realUsers = (() => { ... })();` par :

```tsx
  const realUsers = (() => {
    const listed = users.filter(u => u.id !== "unassigned");
    const listedIds = new Set(listed.map(u => u.id));
    const listedEmails = new Set(listed.map(u => u.email.toLowerCase()));
    const extras = extraAccounts.filter(a => !listedIds.has(a.id) && !listedEmails.has(a.email.toLowerCase()));
    const filtered = [...listed, ...extras];
    if (!lastUsedId) return filtered;
    const last = filtered.find(u => u.id === lastUsedId);
    if (!last) return filtered;
    return [last, ...filtered.filter(u => u.id !== lastUsedId)];
  })();
```

(d) Juste avant la ligne `if (pendingUserId) {`, ajouter le gestionnaire puis la vue :

```tsx
  async function handleSubmitOtherAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!otherEmail.trim() || !password) return;

    setSubmitting(true);
    setAuthError(null);
    try {
      const { token, user: backendUser } = await login(otherEmail.trim().toLowerCase(), password);
      // Compte absent de FIXED_USERS : pas d'id local, le token est indexé par l'UUID serveur.
      await saveToken(backendUser.id, token);
      rememberExtraAccount({ id: backendUser.id, name: backendUser.name, email: backendUser.email });
      localStorage.setItem('last_login_user_id', backendUser.id);
      setAuthToken(token);
      setCurrentUser(backendUser.id);
      setLocalAuthUserId(backendUser.id);
      setShowOtherAccount(false);
      setOtherEmail('');
      setPassword('');
    } catch (e) {
      setAuthError(e instanceof ApiError ? e.message : 'Erreur de connexion au serveur');
    } finally {
      setSubmitting(false);
    }
  }

  if (showOtherAccount) {
    return (
      <GlassModal isOpen={true} onClose={() => {}} size="sm" showCloseButton={false} closeOnBackdrop={false}>
        <form onSubmit={handleSubmitOtherAccount} className="text-center">
          <h1 className="text-xl font-bold mb-2">Autre compte</h1>
          <p className="text-theme-muted text-sm mb-6">Connectez-vous avec l'email de votre compte</p>
          <input
            type="email"
            autoFocus
            placeholder="email@exemple.com"
            value={otherEmail}
            onChange={e => setOtherEmail(e.target.value)}
            className="w-full p-3 rounded-xl border mb-3 bg-transparent text-theme-primary"
            style={{ borderColor: 'var(--border-primary)' }}
          />
          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full p-3 rounded-xl border mb-3 bg-transparent text-theme-primary"
            style={{ borderColor: 'var(--border-primary)' }}
          />
          {authError && <p className="text-red-400 text-xs mb-3">{authError}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setShowOtherAccount(false); setOtherEmail(''); setPassword(''); setAuthError(null); }}
              className="flex-1 p-2.5 rounded-xl border text-theme-secondary"
            >
              Retour
            </button>
            <button
              type="submit"
              disabled={submitting || !otherEmail.trim() || !password}
              className="flex-1 p-2.5 rounded-xl text-white font-semibold disabled:opacity-50"
              style={{ backgroundColor: primary }}
            >
              Se connecter
            </button>
          </div>
        </form>
      </GlassModal>
    );
  }
```

(e) Dans le rendu de la liste, remplacer la fin du bloc « Aucun utilisateur disponible » :

```tsx
              <span className="text-xs opacity-60">Contactez l'administrateur.</span>
            </p>
          </div>
        )}
      </div>
```

par :

```tsx
              <span className="text-xs opacity-60">Contactez l'administrateur.</span>
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={() => { setAuthError(null); setShowOtherAccount(true); }}
          className="mt-4 w-full text-center text-xs text-theme-muted underline transition-colors hover:text-theme-primary"
        >
          Mon nom n'est pas dans la liste
        </button>
      </div>
```

- [ ] **Step 4: Vérifier les tests du login**

Run: `npm run test -- --run src/components/LoginModal.test.tsx`
Expected: 10 tests PASS.

- [ ] **Step 5: Vérification finale de tout le lot**

Run, dans l'ordre :
- `npx tsc -b` → aucune erreur
- `npm run test -- --run` → tous les tests passent (167 avant ce lot, plus les nouveaux)
- `npx eslint src/components/LoginModal.tsx src/components/settings/UsersPanel.tsx src/store/useStore.ts src/constants.ts` → aucune erreur nouvelle
- `npm run build` → build propre

- [ ] **Step 6: Commit**

```bash
git add src/components/LoginModal.tsx src/components/LoginModal.test.tsx
git commit -m "feat: connexion par email pour un compte absent de la liste, avec mémorisation

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
