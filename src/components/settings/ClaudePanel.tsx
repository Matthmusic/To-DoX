/**
 * 🤖 INTÉGRATION CLAUDE DESKTOP
 * Assistant de premier démarrage + panneau de réglages : connecte le serveur MCP
 * embarqué dans To-DoX à Claude Desktop (voir claude-integration.js).
 */

import { useCallback, useEffect, useState } from 'react';
import { Bot, CheckCircle, AlertCircle, Copy, Link2, Power, RefreshCw, MessageSquare, ExternalLink } from 'lucide-react';
import { GlassModal } from '../ui/GlassModal';
import useStore from '../../store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { useTheme } from '../../hooks/useTheme';
import { getApiBaseUrl } from '../../services/api';
import type { ClaudeIntegrationStatus } from '../../types';

/** Clé localStorage : l'assistant ne s'ouvre automatiquement qu'une fois par poste */
export const CLAUDE_ONBOARDING_KEY = 'todox_claude_onboarding_seen';

const TEST_PROMPTS = [
    "Qu'est-ce que j'ai à faire cette semaine dans To-DoX ?",
    "Crée une tâche « Relire le CCTP » sur le projet DIVERS pour vendredi",
    "Remplis ma feuille d'heures de la semaine dernière à partir de mon activité dans To-DoX, montre-moi la proposition avant d'enregistrer",
];

function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children: React.ReactNode }) {
    const { activeTheme } = useTheme();
    return (
        <div className="flex gap-3 rounded-xl border border-[rgba(var(--overlay-rgb),0.1)] bg-[rgba(var(--overlay-rgb),0.05)] p-4">
            <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                style={{ backgroundColor: done ? 'rgb(16 185 129 / 0.2)' : `${activeTheme.palette.primary}33`, color: done ? 'rgb(52 211 153)' : activeTheme.palette.primary }}
            >
                {done ? <CheckCircle className="h-4 w-4" /> : n}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
                <div className="font-semibold text-theme-primary">{title}</div>
                <div className="space-y-2 text-sm text-slate-400">{children}</div>
            </div>
        </div>
    );
}

export function ClaudePanel({ onClose }: { onClose: () => void }) {
    const { authToken, localAuthUserId } = useStore(useShallow((s) => ({ authToken: s.authToken, localAuthUserId: s.localAuthUserId })));
    const { activeTheme } = useTheme();
    const claude = window.electronAPI?.claude;

    const [status, setStatus] = useState<ClaudeIntegrationStatus | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState<number | null>(null);

    const refresh = useCallback(async () => {
        if (claude) setStatus(await claude.status());
    }, [claude]);

    useEffect(() => { void refresh(); }, [refresh]);

    const handleClose = () => {
        try { localStorage.setItem(CLAUDE_ONBOARDING_KEY, '1'); } catch { /* stockage indisponible */ }
        onClose();
    };

    async function handleConnect() {
        if (!claude) return;
        setBusy(true);
        setError(null);
        const session = authToken ? { apiUrl: getApiBaseUrl(), token: authToken, userId: localAuthUserId } : null;
        const res = await claude.install(session);
        if (!res.success) setError(res.error ?? 'Échec de la connexion à Claude');
        await refresh();
        setBusy(false);
    }

    async function handleDisconnect() {
        if (!claude) return;
        setBusy(true);
        const res = await claude.uninstall();
        if (!res.success) setError(res.error ?? 'Échec de la désactivation');
        await refresh();
        setBusy(false);
    }

    async function handleCopy(i: number) {
        await navigator.clipboard.writeText(TEST_PROMPTS[i]);
        setCopied(i);
        setTimeout(() => setCopied(null), 2000);
    }

    const connected = Boolean(status?.enabled && status.configured);
    const isMac = navigator.userAgent.includes('Mac');

    return (
        <GlassModal
            isOpen={true}
            onClose={handleClose}
            title={<><Bot className="mr-2 h-6 w-6" style={{ color: activeTheme.palette.primary }} />Utiliser To-DoX avec Claude</>}
            size="md"
        >
            <div className="space-y-4">
                <p className="text-sm text-slate-300">
                    Connecte To-DoX à l'application <strong>Claude</strong> pour lui demander, en langage naturel, de consulter ton Kanban,
                    créer ou déplacer des tâches, gérer les révisions et <strong>remplir tes feuilles d'heures</strong>.
                </p>

                {!claude && (
                    <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        Disponible uniquement dans l'application de bureau To-DoX.
                    </div>
                )}

                {status && !status.claudeDetected && (
                    <div className="flex gap-2 rounded-lg border border-indigo-500/20 bg-indigo-500/10 p-3 text-xs text-indigo-300">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <div>
                            Claude Desktop ne semble pas installé sur ce poste.{' '}
                            <button className="inline-flex items-center gap-1 underline" onClick={() => window.electronAPI?.openExternalUrl('https://claude.ai/download')}>
                                Télécharger Claude <ExternalLink className="h-3 w-3" />
                            </button>{' '}
                            — tu peux quand même connecter To-DoX maintenant.
                        </div>
                    </div>
                )}

                {status && !status.bundleFound && (
                    <div className="flex gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        Serveur MCP absent de cette installation (en développement : <code>npm run build:mcp</code>).
                    </div>
                )}

                <Step n={1} title="Connecter To-DoX à Claude" done={connected}>
                    <p>Ajoute To-DoX à la configuration de Claude. Aucun mot de passe n'est enregistré : Claude utilise ta session To-DoX.</p>
                    <div className="flex flex-wrap items-center gap-2">
                        {connected ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-400"><CheckCircle className="h-4 w-4" />To-DoX est connecté à Claude</span>
                        ) : (
                            <button
                                onClick={handleConnect}
                                disabled={!claude || busy || status?.bundleFound === false}
                                className="inline-flex items-center gap-2 rounded-lg border border-indigo-500/40 bg-indigo-500/20 px-3 py-2 text-sm text-indigo-200 transition hover:bg-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                                Connecter Claude
                            </button>
                        )}
                    </div>
                    {error && <p className="flex items-center gap-1 text-xs text-red-400"><AlertCircle className="h-3.5 w-3.5" />{error}</p>}
                </Step>

                <Step n={2} title="Fermer complètement Claude">
                    {isMac ? (
                        <p>Dans Claude, menu <strong>Claude → Quitter Claude</strong> (⌘Q). Fermer la fenêtre ne suffit pas.</p>
                    ) : (
                        <p>
                            Clic droit sur l'icône Claude dans la zone de notification (en bas à droite, près de l'horloge, parfois derrière la flèche ^) →{' '}
                            <strong>Quitter</strong>. Fermer la fenêtre avec la croix ne suffit pas : Claude reste ouvert en arrière-plan.
                        </p>
                    )}
                </Step>

                <Step n={3} title="Rouvrir Claude">
                    <p>Relance Claude. Garde To-DoX ouvert et connecté pendant le test.</p>
                </Step>

                <Step n={4} title="Faire un test">
                    <p>Dans une nouvelle conversation Claude, essaie par exemple :</p>
                    <div className="space-y-1.5">
                        {TEST_PROMPTS.map((prompt, i) => (
                            <button
                                key={prompt}
                                onClick={() => handleCopy(i)}
                                title="Copier"
                                className="flex w-full items-start gap-2 rounded-lg border border-[rgba(var(--overlay-rgb),0.15)] bg-[rgba(var(--overlay-rgb),0.05)] px-3 py-2 text-left text-xs text-theme-primary transition hover:bg-[rgba(var(--overlay-rgb),0.1)]"
                            >
                                <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                                <span className="flex-1">{prompt}</span>
                                {copied === i ? <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 shrink-0 text-slate-500" />}
                            </button>
                        ))}
                    </div>
                    <p className="text-xs">
                        Au premier usage, Claude demande l'autorisation d'utiliser les outils « todox » : clique sur <strong>Autoriser</strong>.
                        Si rien ne se passe, vérifie que « todox » apparaît dans le menu des connecteurs de Claude (icône ⚙ / « + » sous la zone de saisie).
                    </p>
                </Step>

                <div className="flex items-center justify-between pt-1">
                    {status?.enabled ? (
                        <button onClick={handleDisconnect} disabled={busy} className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-rose-300 disabled:opacity-40">
                            <Power className="h-3.5 w-3.5" />Déconnecter To-DoX de Claude
                        </button>
                    ) : <span />}
                    <button
                        onClick={handleClose}
                        className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                        style={{ backgroundColor: activeTheme.palette.primary }}
                    >
                        {connected ? 'Terminé' : 'Plus tard'}
                    </button>
                </div>
            </div>
        </GlassModal>
    );
}
