import { registerSW } from 'virtual:pwa-register'

// Manual update flow: ask before reloading rather than silently swapping the
// app out from under someone mid-submission.
const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
        if (confirm('Une nouvelle version est disponible. Recharger maintenant ?')) {
            updateSW(true)
        }
    },
    onOfflineReady() {
        console.info('Application prête à fonctionner hors-ligne.')
    }
})
