import ToDoX from './ToDoX'
import { UpdateNotification } from './components/UpdateNotification'
import { TitleBar } from './components/TitleBar'
import { LoginModal } from './components/LoginModal'
import useStore from './store/useStore'
import { useDataPersistence } from './hooks/useDataPersistence'
import { useTheme } from './hooks/useTheme'

function App() {
  // IMPORTANT: Charger les données dès le début de l'app
  useDataPersistence();

  // Appliquer le thème dès le chargement de l'app
  useTheme();

  const { currentUser, isLoadingData, saveError, setSaveError } = useStore()

  // CRITIQUE: Toujours afficher le LoginModal si aucun utilisateur connecté
  // Peu importe si les données sont en cours de chargement
  const showLogin = !currentUser

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-transparent">
      {/* Toujours afficher le modal si pas d'utilisateur - BLOQUER l'app */}
      {showLogin && <LoginModal />}
      <TitleBar />
      {saveError && (
        <div className="flex items-center justify-between bg-rose-900/60 border border-rose-500/40 px-4 py-2 text-sm text-rose-200">
          <span>{saveError}</span>
          <button onClick={() => setSaveError(null)} className="ml-4 text-rose-400 hover:text-rose-200 transition-colors">✕</button>
        </div>
      )}
      <div className="flex-1 flex flex-col overflow-hidden pt-8">
        {/* Afficher l'app seulement si un utilisateur est connecté */}
        {currentUser && !isLoadingData && <ToDoX />}
        {/* Écran de chargement si les données chargent */}
        {currentUser && isLoadingData && (
          <div className="flex items-center justify-center h-full">
            <div className="text-slate-400 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
              <p>Chargement des données...</p>
            </div>
          </div>
        )}
      </div>
      <UpdateNotification />
    </div>
  )
}

export default App
