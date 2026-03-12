; ─────────────────────────────────────────────────────────────────────────────
; installer.nsh — Script NSIS personnalisé pour To-DoX
; Ajoute une checkbox "Lancer au démarrage de Windows" sur la page de fin
; ─────────────────────────────────────────────────────────────────────────────

; Les defines MUI_FINISHPAGE et la fonction ne s'appliquent qu'à l'installeur,
; pas au build de l'uninstaller (BUILD_UNINSTALLER défini en ligne de commande).
!macro customHeader
  !ifndef BUILD_UNINSTALLER
    !define MUI_FINISHPAGE_SHOWREADME ""
    !define MUI_FINISHPAGE_SHOWREADME_NOTCHECKED
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

; Nettoyage au désinstallation (supprime l'entrée si présente)
!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "To-DoX"
!macroend
