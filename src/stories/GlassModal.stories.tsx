import type { Meta, StoryObj } from '@storybook/react';
import { GlassModal, GlassPanel, GlassCard } from '../components/ui/GlassModal';

const meta: Meta = {
  title: 'UI/GlassModal',
  parameters: { layout: 'fullscreen' },
};

export default meta;

export const ModalDefault: StoryObj = {
  name: 'GlassModal – taille md',
  render: () => (
    <GlassModal isOpen onClose={() => {}} title="Titre de la modale glass" size="md">
      <p className="text-theme-secondary text-sm">Contenu avec effet glassmorphism.</p>
    </GlassModal>
  ),
};

export const ModalLarge: StoryObj = {
  name: 'GlassModal – taille lg',
  render: () => (
    <GlassModal isOpen onClose={() => {}} title="Modale large" size="lg">
      <div className="space-y-2">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="rounded-lg bg-white/5 p-3 text-theme-secondary text-sm">
            Ligne {i + 1}
          </div>
        ))}
      </div>
    </GlassModal>
  ),
};

export const ModalSmall: StoryObj = {
  name: 'GlassModal – taille sm',
  render: () => (
    <GlassModal isOpen onClose={() => {}} title="Confirmation" size="sm">
      <p className="text-theme-secondary text-sm">Êtes-vous sûr de vouloir supprimer cette tâche ?</p>
      <div className="flex gap-2 mt-4 justify-end">
        <button className="rounded-lg bg-white/10 px-4 py-2 text-sm text-theme-secondary">Annuler</button>
        <button className="rounded-lg bg-red-500/20 px-4 py-2 text-sm text-red-300 border border-red-500/30">Supprimer</button>
      </div>
    </GlassModal>
  ),
};

export const Panels: StoryObj = {
  name: 'GlassPanel – variantes glow',
  render: () => (
    <div className="p-8 grid grid-cols-2 gap-4">
      <GlassPanel glow="cyan">
        <p className="text-theme-secondary text-sm font-medium mb-1">Glow Cyan</p>
        <p className="text-theme-muted text-xs">Panneau avec glow cyan</p>
      </GlassPanel>
      <GlassPanel glow="purple">
        <p className="text-theme-secondary text-sm font-medium mb-1">Glow Purple</p>
        <p className="text-theme-muted text-xs">Panneau avec glow violet</p>
      </GlassPanel>
      <GlassPanel glow="amber">
        <p className="text-theme-secondary text-sm font-medium mb-1">Glow Amber</p>
        <p className="text-theme-muted text-xs">Panneau avec glow orange</p>
      </GlassPanel>
      <GlassPanel glow="emerald">
        <p className="text-theme-secondary text-sm font-medium mb-1">Glow Emerald</p>
        <p className="text-theme-muted text-xs">Panneau avec glow vert</p>
      </GlassPanel>
    </div>
  ),
};

export const Cards: StoryObj = {
  name: 'GlassCard – hoverable vs statique',
  render: () => (
    <div className="p-8 grid grid-cols-2 gap-4">
      <GlassCard hoverable onClick={() => {}}>
        <p className="text-theme-secondary text-sm font-medium">Carte hoverable</p>
        <p className="text-theme-muted text-xs mt-1">Survole pour voir l'effet</p>
      </GlassCard>
      <GlassCard>
        <p className="text-theme-secondary text-sm font-medium">Carte statique</p>
        <p className="text-theme-muted text-xs mt-1">Pas d'interaction hover</p>
      </GlassCard>
    </div>
  ),
};
