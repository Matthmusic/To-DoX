import { useAutoUpdater } from '../hooks/useAutoUpdater';
import { Download, RefreshCw, X, CheckCircle } from 'lucide-react';
import { useState } from 'react';

export function UpdateNotification() {
  const {
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
  } = useAutoUpdater();

  const [dismissed, setDismissed] = useState(false);

  // Ne rien afficher si pas Electron ou notification fermée
  if (!isElectron || dismissed) return null;

  // Notification de mise à jour téléchargée
  if (updateDownloaded) {
    return (
      <div className="fixed top-12 right-4 z-50 bg-green-500 text-white rounded-lg shadow-lg p-4 max-w-md animate-slide-in">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-6 h-6 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold mb-1">Mise à jour prête !</h3>
            <p className="text-sm mb-3">
              Version {updateDownloaded.version} téléchargée. Redémarrez l'application pour l'installer.
            </p>
            <div className="flex gap-2">
              <button
                onClick={installUpdate}
                className="bg-white text-green-600 px-4 py-2 rounded-md text-sm font-medium hover:bg-green-50 transition-colors"
              >
                Redémarrer maintenant
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors"
              >
                Plus tard
              </button>
            </div>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  // Notification de téléchargement en cours
  if (downloadProgress > 0 && downloadProgress < 100) {
    return (
      <div className="fixed top-12 right-4 z-50 bg-blue-500 text-white rounded-lg shadow-lg p-4 max-w-md animate-slide-in">
        <div className="flex items-start gap-3">
          <Download className="w-6 h-6 flex-shrink-0 mt-0.5 animate-pulse" />
          <div className="flex-1">
            <h3 className="font-semibold mb-1">Téléchargement en cours...</h3>
            <div className="bg-white/20 rounded-full h-2 mb-2">
              <div
                className="bg-white rounded-full h-2 transition-all duration-300"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
            <p className="text-sm">{downloadProgress}% terminé</p>
          </div>
        </div>
      </div>
    );
  }

  // Notification de mise à jour disponible
  if (updateAvailable) {
    return (
      <div className="fixed top-12 right-4 z-50 bg-indigo-600 text-white rounded-lg shadow-lg p-4 max-w-md animate-slide-in">
        <div className="flex items-start gap-3">
          <RefreshCw className="w-6 h-6 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold mb-1">Mise à jour disponible</h3>
            <p className="text-sm mb-3">
              Version {updateAvailable.version} disponible (actuelle: {currentVersion})
            </p>
            <div className="flex gap-2">
              <button
                onClick={downloadUpdate}
                className="bg-white text-indigo-600 px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-50 transition-colors"
              >
                Télécharger
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-800 transition-colors"
              >
                Ignorer
              </button>
            </div>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  // Erreur
  if (error) {
    return (
      <div className="fixed top-12 right-4 z-50 bg-red-500 text-white rounded-lg shadow-lg p-4 max-w-md animate-slide-in">
        <div className="flex items-start gap-3">
          <X className="w-6 h-6 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold mb-1">Erreur de mise à jour</h3>
            <p className="text-sm">{error}</p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  // Bouton pour vérifier manuellement (toujours visible en version Electron)
  return (
    <button
      onClick={checkForUpdates}
      disabled={checking}
      className="fixed bottom-4 right-4 z-40 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      title="Vérifier les mises à jour"
    >
      <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
      <span className="text-sm">
        {checking ? 'Vérification...' : `v${currentVersion}`}
      </span>
    </button>
  );
}
