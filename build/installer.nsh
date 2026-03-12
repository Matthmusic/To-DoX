; ─────────────────────────────────────────────────────────────────────────────
; installer.nsh — Script NSIS personnalisé pour To-DoX
; Ajoute une checkbox "Lancer au démarrage de Windows" sur la page de fin
; ─────────────────────────────────────────────────────────────────────────────

!macro customHeader
  !ifndef BUILD_UNINSTALLER
    !define MUI_FINISHPAGE_SHOWREADME ""
    !define MUI_FINISHPAGE_SHOWREADME_NOTCHECKED
    !define MUI_FINISHPAGE_SHOWREADME_TEXT "Lancer To-DoX au démarrage de Windows"
    !define MUI_FINISHPAGE_SHOWREADME_FUNCTION todox_AddToStartup
  !endif
!macroend

; La fonction n'est appelée que dans le contexte installeur (page de fin).
; Dans le build de l'uninstaller elle est compilée mais jamais référencée :
; on supprime l'avertissement 6010 pour éviter l'échec du build.
!pragma warning push
!pragma warning disable 6010
Function todox_AddToStartup
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" \
    "To-DoX" '"$INSTDIR\To-DoX.exe"'
FunctionEnd
!pragma warning pop

; Nettoyage à la désinstallation (supprime l'entrée si présente)
!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "To-DoX"
!macroend
