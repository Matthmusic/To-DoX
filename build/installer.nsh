; ─────────────────────────────────────────────────────────────────────────────
; installer.nsh — Script NSIS personnalisé pour To-DoX
; Ajoute une checkbox "Lancer au démarrage de Windows" sur la page de fin
; ─────────────────────────────────────────────────────────────────────────────

; Note : BUILD_UNINSTALLER est passé en define CLI par electron-builder lors du
; build de l'uninstaller. Le guard !ifndef empêche la compilation de la fonction
; dans ce contexte. warningsAsErrors:false dans package.json assure que le build
; ne plante pas même si NSIS génère un warning 6010 résiduel.
!macro customHeader
  !ifndef BUILD_UNINSTALLER
    !define MUI_FINISHPAGE_SHOWREADME ""
    !define MUI_FINISHPAGE_SHOWREADME_TEXT "Lancer To-DoX au démarrage de Windows"
    !define MUI_FINISHPAGE_SHOWREADME_FUNCTION todox_AddToStartup
  !endif
!macroend

!ifndef BUILD_UNINSTALLER
Function todox_AddToStartup
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" \
    "To-DoX" '"$INSTDIR\To-DoX.exe"'
FunctionEnd
!endif

; Nettoyage à la désinstallation (supprime l'entrée si présente)
!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "To-DoX"
!macroend
