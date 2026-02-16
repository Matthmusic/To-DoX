/**
 * 🔔 PANNEAU DE CONFIGURATION DES NOTIFICATIONS
 * Interface pour configurer les notifications desktop natives
 */

import { createPortal } from 'react-dom';
import { X, Bell, BellOff, Clock, Moon, Volume2, VolumeX, AlertCircle, Music, Play } from 'lucide-react';
import useStore from '../../store/useStore';
import { useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { NOTIFICATION_SOUNDS } from '../../constants';
import { playSoundFile } from '../../utils/sound';

interface NotificationsPanelProps {
  onClose: () => void;
}

export function NotificationsPanel({ onClose }: NotificationsPanelProps) {
  const { notificationSettings, updateNotificationSettings } = useStore();
  const { activeTheme } = useTheme();
  const primaryColor = activeTheme.palette.primary;
  const secondaryColor = activeTheme.palette.secondary;
  const [testSent, setTestSent] = useState(false);
  const [playingSound, setPlayingSound] = useState<string | null>(null);

  const handleToggle = (key: keyof typeof notificationSettings) => {
    updateNotificationSettings({ [key]: !notificationSettings[key] });
  };

  const handleIntervalChange = (value: number) => {
    updateNotificationSettings({ checkInterval: value });
  };

  const handleTimeChange = (key: 'quietHoursStart' | 'quietHoursEnd', value: string) => {
    updateNotificationSettings({ [key]: value });
  };

  const handleSoundChange = (soundFile: string) => {
    updateNotificationSettings({ soundFile });
  };

  const handlePlaySound = async (soundFile: string) => {
    setPlayingSound(soundFile);

    try {
      const audio = await playSoundFile(soundFile);
      audio.onended = () => setPlayingSound(null);
      audio.onerror = () => setPlayingSound(null);
    } catch (error) {
      console.warn('⚠️ Impossible de jouer l\'aperçu sonore:', error);
      setPlayingSound(null);
    }
  };

  const handleTestNotification = async () => {
    if (!window.electronAPI) {
      alert('Les notifications ne sont disponibles qu\'en mode desktop (Electron)');
      return;
    }

    try {
      // Envoyer la notification
      await window.electronAPI.sendNotification(
        '🔔 Test de notification',
        'Si vous voyez ceci, les notifications fonctionnent correctement !',
        'test-notification'
      );

      // 🔊 Jouer le son sélectionné si activé
      if (notificationSettings.sound && notificationSettings.soundFile) {
        try {
          await playSoundFile(notificationSettings.soundFile);
        } catch (audioError) {
          console.warn('⚠️ Impossible de jouer le son:', audioError);
        }
      }

      setTestSent(true);
      setTimeout(() => setTestSent(false), 3000);
    } catch (error) {
      console.error('Erreur test notification:', error);
      alert('Erreur lors de l\'envoi de la notification de test');
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
      {/* Panel */}
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto border-2 border-theme-primary rounded-2xl shadow-2xl"
        style={{
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          backgroundColor: 'var(--bg-secondary)',
          opacity: 0.98
        }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-theme-primary bg-theme-secondary/95 backdrop-blur-sm">
          <h2
            className="text-2xl font-bold bg-clip-text text-transparent flex items-center gap-2"
            style={{
              backgroundImage: `linear-gradient(to right, ${primaryColor}, ${secondaryColor})`
            }}
          >
            <Bell className="w-6 h-6" style={{ color: primaryColor }} />
            Notifications Desktop
          </h2>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-10 h-10 rounded-full border border-theme-primary bg-white/5 text-theme-muted hover:text-theme-primary hover:bg-red-500/20 hover:border-red-500/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Activation globale */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-theme-primary">
            <div className="flex items-center gap-3">
              {notificationSettings.enabled ? (
                <Bell className="w-6 h-6" style={{ color: primaryColor }} />
              ) : (
                <BellOff className="w-6 h-6 text-slate-500" />
              )}
              <div>
                <h3 className="text-lg font-bold text-white">Activer les notifications</h3>
                <p className="text-sm text-theme-muted">Recevoir des alertes desktop pour les tâches</p>
              </div>
            </div>
            <button
              onClick={() => handleToggle('enabled')}
              className="relative inline-flex h-8 w-14 items-center rounded-full transition-colors"
              style={{
                backgroundColor: notificationSettings.enabled ? primaryColor : '#475569'
              }}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  notificationSettings.enabled ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Types de notifications */}
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-400" />
              Types d'alertes
            </h3>

            <div className="space-y-2">
              <ToggleOption
                label="Échéances proches (24h)"
                description="Notifier quand une tâche arrive à échéance demain"
                enabled={notificationSettings.deadlineNotifications}
                onToggle={() => handleToggle('deadlineNotifications')}
                disabled={!notificationSettings.enabled}
              />

              <ToggleOption
                label="Tâches à relancer"
                description="Notifier les tâches en cours sans mouvement depuis 3 jours"
                enabled={notificationSettings.staleTaskNotifications}
                onToggle={() => handleToggle('staleTaskNotifications')}
                disabled={!notificationSettings.enabled}
              />
            </div>
          </div>

          {/* Fréquence de vérification */}
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-400" />
              Fréquence de vérification
            </h3>

            <div className="flex items-center gap-4">
              <input
                type="range"
                min="5"
                max="120"
                step="5"
                value={notificationSettings.checkInterval}
                onChange={(e) => handleIntervalChange(Number(e.target.value))}
                disabled={!notificationSettings.enabled}
                className="flex-1 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full"
                style={{
                  ['--tw-slider-thumb' as any]: primaryColor
                }}
              />
              <style>{`
                input[type="range"]::-webkit-slider-thumb {
                  background-color: ${primaryColor};
                }
                input[type="range"]::-moz-range-thumb {
                  background-color: ${primaryColor};
                }
              `}</style>
              <span className="text-sm font-bold min-w-[60px]" style={{ color: primaryColor }}>
                {notificationSettings.checkInterval} min
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Les tâches seront vérifiées toutes les {notificationSettings.checkInterval} minutes
            </p>
          </div>

          {/* Heures calmes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Moon className="w-5 h-5 text-indigo-400" />
                Mode "Ne pas déranger"
              </h3>
              <button
                onClick={() => handleToggle('quietHoursEnabled')}
                disabled={!notificationSettings.enabled}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  notificationSettings.quietHoursEnabled ? 'bg-indigo-500' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                    notificationSettings.quietHoursEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {notificationSettings.quietHoursEnabled && (
              <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-white/5 border border-theme-primary">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">
                    Début
                  </label>
                  <input
                    type="time"
                    value={notificationSettings.quietHoursStart}
                    onChange={(e) => handleTimeChange('quietHoursStart', e.target.value)}
                    disabled={!notificationSettings.enabled}
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none"
                    style={{
                      ['--focus-color' as any]: primaryColor
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = primaryColor}
                    onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">
                    Fin
                  </label>
                  <input
                    type="time"
                    value={notificationSettings.quietHoursEnd}
                    onChange={(e) => handleTimeChange('quietHoursEnd', e.target.value)}
                    disabled={!notificationSettings.enabled}
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none"
                    style={{
                      ['--focus-color' as any]: primaryColor
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = primaryColor}
                    onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'}
                  />
                </div>
                <p className="col-span-2 text-xs text-slate-500">
                  Aucune notification entre {notificationSettings.quietHoursStart} et {notificationSettings.quietHoursEnd}
                </p>
              </div>
            )}
          </div>

          {/* Son */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-theme-primary">
            <div className="flex items-center gap-3">
              {notificationSettings.sound ? (
                <Volume2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <VolumeX className="w-5 h-5 text-slate-500" />
              )}
              <div>
                <h3 className="text-base font-bold text-white">Son</h3>
                <p className="text-sm text-theme-muted">Jouer un son avec les notifications</p>
              </div>
            </div>
            <button
              onClick={() => handleToggle('sound')}
              disabled={!notificationSettings.enabled}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                notificationSettings.sound ? 'bg-emerald-500' : 'bg-slate-600'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  notificationSettings.sound ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Sélection du son */}
          {notificationSettings.sound && (
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Music className="w-5 h-5 text-pink-400" />
                Choisir le son de notification
              </h3>

              <div className="grid grid-cols-1 gap-2">
                {NOTIFICATION_SOUNDS.map((sound) => (
                  <div
                    key={sound.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                      notificationSettings.soundFile === sound.file
                        ? 'bg-white/10 border-theme-primary shadow-lg'
                        : 'bg-white/5 border-slate-700 hover:border-slate-600'
                    }`}
                    onClick={() => handleSoundChange(sound.file)}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          notificationSettings.soundFile === sound.file
                            ? 'border-theme-primary'
                            : 'border-slate-600'
                        }`}
                      >
                        {notificationSettings.soundFile === sound.file && (
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }} />
                        )}
                      </div>
                      <span className="text-white font-medium">{sound.name}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void handlePlaySound(sound.file);
                      }}
                      disabled={!notificationSettings.enabled || playingSound === sound.file}
                      className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-slate-700 hover:border-theme-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Écouter un aperçu"
                    >
                      <Play className="w-4 h-4" style={{ color: playingSound === sound.file ? primaryColor : undefined }} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Test notification */}
          <div className="pt-4 border-t border-theme-primary">
            <button
              onClick={handleTestNotification}
              disabled={!notificationSettings.enabled || !window.electronAPI}
              className="w-full px-6 py-3 rounded-lg text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              style={{
                backgroundImage: `linear-gradient(to right, ${primaryColor}, ${secondaryColor})`
              }}
            >
              {testSent ? '✅ Notification envoyée !' : '🧪 Envoyer une notification de test'}
            </button>
            {!window.electronAPI && (
              <p className="mt-2 text-xs text-amber-400 text-center">
                ⚠️ Les notifications ne sont disponibles qu'en mode desktop (Electron)
              </p>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * Composant Toggle Option réutilisable
 */
interface ToggleOptionProps {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

function ToggleOption({ label, description, enabled, onToggle, disabled }: ToggleOptionProps) {
  const { activeTheme } = useTheme();
  const primaryColor = activeTheme.palette.primary;

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-theme-primary">
      <div className="flex-1">
        <h4 className="text-sm font-bold text-white">{label}</h4>
        <p className="text-xs text-theme-muted">{description}</p>
      </div>
      <button
        onClick={onToggle}
        disabled={disabled}
        className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          backgroundColor: enabled ? primaryColor : '#475569'
        }}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}
