import type { Meta, StoryObj } from '@storybook/react';
import useStore from '../store/useStore';

/**
 * TitleBar est exclusivement affiché dans le contexte Electron
 * (retourne `null` si `window.electronAPI?.isElectron` est falsy).
 *
 * Ces stories simulent visuellement la barre de titre telle qu'elle
 * apparaît en production, en rendant directement le markup équivalent.
 *
 * Pour tester le composant réel, lancez l'app avec `npm run dev:electron`.
 */

const meta: Meta = {
  title: 'Components/TitleBar',
  parameters: { layout: 'fullscreen' },
};

export default meta;

/** Barre simulée — reproduit le rendu Electron sans l'API native */
function MockTitleBar({
  unreadCount = 0,
  currentUserInitials = 'MM',
  showVipTabs = false,
}: {
  unreadCount?: number;
  currentUserInitials?: string;
  showVipTabs?: boolean;
}) {
  return (
    <div className="flex h-8 items-center justify-between select-none bg-[#0d1117] border-b border-white/10 px-0">
      {/* Gauche : logo + profil + onglets VIP */}
      <div className="flex items-center gap-3 px-3">
        <div className="h-5 w-16 rounded bg-violet-500/30 flex items-center justify-center text-[9px] text-violet-300 font-bold">
          To-DoX
        </div>
        <div className="h-5 w-5 rounded-full bg-violet-500/30 flex items-center justify-center text-[9px] text-violet-300 font-black">
          {currentUserInitials}
        </div>
        {showVipTabs && (
          <div className="flex items-center gap-1 ml-12">
            {['MM', 'WC', 'MV', 'SM'].map((init, i) => (
              <div
                key={init}
                className={`h-6 px-1.5 flex items-center gap-1 rounded text-[10px] font-semibold ${
                  i === 0
                    ? 'bg-violet-500/30 text-violet-300'
                    : 'text-white/40 hover:bg-white/5'
                }`}
              >
                {init}
                {i === 1 && (
                  <span className="flex h-3 w-3 items-center justify-center rounded-full bg-rose-500 text-[7px] font-bold text-white">
                    2
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Centre : cloche */}
      <div className="flex-1 flex items-center justify-center">
        <div className="relative h-8 w-8 flex items-center justify-center text-white/75">
          <span className="text-sm">🔔</span>
          {unreadCount > 0 && (
            <span className="absolute top-1 right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
      </div>

      {/* Droite : contrôles fenêtre */}
      <div className="flex">
        {['−', '□', '✕'].map((icon, i) => (
          <div
            key={icon}
            className={`h-8 w-12 flex items-center justify-center text-xs text-white/40 ${
              i === 2 ? 'hover:bg-red-600 hover:text-white' : 'hover:bg-white/10'
            }`}
          >
            {icon}
          </div>
        ))}
      </div>
    </div>
  );
}

export const Default: StoryObj = {
  name: 'Barre de titre (simulation visuelle)',
  render: () => {
    useStore.setState({ currentUser: 'matthieu', appNotifications: [] });
    return (
      <div className="bg-slate-900 min-h-screen">
        <MockTitleBar currentUserInitials="MM" />
        <div className="p-8 text-slate-500 text-sm">
          ⚠️ Ce composant ne s'affiche que dans Electron. Cette story est une simulation visuelle.
        </div>
      </div>
    );
  },
};

export const AvecNotifications: StoryObj = {
  name: 'Avec badge notifications (5 non lues)',
  render: () => {
    useStore.setState({ currentUser: 'matthieu' });
    return (
      <div className="bg-slate-900 min-h-screen">
        <MockTitleBar currentUserInitials="MM" unreadCount={5} />
        <div className="p-8 text-slate-500 text-sm">
          ⚠️ Ce composant ne s'affiche que dans Electron. Cette story est une simulation visuelle.
        </div>
      </div>
    );
  },
};

export const AvecOngletVIP: StoryObj = {
  name: 'Mode VIP – onglets utilisateurs multiples',
  render: () => {
    useStore.setState({ currentUser: 'matthieu' });
    return (
      <div className="bg-slate-900 min-h-screen">
        <MockTitleBar currentUserInitials="MM" unreadCount={2} showVipTabs />
        <div className="p-8 text-slate-500 text-sm">
          ⚠️ Ce composant ne s'affiche que dans Electron. Cette story est une simulation visuelle.
          <br />
          Les VIP_USERS voient les onglets de tous les utilisateurs actifs dans la barre de titre.
        </div>
      </div>
    );
  },
};
