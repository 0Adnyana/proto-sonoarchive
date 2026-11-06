import { startLibrary } from './library'
import { selectScreen } from './tabs'

for (const tab of document.querySelectorAll<HTMLButtonElement>(
  '[data-screen]',
)) {
  tab.addEventListener('click', () => {
    const screen = tab.dataset.screen
    if (screen) selectScreen(document, screen)
  })
}

startLibrary(document, window.sonoarchive)
