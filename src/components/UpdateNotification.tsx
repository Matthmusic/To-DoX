import { useAutoUpdater } from '../hooks/useAutoUpdater';
import { Download, RefreshCw, X, CheckCircle, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { motion } from 'framer-motion';

// Helper pour convertir du markdown basique en HTML
function parseMarkdown(text: string): string {
  if (!text) return '';

  return text
    // Titres (## Titre)
    .replace(/^### (.+)$/gm, '<h3 class="font-semibold text-sm mt-2 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="font-semibold text-base mt-3 mb-1">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="font-bold text-lg mt-3 mb-2">$1</h1>')
    // Gras (**text**)
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    // Italique (*text*)
    .replace(/\*(.+?)\*/g, '<em class="italic">$1</em>')
    // Code inline (`code`)
    .replace(/`(.+?)`/g, '<code class="bg-white/10 px-1 rounded text-xs">$1</code>')
    // Listes (- item ou * item)
    .replace(/^[\-\*] (.+)$/gm, '<li class="ml-4">• $1</li>')
    // Liens [text](url)
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="underline hover:text-white/90">$1</a>')
    // Paragraphes (double saut de ligne)
    .replace(/\n\n/g, '<br/><br/>');
}

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
  const [changelogExpanded, setChangelogExpanded] = useState(false);

  // Ne rien afficher si pas Electron ou notification fermée
  if (!isElectron || dismissed) return null;

  // Notification de mise à jour téléchargée
  if (updateDownloaded) {
    return (
      <motion.div
        className="fixed top-12 right-4 z-50 bg-green-500 text-white rounded-lg shadow-lg p-4 max-w-md"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
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
      </motion.div>
    );
  }

  // Notification de téléchargement en cours
  if (downloadProgress > 0 && downloadProgress < 100) {
    return (
      <motion.div
        className="fixed top-12 right-4 z-50 bg-blue-500 text-white rounded-lg shadow-lg p-4 max-w-md"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
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
      </motion.div>
    );
  }

  // Notification de mise à jour disponible
  if (updateAvailable) {
    const hasChangelog = updateAvailable.releaseNotes && updateAvailable.releaseNotes.trim().length > 0;

    return (
      <motion.div
        className="fixed top-12 right-4 z-50 bg-indigo-600 text-white rounded-lg shadow-lg p-4 max-w-md"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <div className="flex items-start gap-3">
          <RefreshCw className="w-6 h-6 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold mb-1">Mise à jour disponible</h3>
            <p className="text-sm mb-3">
              Version {updateAvailable.version} disponible (actuelle: {currentVersion})
            </p>

            {/* Changelog expandable */}
            {hasChangelog && (
              <div className="mb-3">
                <button
                  onClick={() => setChangelogExpanded(!changelogExpanded)}
                  className="flex items-center gap-2 text-sm text-white/90 hover:text-white transition-colors mb-2"
                >
                  {changelogExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                  <span className="font-medium">
                    {changelogExpanded ? 'Masquer les notes de version' : 'Voir les notes de version'}
                  </span>
                </button>

                {changelogExpanded && (
                  <div
                    className="text-xs bg-white/10 rounded-md p-3 max-h-48 overflow-y-auto text-white/90 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: parseMarkdown(updateAvailable.releaseNotes || '') }}
                  />
                )}
              </div>
            )}

            <div className="flex gap-2 flex-wrap">
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
              {/* Lien vers toutes les releases GitHub */}
              <button
                onClick={() => window.electronAPI?.openExternalUrl('https://github.com/Matthmusic/To-DoX/releases')}
                className="flex items-center gap-1 text-white/80 hover:text-white px-3 py-2 rounded-md text-xs transition-colors"
                title="Voir toutes les versions sur GitHub"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Toutes les versions</span>
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
      </motion.div>
    );
  }

  // Erreur
  if (error) {
    return (
      <motion.div
        className="fixed top-12 right-4 z-50 bg-red-500 text-white rounded-lg shadow-lg p-4 max-w-md"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
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
      </motion.div>
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
