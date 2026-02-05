import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskCard } from '../components/TaskCard';
import type { Task } from '../types';

describe('TaskCard', () => {
    const mockTask: Task = {
        id: '1',
        title: 'Test Task',
        status: 'todo',
        priority: 'med',
        project: 'DEMO',
        due: '2025-01-01',
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

    const mockProps = {
        task: mockTask,
        onDragStart: vi.fn(),
        onClick: vi.fn(),
        onContextMenu: vi.fn(),
        onSetProjectDirectory: vi.fn(),
    };

    it('should render task title', () => {
        render(<TaskCard {...mockProps} />);
        expect(screen.getByText('Test Task')).toBeInTheDocument();
    });

    it('should show priority badge', () => {
        render(<TaskCard {...mockProps} />);
        expect(screen.getByText('MOYENNE')).toBeInTheDocument();
    });

    it('should call onClick when clicked', () => {
        render(<TaskCard {...mockProps} />);
        fireEvent.click(screen.getByText('Test Task'));
        expect(mockProps.onClick).toHaveBeenCalledWith(mockTask);
    });
});
