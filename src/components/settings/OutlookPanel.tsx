/**
 * 📅 PANNEAU INTÉGRATION OUTLOOK / ICS
 * Synchronisation bidirectionnelle via fichiers ICS (sans API Microsoft)
 */

import { useState } from 'react';
import {
    Calendar, Link, RefreshCw, Upload, Copy, CheckCircle,
    AlertCircle, Info, Power, ExternalLink,
} from 'lucide-react';
import { GlassModal } from '../ui/GlassModal';
import useStore from '../../store/useStore';
import { useTheme } from '../../hooks/useTheme';

interface OutlookPanelProps {
    onClose: () => void;
    onSyncNow: () => void;
    icsExportPath: string | null;
    icsServerUrl: string | null;
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
    return (
        <button
            onClick={onChange}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${checked ? 'bg-indigo-500' : 'bg-white/20'}`}
            role="switch"
            aria-checked={checked}
        >
            <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`}
            />
        </button>
    );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400 my-1">
            <div className="flex-1 h-px bg-white/10" />
            {children}
            <div className="flex-1 h-px bg-white/10" />
        </div>
    );
}

export function OutlookPanel({ onClose, onSyncNow, icsExportPath, icsServerUrl }: OutlookPanelProps) {
    const { outlookConfig, setOutlookConfig, outlookEvents } = useStore();
    const { activeTheme } = useTheme();
    const primaryColor = activeTheme.palette.primary;

    const [urlInput, setUrlInput] = useState(outlookConfig.icsUrl);
    const [copied, setCopied] = useState(false);
    const [copiedUrl, setCopiedUrl] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [urlError, setUrlError] = useState('');

    const isElectron = !!window.electronAPI?.isElectron;

    // Formater l'heure de la dernière sync
    function formatLastSync(ts: number | null): string {
        if (!ts) return 'jamais';
        const diff = Math.floor((Date.now() - ts) / 1000);
        if (diff < 60) return `il y a ${diff}s`;
        if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
        if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
        return new Date(ts).toLocaleDateString('fr-FR');
    }

    function validateUrl(url: string): boolean {
        try {
            const u = new URL(url);
            return u.protocol === 'http:' || u.protocol === 'https:';
        } catch {
            return false;
        }
    }

    function handleUrlSave() {
        const trimmed = urlInput.trim();
        if (trimmed && !validateUrl(trimmed)) {
            setUrlError('URL invalide — doit commencer par http:// ou https://');
            return;
        }
        setUrlError('');
        setOutlookConfig({ icsUrl: trimmed });
    }

    async function handleSyncNow() {
        setSyncing(true);
        try {
            await onSyncNow();
        } finally {
            setSyncing(false);
        }
    }

    async function handleCopyPath() {
        if (!icsExportPath) return;
        await navigator.clipboard.writeText(icsExportPath);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    async function handleCopyServerUrl() {
        if (!icsServerUrl) return;
        await navigator.clipboard.writeText(icsServerUrl);
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2000);
    }

    function handleOpenInOutlook() {
        if (!icsExportPath) return;
        const fileUrl = `file:///${icsExportPath.replace(/\\/g, '/')}`;
        window.electronAPI?.openExternalUrl(fileUrl);
    }

    return (
        <GlassModal
            isOpen={true}
            onClose={onClose}
            title={
                <>
                    <Calendar className="w-6 h-6 mr-2" style={{ color: primaryColor }} />
                    Intégration Outlook
                    <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        bêta
                    </span>
                    <span className="ml-2 text-[11px] text-amber-400/80 font-normal italic">— activation déconseillée, fonctionnalité non encore fiabilisée</span>
                </>
            }
            size="xl"
        >
            <div className="space-y-5">

                {/* Activation globale */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-theme-primary">
                    <div className="flex items-center gap-3">
                        <Power className="w-5 h-5 text-indigo-400" />
                        <div>
                            <div className="font-semibold text-white">Activer la synchronisation</div>
                            <div className="text-xs text-slate-400">Importe les événements Outlook dans la Timeline</div>
                        </div>
                    </div>
                    <ToggleSwitch
                        checked={outlookConfig.enabled}
                        onChange={() => setOutlookConfig({ enabled: !outlookConfig.enabled })}
                    />
                </div>

                {/* ── IMPORT Outlook → To-DoX ── */}
                <SectionTitle><Link className="w-3.5 h-3.5" /> Importer depuis Outlook</SectionTitle>

                <div className="space-y-3 rounded-xl bg-white/5 border border-white/10 p-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">
                            URL ICS publiée
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="url"
                                value={urlInput}
                                onChange={e => { setUrlInput(e.target.value); setUrlError(''); }}
                                onBlur={handleUrlSave}
                                placeholder="https://outlook.office365.com/owa/calendar/..."
                                className="flex-1 rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-400 focus:bg-white/15 transition"
                            />
                        </div>
                        {urlError && (
                            <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" />{urlError}
                            </p>
                        )}
                    </div>

                    {/* Info comment obtenir l'URL */}
                    <div className="flex gap-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 p-3 text-xs text-indigo-300">
                        <Info className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                            Outlook → <strong>Calendrier</strong> → <strong>Partager</strong> →{' '}
                            <strong>Publier ce calendrier</strong> → copier l'URL ICS
                        </div>
                    </div>

                    {/* Bouton sync + état */}
                    <div className="flex items-center justify-between">
                        <button
                            onClick={handleSyncNow}
                            disabled={!outlookConfig.enabled || !outlookConfig.icsUrl || syncing}
                            className="flex items-center gap-2 rounded-lg bg-indigo-500/20 border border-indigo-500/40 px-3 py-2 text-sm text-indigo-300 hover:bg-indigo-500/30 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                            Synchroniser maintenant
                        </button>

                        <div className="text-xs text-slate-400 text-right">
                            {outlookConfig.lastSync && (
                                <div className="flex items-center gap-1 text-emerald-400">
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    {formatLastSync(outlookConfig.lastSync)}
                                    {outlookEvents.length > 0 && ` — ${outlookEvents.length} événement${outlookEvents.length > 1 ? 's' : ''}`}
                                </div>
                            )}
                            {!outlookConfig.lastSync && (
                                <span className="text-slate-500">Pas encore synchronisé</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── EXPORT To-DoX → Outlook ── */}
                <SectionTitle><Upload className="w-3.5 h-3.5" /> Exporter vers Outlook</SectionTitle>

                <div className="space-y-3 rounded-xl bg-white/5 border border-white/10 p-4">
                    {!isElectron && (
                        <div className="flex gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-300">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            L'export de fichier est disponible uniquement en mode Electron (application desktop).
                        </div>
                    )}

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Upload className="w-5 h-5 text-indigo-400" />
                            <div>
                                <div className="font-semibold text-white text-sm">Exporter les tâches avec échéances</div>
                                <div className="text-xs text-slate-400">
                                    Génère <code className="font-mono text-indigo-300">todox-tasks.ics</code> à côté de vos données
                                </div>
                            </div>
                        </div>
                        <ToggleSwitch
                            checked={outlookConfig.exportEnabled}
                            onChange={() => setOutlookConfig({ exportEnabled: !outlookConfig.exportEnabled })}
                        />
                    </div>

                    {/* URL d'abonnement live */}
                    {outlookConfig.exportEnabled && icsServerUrl && (
                        <div className="space-y-2 rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-3">
                            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                URL d'abonnement live (recommandé)
                            </div>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 rounded-lg bg-black/30 border border-emerald-500/30 px-3 py-2 text-xs font-mono text-emerald-300 truncate">
                                    {icsServerUrl}
                                </code>
                                <button
                                    onClick={handleCopyServerUrl}
                                    className="shrink-0 flex items-center gap-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-3 py-2 text-xs text-emerald-300 hover:bg-emerald-500/30 transition"
                                    title="Copier l'URL"
                                >
                                    {copiedUrl ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                    {copiedUrl ? 'Copié !' : 'Copier'}
                                </button>
                            </div>
                            <div className="flex gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-300">
                                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                                <div>
                                    Dans Outlook : <strong>Calendrier</strong> →{' '}
                                    <strong>Ajouter un calendrier</strong> →{' '}
                                    <strong>Depuis Internet</strong> → coller l'URL ci-dessus.
                                    Outlook se rafraîchira automatiquement.
                                </div>
                            </div>
                        </div>
                    )}

                    {outlookConfig.exportEnabled && icsExportPath && (
                        <div className="space-y-2">
                            <div className="text-xs text-slate-400 font-medium">Fichier généré :</div>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-xs font-mono text-slate-300 truncate">
                                    {icsExportPath}
                                </code>
                                <button
                                    onClick={handleCopyPath}
                                    className="shrink-0 flex items-center gap-1.5 rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-xs text-slate-300 hover:bg-white/15 transition"
                                    title="Copier le chemin Windows"
                                >
                                    {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                    {copied ? 'Copié !' : 'Copier'}
                                </button>
                            </div>

                            {/* Bouton ouvrir dans Outlook */}
                            {isElectron && (
                                <button
                                    onClick={handleOpenInOutlook}
                                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-500/20 border border-indigo-500/40 px-3 py-2 text-sm text-indigo-300 hover:bg-indigo-500/30 transition"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    Ouvrir dans Outlook (import direct)
                                </button>
                            )}

                            <div className="flex gap-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 p-3 text-xs text-indigo-300">
                                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                                <div>
                                    Cliquez <strong>Ouvrir dans Outlook</strong> ci-dessus, ou{' '}
                                    double-cliquez le fichier .ics dans l'explorateur.{' '}
                                    Dans Outlook : <strong>Fichier</strong> →{' '}
                                    <strong>Ouvrir et exporter</strong> →{' '}
                                    <strong>Importer/Exporter</strong> →{' '}
                                    <strong>Importer un calendrier iCalendar</strong>.
                                </div>
                            </div>
                        </div>
                    )}

                    {outlookConfig.exportEnabled && !icsExportPath && isElectron && (
                        <div className="text-xs text-slate-500 italic">
                            Chemin résolu au prochain lancement…
                        </div>
                    )}
                </div>

            </div>
        </GlassModal>
    );
}
