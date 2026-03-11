import type { Meta, StoryObj } from '@storybook/react';
import { TaskComments } from '../components/TaskComments';
import useStore from '../store/useStore';

const now = Date.now();
const min = 60_000;

const mockUsers = [
  { id: 'matthieu', name: 'Matthieu Maurel', email: 'matthieu@test.fr' },
  { id: 'william', name: 'William Cresson', email: 'william@test.fr' },
  { id: 'sandro', name: 'Sandro Menardi', email: 'sandro@test.fr' },
  { id: 'laurent', name: 'Laurent Marques', email: 'laurent@test.fr' },
];

const meta: Meta<typeof TaskComments> = {
  title: 'Components/TaskComments',
  component: TaskComments,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="max-w-lg mx-auto bg-[#0d1117] rounded-2xl p-4 border border-white/10">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof TaskComments>;

export const AvecCommentaires: Story = {
  name: 'Avec commentaires',
  render: () => {
    useStore.setState({
      currentUser: 'matthieu',
      users: mockUsers,
      comments: {
        'task-1': [
          {
            id: 'c-1',
            taskId: 'task-1',
            userId: 'william',
            text: 'J\'ai regardé les specs, il manque la section authentification SSO.',
            createdAt: now - 30 * min,
            deletedAt: null,
          },
          {
            id: 'c-2',
            taskId: 'task-1',
            userId: 'matthieu',
            text: '@William Cresson Bonne remarque, je vais l\'ajouter ce soir.',
            createdAt: now - 15 * min,
            deletedAt: null,
          },
          {
            id: 'c-3',
            taskId: 'task-1',
            userId: 'sandro',
            text: 'Est-ce qu\'on doit intégrer aussi le flow OAuth2 ?',
            createdAt: now - 5 * min,
            deletedAt: null,
          },
        ],
      },
    });
    return <TaskComments taskId="task-1" />;
  },
};

export const AvecMentionDeMoi: Story = {
  name: 'Commentaire avec mention (@moi)',
  render: () => {
    useStore.setState({
      currentUser: 'matthieu',
      users: mockUsers,
      comments: {
        'task-2': [
          {
            id: 'c-4',
            taskId: 'task-2',
            userId: 'william',
            text: '@Matthieu Maurel peux-tu valider ce point avant vendredi ?',
            createdAt: now - 10 * min,
            deletedAt: null,
          },
          {
            id: 'c-5',
            taskId: 'task-2',
            userId: 'sandro',
            text: 'Pareil, @Matthieu Maurel j\'attends ta validation aussi.',
            createdAt: now - 2 * min,
            deletedAt: null,
          },
        ],
      },
    });
    return <TaskComments taskId="task-2" />;
  },
};

export const Vide: Story = {
  name: 'Aucun commentaire',
  render: () => {
    useStore.setState({
      currentUser: 'matthieu',
      users: mockUsers,
      comments: {},
    });
    return <TaskComments taskId="task-3" />;
  },
};

export const NonConnecte: Story = {
  name: 'Non connecté (lecture seule)',
  render: () => {
    useStore.setState({
      currentUser: null,
      users: mockUsers,
      comments: {
        'task-4': [
          {
            id: 'c-6',
            taskId: 'task-4',
            userId: 'william',
            text: 'Déploiement prévu pour demain 9h.',
            createdAt: now - 60 * min,
            deletedAt: null,
          },
        ],
      },
    });
    return <TaskComments taskId="task-4" />;
  },
};
