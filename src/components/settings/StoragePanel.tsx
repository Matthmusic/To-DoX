import { useState } from "react";
import { HardDrive, Server, MonitorDown, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import useStore from "../../store/useStore";
import { GlassModal } from "../ui/GlassModal";
import { alertModal } from "../../utils/confirm";
import { useTheme } from "../../hooks/useTheme";
import { IS_API_MODE, getApiUrl, setApiUrl, clearApiUrl, clearToken } from "../../api/client";

interface StoragePanelProps {
    onClose: () => void;
}

type StorageMode = 'local' | 'server';

export function StoragePanel({ onClose }: StoragePanelProps) {
    const { storagePath, setStoragePath } = useStore();
    const { activeTheme } = useTheme();
    const primary = activeTheme.palette.primary;

    // ── Mode sélectionné ──────────────────────────────────────────────────────
    const [mode, setMode] = useState<StorageMode>(IS_API_MODE ? 'server' : 'local');
    const [serverUrl, setServerUrl] = useState(getApiUrl() ?? 'http://192.168.1.114:3001');
    const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
    const [testMessage, setTestMessage] = useState('');

    // ── Mode local ────────────────────────────────────────────────────────────
    const [localPath, setLocalPath] = useState(storagePath || "");
    const [changeMessage, setChangeMessage] = useState("");

    async function testConnection(): Promise<boolean> {
        setTestStatus('testing');
        setTestMessage('');
        try {
            const url = serverUrl.replace(/\/$/, '');
            const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(5000) });
            if (res.ok) {
                setTestStatus('ok');
                setTestMessage('Serveur accessible ✓');
                return true;
            } else {
                setTestStatus('error');
                setTestMessage(`Serveur répond ${res.status}`);
                return false;
            }
        } catch {
            setTestStatus('error');
            setTestMessage('Impossible de joindre le serveur');
            return false;
        }
    }

    function applyServerMode() {
        if (!serverUrl.trim()) {
            alertModal("Entrez l'URL du serveur");
            return;
        }
        setApiUrl(serverUrl);
        clearToken();
        setChangeMessage('Mode serveur activé. Redémarrage…');
        setTimeout(() => window.location.reload(), 1200);
    }

    function applyLocalMode() {
        clearApiUrl();
        clearToken();
        setChangeMessage('Mode local activé. Redémarrage…');
        setTimeout(() => window.location.reload(), 1200);
    }

    async function save() {
        if (mode === 'server') {
            if (testStatus !== 'ok') {
                const passed = await testConnection();
                if (!passed) {
                    alertModal("Le serveur n'est pas accessible, vérifiez l'URL");
                    return;
                }
            }
            applyServerMode();
        } else {
            if (IS_API_MODE) {
                applyLocalMode();
            } else {
                // Juste changer le dossier local
                if (!localPath) { alertModal("Veuillez choisir un dossier de stockage"); return; }
                localStorage.setItem('storage_path', localPath);
                setStoragePath(localPath);
                setChangeMessage("⚠️ Chemin modifié. Redémarrez l'application.");
                setTimeout(() => onClose(), 3000);
            }
        }
    }

    async function chooseFolder() {
        if (!window.electronAPI?.chooseStorageFolder) return;
        const result = await window.electronAPI.chooseStorageFolder();
        if (result.success && result.path) setLocalPath(result.path);
    }

    async function openStorageFolder() {
        if (storagePath && window.electronAPI?.openFolder) await window.electronAPI.openFolder(storagePath);
    }

    return (
        <GlassModal isOpen={true} onClose={onClose} title={<><HardDrive className="w-6 h-6 mr-2" style={{ color: primary }} />Configuration du stockage</>} size="xl">
            <div className="mt-4 space-y-5">

                {/* ── Sélecteur de mode ───────────────────────────────────── */}
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-theme-muted opacity-60 mb-3">
                        Mode de stockage
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                        {/* Local */}
                        <button
                            onClick={() => setMode('local')}
                            className="flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all text-left"
                            style={{
                                borderColor: mode === 'local' ? `${primary}80` : 'var(--border-primary)',
                                backgroundColor: mode === 'local' ? `${primary}12` : 'rgba(255,255,255,0.03)',
                            }}
                        >
                            <MonitorDown className="w-6 h-6" style={{ color: mode === 'local' ? primary : 'var(--text-muted)' }} />
                            <div>
                                <div className="font-semibold text-sm text-theme-primary">Local</div>
                                <div className="text-xs text-theme-muted opacity-70">Fichier JSON sur ce PC</div>
                            </div>
                            {mode === 'local' && !IS_API_MODE && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${primary}25`, color: primary }}>
                                    Actif
                                </span>
                            )}
                        </button>

                        {/* Serveur */}
                        <button
                            onClick={() => setMode('server')}
                            className="flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all text-left"
                            style={{
                                borderColor: mode === 'server' ? `${primary}80` : 'var(--border-primary)',
                                backgroundColor: mode === 'server' ? `${primary}12` : 'rgba(255,255,255,0.03)',
                            }}
                        >
                            <Server className="w-6 h-6" style={{ color: mode === 'server' ? primary : 'var(--text-muted)' }} />
                            <div>
                                <div className="font-semibold text-sm text-theme-primary">Serveur</div>
                                <div className="text-xs text-theme-muted opacity-70">Backend REST partagé</div>
                            </div>
                            {IS_API_MODE && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${primary}25`, color: primary }}>
                                    Actif
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* ── Config serveur ──────────────────────────────────────── */}
                {mode === 'server' && (
                    <div className="space-y-3 rounded-2xl border p-4" style={{ borderColor: `${primary}30`, backgroundColor: `${primary}08` }}>
                        <p className="text-xs font-semibold uppercase tracking-wider opacity-60" style={{ color: primary }}>
                            URL du serveur
                        </p>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={serverUrl}
                                onChange={e => { setServerUrl(e.target.value); setTestStatus('idle'); }}
                                className="flex-1 rounded-xl border bg-transparent px-3 py-2 text-sm text-theme-primary focus:outline-none transition-colors"
                                style={{ borderColor: 'var(--border-primary)' }}
                                onFocus={e => { e.currentTarget.style.borderColor = `${primary}80`; }}
                                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-primary)'; }}
                                placeholder="http://192.168.1.114:3001"
                            />
                            <button
                                onClick={testConnection}
                                disabled={testStatus === 'testing'}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm transition-colors disabled:opacity-50"
                                style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
                            >
                                {testStatus === 'testing'
                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                    : testStatus === 'ok'
                                        ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                        : testStatus === 'error'
                                            ? <XCircle className="w-4 h-4 text-rose-400" />
                                            : <Server className="w-4 h-4" />
                                }
                                Tester
                            </button>
                        </div>
                        {testMessage && (
                            <p className={`text-xs ${testStatus === 'ok' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {testMessage}
                            </p>
                        )}
                        <p className="text-xs text-theme-muted opacity-50">
                            Serveur sur ce PC : <code className="rounded bg-white/10 px-1">http://192.168.1.114:3001</code>
                        </p>
                    </div>
                )}

                {/* ── Config locale ───────────────────────────────────────── */}
                {mode === 'local' && (
                    <div className="space-y-3">
                        <div className="rounded-2xl border border-indigo-400/30 bg-indigo-400/5 p-4">
                            <h4 className="text-sm font-semibold text-indigo-200">🗂️ Stockage local</h4>
                            <p className="mt-1 text-xs text-slate-500">
                                Chemin actuel : <code className="rounded bg-white/10 px-2 py-0.5">{storagePath || "Non défini"}</code>
                            </p>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm text-slate-400">Dossier de stockage</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={localPath}
                                    onChange={e => setLocalPath(e.target.value)}
                                    className="flex-1 rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-slate-100 focus:border-transparent focus:outline-none focus:ring-2"
                                    style={{ '--tw-ring-color': primary } as any}
                                    placeholder="Z:\F - UTILITAIRES\TODOX"
                                />
                                <button onClick={chooseFolder} className="rounded-2xl border border-white/20 bg-white/5 px-4 py-2 text-slate-100 transition hover:bg-white/10">
                                    Parcourir…
                                </button>
                            </div>
                        </div>
                        <div className="rounded-2xl border border-rose-400/30 bg-rose-400/5 p-4">
                            <h4 className="text-sm font-semibold text-rose-200">⚠️ Important</h4>
                            <ul className="mt-2 space-y-1 text-xs text-slate-400">
                                <li>• Les sauvegardes automatiques sont dans <code className="rounded bg-white/10 px-1">backups/</code></li>
                                <li>• Les 5 dernières sauvegardes sont conservées</li>
                                <li>• Si OneDrive est en mode "en ligne uniquement", la première ouverture peut être lente</li>
                            </ul>
                        </div>
                    </div>
                )}

                {/* ── Message de confirmation ─────────────────────────────── */}
                {changeMessage && (
                    <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
                        <p className="text-sm text-amber-200">{changeMessage}</p>
                    </div>
                )}
            </div>

            {/* ── Actions ─────────────────────────────────────────────────── */}
            <div className="mt-6 flex justify-between gap-2">
                <button
                    onClick={openStorageFolder}
                    disabled={mode === 'server' || !storagePath}
                    className="rounded-2xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-cyan-100 transition hover:bg-cyan-400/20 disabled:opacity-30"
                >
                    Ouvrir le dossier
                </button>
                <div className="flex gap-2">
                    <button onClick={onClose} className="rounded-2xl border border-white/20 px-4 py-2 text-slate-200 transition hover:bg-white/10">
                        Annuler
                    </button>
                    <button
                        onClick={save}
                        className="rounded-2xl px-5 py-2 font-semibold text-slate-900 shadow-lg"
                        style={{ background: `linear-gradient(to right, ${primary}, ${activeTheme.palette.secondary})` }}
                    >
                        Enregistrer
                    </button>
                </div>
            </div>
        </GlassModal>
    );
}
