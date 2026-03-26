import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TaskNotesSection } from './TaskNotesSection';
import type { Task } from '../../types';

const mockStore = {
  storagePath: 'C:\\Storage',
};

vi.mock('../../store/useStore', () => ({
  default: (selector?: (state: typeof mockStore) => unknown) =>
    selector ? selector(mockStore) : mockStore,
}));

const baseTask: Task = {
  id: 'task-notes',
  title: 'Review outlook drop',
  status: 'todo',
  priority: 'med',
  project: 'DEMO',
  due: null,
  subtasks: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  completedAt: null,
  notes: 'Spec review "C:\\Mail Store\\Spec review.msg"',
  archived: false,
  archivedAt: null,
  favorite: false,
  createdBy: 'unassigned',
  assignedTo: ['unassigned'],
  deletedAt: null,
};

describe('TaskNotesSection', () => {
  it('renders Outlook note links with the amber badge', () => {
    const { container } = render(
      <TaskNotesSection task={baseTask} updateTask={vi.fn()} />,
    );

    const badge = container.querySelector('[data-link-type="outlook"]');
    expect(badge).not.toBeNull();
    expect(badge).toHaveClass('bg-amber-500/20');
    expect(badge).toHaveTextContent('Spec review.msg');
  });
});
