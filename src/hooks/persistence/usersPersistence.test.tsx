import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import useStore from '../../store/useStore';
import { FIXED_USERS, STORAGE_KEY } from '../../constants';
import { useLoadData } from './useLoadData';
import { usePersistSave } from './usePersistSave';
import { useSyncPolling } from './useSyncPolling';
import type { PersistenceRefs } from './persistence.utils';

const newUser = { id: 'new-user', name: 'Alex Martin', email: 'alex@example.com' };
const refs = (): PersistenceRefs => ({ lastFileHash: { current: null }, lastCommentsHash: { current: null }, lastKnownFileTimeEntries: { current: [] } });
const initial = useStore.getInitialState();

beforeEach(() => {
  localStorage.clear();
  useStore.setState({ ...initial, users: [...FIXED_USERS], usersUpdatedAt: 0, isLoadingData: true });
  window.electronAPI = undefined;
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('editable user directory', () => {
  it('does not overwrite a newer shared directory while saving tasks', async () => {
    vi.useFakeTimers();
    useStore.setState({ storagePath: 'C:/test', isLoadingData: false, usersUpdatedAt: 1 });
    const saveData = vi.fn(async () => ({ success: true }));
    window.electronAPI = {
      isElectron: true, saveData,
      readData: vi.fn(async () => ({ success: true, data: { users: [...FIXED_USERS, newUser], usersUpdatedAt: 10 } })),
      getFileHash: vi.fn(async () => ({ success: true, hash: 'saved' })),
    } as unknown as NonNullable<typeof window.electronAPI>;
    renderHook(() => usePersistSave(refs(), useStore.getState()));
    await act(() => vi.advanceTimersByTimeAsync(150));
    expect(saveData).toHaveBeenCalledWith('C:/test/data.json', expect.objectContaining({ users: expect.arrayContaining([newUser]), usersUpdatedAt: 10 }));
    expect(useStore.getState().users).toContainEqual(newUser);
  });

  it('persists a newly added user in the web payload', async () => {
    useStore.setState({ isLoadingData: false });
    renderHook(() => usePersistSave(refs(), useStore()));
    act(() => useStore.getState().setUsers([...FIXED_USERS, newUser]));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).users).toContainEqual(newUser));
  });

  it('restores the new user and their session on web restart', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ users: [...FIXED_USERS, newUser], usersUpdatedAt: 5 }));
    localStorage.setItem('current_user_id', newUser.id);
    renderHook(() => useLoadData(refs()));
    await waitFor(() => expect(useStore.getState().isLoadingData).toBe(false));
    expect(useStore.getState().users).toContainEqual(newUser);
    expect(useStore.getState().currentUser).toBe(newUser.id);
  });

  it('restores a session whose user only exists in shared Electron data', async () => {
    localStorage.setItem('current_user_id', newUser.id);
    window.electronAPI = {
      isElectron: true, getStoragePath: vi.fn(async () => 'C:/test'),
      readData: vi.fn(async (path: string) => ({ success: true, data: path.endsWith('data.json') ? { users: [...FIXED_USERS, newUser], usersUpdatedAt: 10 } : { comments: {} } })),
      getFileHash: vi.fn(async () => ({ success: true, hash: 'shared' })),
    } as unknown as NonNullable<typeof window.electronAPI>;
    renderHook(() => useLoadData(refs()));
    await waitFor(() => expect(useStore.getState().isLoadingData).toBe(false));
    expect(useStore.getState().currentUser).toBe(newUser.id);
    expect(useStore.getState().usersUpdatedAt).toBe(10);
  });

  it('loads remote additions through polling without resetting the current session', async () => {
    vi.useFakeTimers();
    useStore.setState({ storagePath: 'C:/test', isLoadingData: false, currentUser: 'matthieu' });
    window.electronAPI = {
      isElectron: true, getFileHash: vi.fn(async () => ({ success: true, hash: 'new' })),
      readData: vi.fn(async () => ({ success: true, data: { users: [...FIXED_USERS, newUser], usersUpdatedAt: 10 } })),
    } as unknown as NonNullable<typeof window.electronAPI>;
    renderHook(() => useSyncPolling(refs(), useStore.getState()));
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(useStore.getState().users).toContainEqual(newUser);
    expect(useStore.getState().currentUser).toBe('matthieu');
  });
});
