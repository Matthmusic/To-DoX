import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SubtaskItem } from './SubtaskList';
import type { Task, Subtask } from '../types';

const mockStore = {
  toggleSubtask: vi.fn(),
  deleteSubtask: vi.fn(),
  updateSubtaskTitle: vi.fn(),
  addTask: vi.fn(),
  users: [],
  storagePath: 'C:\\Storage',
};

vi.mock('../store/useStore', () => ({
  default: (selector?: (state: typeof mockStore) => unknown) =>
    selector ? selector(mockStore) : mockStore,
}));

const task: Task = {
  id: 'task-subtask',
  title: 'Parent task',
  status: 'todo',
  priority: 'med',
  project: 'DEMO',
  due: null,
  subtasks: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  completedAt: null,
  notes: '',
  archived: false,
  archivedAt: null,
  favorite: false,
  createdBy: 'unassigned',
  assignedTo: ['unassigned'],
  deletedAt: null,
};

const subtask: Subtask = {
  id: 'subtask-1',
  title: 'Spec review "C:\\Mail Store\\Spec review.msg"',
  completed: false,
  createdAt: Date.now(),
  completedAt: null,
  completedBy: null,
};

describe('SubtaskItem', () => {
  it('renders Outlook links with the amber badge in subtask titles', () => {
    const { container } = render(
      <SubtaskItem
        subtask={subtask}
        task={task}
        isDragging={false}
        onGripMouseDown={vi.fn()}
      />,
    );

    const badge = container.querySelector('[data-link-type="outlook"]');
    expect(badge).not.toBeNull();
    expect(badge).toHaveClass('bg-amber-500/20');
    expect(badge).toHaveTextContent('Spec review.msg');
  });
});
