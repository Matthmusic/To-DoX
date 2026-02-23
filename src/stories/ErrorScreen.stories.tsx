import type { Meta, StoryObj } from '@storybook/react';
import { ErrorScreen } from '../components/ErrorScreen';

const sampleError = new Error('Cannot read properties of undefined (reading "map")');
sampleError.stack = `Error: Cannot read properties of undefined (reading 'map')
    at TaskCard (TaskCard.tsx:42:18)
    at renderWithHooks (react-dom.development.js:14985:18)
    at mountIndeterminateComponent (react-dom.development.js:17811:13)
    at beginWork (react-dom.development.js:19049:16)`;

const sampleErrorInfo: React.ErrorInfo = {
  componentStack: `
    at TaskCard (src/components/TaskCard.tsx:42)
    at ProjectCard (src/components/ProjectCard.tsx:87)
    at KanbanBoard (src/components/KanbanBoard.tsx:34)
    at ErrorBoundary (src/components/ErrorBoundary.tsx:12)`,
};

const meta: Meta<typeof ErrorScreen> = {
  title: 'Feedback/ErrorScreen',
  component: ErrorScreen,
  parameters: { layout: 'fullscreen' },
  args: {
    onReset: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof ErrorScreen>;

export const WithError: Story = {
  name: 'Erreur avec stack trace',
  args: {
    error: sampleError,
    errorInfo: sampleErrorInfo,
    boundaryName: 'KanbanBoard',
  },
};

export const WithoutBoundaryName: Story = {
  name: 'Sans nom de boundary',
  args: {
    error: sampleError,
    errorInfo: sampleErrorInfo,
  },
};

export const NoError: Story = {
  name: 'Sans erreur (null)',
  args: {
    error: null,
    errorInfo: null,
    boundaryName: 'AppRoot',
  },
};
