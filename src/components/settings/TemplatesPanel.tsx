import { useState, type KeyboardEvent } from 'react';
import { LayoutTemplate, Trash2, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import useStore from '../../store/useStore';
import { useTheme } from '../../hooks/useTheme';
import { GlassModal } from '../ui/GlassModal';

interface TemplatesPanelProps {
    onClose: () => void;
}

export function TemplatesPanel({ onClose }: TemplatesPanelProps) {
    const { templates, addTemplate, deleteTemplate } = useStore();
    const { activeTheme } = useTheme();
    const primaryColor = activeTheme.palette.primary;

    // Formulaire de nouveau template
    const [newName, setNewName] = useState('');
    const [newSubtaskInput, setNewSubtaskInput] = useState('');
    const [newSubtasks, setNewSubtasks] = useState<string[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    function handleAddSubtask() {
        const val = newSubtaskInput.trim();
        if (!val) return;
        setNewSubtasks(prev => [...prev, val]);
        setNewSubtaskInput('');
    }

    function handleSubtaskKeyDown(e: KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddSubtask();
        }
    }

    function handleRemoveNewSubtask(idx: number) {
        setNewSubtasks(prev => prev.filter((_, i) => i !== idx));
    }

    function handleSave() {
        const name = newName.trim();
        if (!name || newSubtasks.length === 0) return;
        addTemplate({ name, subtaskTitles: newSubtasks });
        setNewName('');
        setNewSubtasks([]);
        setNewSubtaskInput('');
    }

    return (
        <GlassModal
            isOpen={true}
            onClose={onClose}
            title={<><LayoutTemplate className="w-6 h-6 mr-2" style={{ color: primaryColor }} />Templates de sous-tâches</>}
            size="xl"
        >
            <div className="space-y-6">
                    {/* Liste des templates existants */}
                    <section>
                        <h3 className="text-sm font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                            <LayoutTemplate className="h-4 w-4" />
                            Templates enregistrés
                        </h3>
                        {templates.length === 0 ? (
                            <p className="text-sm text-slate-500 italic">Aucun template pour l'instant.</p>
                        ) : (
                            <div className="space-y-2">
                                {templates.map(tpl => (
                                    <div key={tpl.id} className="rounded-xl border border-white/10 bg-white/5">
                                        <div className="flex items-center justify-between px-4 py-3">
                                            <button
                                                onClick={() => setExpandedId(expandedId === tpl.id ? null : tpl.id)}
                                                className="flex items-center gap-2 flex-1 text-left"
                                            >
                                                {expandedId === tpl.id
                                                    ? <ChevronDown className="h-4 w-4 text-slate-400" />
                                                    : <ChevronRight className="h-4 w-4 text-slate-400" />
                                                }
                                                <span className="font-medium text-white">{tpl.name}</span>
                                                <span className="text-xs text-slate-500">
                                                    {tpl.subtaskTitles.length} sous-tâche{tpl.subtaskTitles.length > 1 ? 's' : ''}
                                                </span>
                                            </button>
                                            <button
                                                onClick={() => deleteTemplate(tpl.id)}
                                                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 transition"
                                                title="Supprimer ce template"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                        {expandedId === tpl.id && (
                                            <div className="px-10 pb-3 space-y-1">
                                                {tpl.subtaskTitles.map((st, i) => (
                                                    <div key={i} className="flex items-center gap-2 text-sm text-slate-300">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                                                        {st}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Formulaire de création */}
                    <section className="border-t border-white/10 pt-6">
                        <h3 className="text-sm font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            Nouveau template
                        </h3>
                        <div className="space-y-4">
                            {/* Nom du template */}
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Nom du template</label>
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    placeholder="Ex: Revue de code, Déploiement..."
                                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-400/50 focus:bg-white/10 transition"
                                />
                            </div>

                            {/* Ajout de sous-tâches */}
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Sous-tâches (Entrée pour ajouter)</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newSubtaskInput}
                                        onChange={e => setNewSubtaskInput(e.target.value)}
                                        onKeyDown={handleSubtaskKeyDown}
                                        placeholder="Titre de la sous-tâche..."
                                        className="flex-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-400/50 focus:bg-white/10 transition"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddSubtask}
                                        disabled={!newSubtaskInput.trim()}
                                        className="px-3 py-2 rounded-xl bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 transition disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        <Plus className="h-4 w-4" />
                                    </button>
                                </div>

                                {/* Chips des sous-tâches ajoutées */}
                                {newSubtasks.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                        {newSubtasks.map((st, idx) => (
                                            <span
                                                key={idx}
                                                className="inline-flex items-center gap-1 rounded-lg bg-violet-500/15 border border-violet-500/30 px-2 py-0.5 text-xs text-violet-200"
                                            >
                                                {st}
                                                <button
                                                    onClick={() => handleRemoveNewSubtask(idx)}
                                                    className="text-violet-400 hover:text-rose-400 transition ml-0.5"
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Bouton créer */}
                            <button
                                onClick={handleSave}
                                disabled={!newName.trim() || newSubtasks.length === 0}
                                className="w-full py-2 rounded-xl font-semibold text-sm transition disabled:opacity-30 disabled:cursor-not-allowed"
                                style={{
                                    background: newName.trim() && newSubtasks.length > 0
                                        ? `linear-gradient(135deg, ${primaryColor}33, #a78bfa33)`
                                        : undefined,
                                    border: `1px solid ${primaryColor}40`,
                                    color: newName.trim() && newSubtasks.length > 0 ? '#e2e8f0' : '#64748b'
                                }}
                            >
                                Créer le template
                            </button>
                        </div>
                    </section>
            </div>
        </GlassModal>
    );
}
