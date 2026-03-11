import type { Meta, StoryObj } from '@storybook/react';
import { useRef } from 'react';
import { NotificationDropdown } from '../components/NotificationDropdown';
import useStore from '../store/useStore';

const meta: Meta = {
  title: 'Components/NotificationDropdown',
  parameters: { layout: 'fullscreen' },
};

export default meta;

// Ancre fictive centree en haut de la page
function DropdownWrapper({ children }: { children: (ref: React.RefObject<HTMLButtonElement | null>) => React.ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <div className="flex items-start justify-center pt-12 min-h-screen bg-slate-900">
      <button ref={ref} className="text-xs text-white/40 px-3 py-1 border border-white/10 rounded">
        Ancre
      </button>
      {children(ref)}
    </div>
  );
}

const now = Date.now();
const min = 60_000;

export const AvecNotificationsNonLues: StoryObj = {
  name: 'Avec notifications non lues',
  render: () => {
    useStore.setState({
      currentUser: 'matthieu',
      appNotifications: [
        {
          id: 'n-1',
          type: 'review_requested',
          taskId: 'task-3',
          taskTitle: "Audit des performances de l'API REST",
          fromUserId: 'sandro',
          toUserId: 'matthieu',
          message: "Sandro vous demande de reviser Audit des performances",
          createdAt: now - 5 * min,
        },
        {
          id: 'n-2',
          type: 'review_validated',
          taskId: 'task-4',
          taskTitle: 'Deploiement en production v2.0',
          fromUserId: 'william',
          toUserId: 'matthieu',
          message: 'William a valide votre tache Deploiement en production v2.0',
          createdAt: now - 2 * 60 * min,
        },
        {
          id: 'n-3',
          type: 'review_rejected',
          taskId: 'task-1',
          taskTitle: 'Reviser les specs techniques',
          fromUserId: 'laurent',
          toUserId: 'matthieu',
          message: 'Laurent demande des corrections sur Reviser les specs techniques',
          createdAt: now - 24 * 60 * min,
          readAt: now - 20 * 60 * min,
        },
        {
          id: 'n-4',
          type: 'review_stale',
          taskId: 'task-2',
          taskTitle: 'Integrer les retours client',
          fromUserId: 'system',
          toUserId: 'matthieu',
          message: 'Integrer les retours client est en revision depuis plus de 7 jours',
          createdAt: now - 3 * 24 * 60 * min,
          readAt: now - 2 * 24 * 60 * min,
        },
      ],
    });
    return (
      <DropdownWrapper>
        {(ref) => (
          <NotificationDropdown
            onClose={() => {}}
            onTaskClick={() => {}}
            anchorRef={ref as React.RefObject<HTMLElement>}
          />
        )}
      </DropdownWrapper>
    );
  },
};

export const AucuneNotification: StoryObj = {
  name: 'Aucune notification',
  render: () => {
    useStore.setState({
      currentUser: 'matthieu',
      appNotifications: [],
    });
    return (
      <DropdownWrapper>
        {(ref) => (
          <NotificationDropdown
            onClose={() => {}}
            onTaskClick={() => {}}
            anchorRef={ref as React.RefObject<HTMLElement>}
          />
        )}
      </DropdownWrapper>
    );
  },
};

export const ToutesLues: StoryObj = {
  name: 'Toutes les notifications lues',
  render: () => {
    useStore.setState({
      currentUser: 'matthieu',
      appNotifications: [
        {
          id: 'n-5',
          type: 'review_validated',
          taskId: 'task-4',
          taskTitle: 'Deploiement en production v2.0',
          fromUserId: 'william',
          toUserId: 'matthieu',
          message: 'William a valide votre tache Deploiement en production v2.0',
          createdAt: now - 48 * 60 * min,
          readAt: now - 47 * 60 * min,
        },
        {
          id: 'n-6',
          type: 'review_rejected',
          taskId: 'task-1',
          taskTitle: 'Reviser les specs techniques',
          fromUserId: 'sandro',
          toUserId: 'matthieu',
          message: 'Sandro demande des corrections sur Reviser les specs techniques',
          createdAt: now - 5 * 24 * 60 * min,
          readAt: now - 4 * 24 * 60 * min,
        },
      ],
    });
    return (
      <DropdownWrapper>
        {(ref) => (
          <NotificationDropdown
            onClose={() => {}}
            onTaskClick={() => {}}
            anchorRef={ref as React.RefObject<HTMLElement>}
          />
        )}
      </DropdownWrapper>
    );
  },
};
