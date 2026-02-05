import { useState, useEffect } from 'react';

import type { UpdateInfo } from '../types';

export function useAutoUpdater() {
  const [isElectron] = useState(() => window.electronAPI?.isElectron || false);
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [updateAvailable, setUpdateAvailable] = useState<UpdateInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [updateDownloaded, setUpdateDownloaded] = useState<UpdateInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!isElectron || !window.electronAPI) return;

    // Récupérer la version actuelle
    window.electronAPI.getAppVersion().then(setCurrentVersion);

    // Écouter les événements de mise à jour
    window.electronAPI.onUpdateAvailable((info) => {
      setUpdateAvailable(info);
      setChecking(false);
    });

    window.electronAPI.onDownloadProgress((progress) => {
      setDownloadProgress(Math.round(progress.percent));
    });

    window.electronAPI.onUpdateDownloaded((info) => {
      setUpdateDownloaded(info);
      setDownloadProgress(100);
    });

    window.electronAPI.onUpdateError((err) => {
      setError(err.message);
      setChecking(false);
    });
  }, [isElectron]);

  const checkForUpdates = async () => {
    if (!isElectron || !window.electronAPI) return;
    setChecking(true);
    setError(null);
    await window.electronAPI.checkForUpdates();
  };

  const downloadUpdate = async () => {
    if (!isElectron || !window.electronAPI) return;
    setError(null);
    const success = await window.electronAPI.downloadUpdate();
    if (!success) {
      setError('Erreur lors du téléchargement de la mise à jour');
    }
  };

  const installUpdate = () => {
    if (!isElectron || !window.electronAPI) return;
    window.electronAPI.installUpdate();
  };

  return {
    isElectron,
    currentVersion,
    updateAvailable,
    downloadProgress,
    updateDownloaded,
    error,
    checking,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
  };
}
