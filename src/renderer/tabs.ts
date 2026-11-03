export function selectScreen(root: ParentNode, screen: string): void {
  for (const panel of root.querySelectorAll<HTMLElement>('[data-panel]')) {
    panel.hidden = panel.dataset.panel !== screen
  }

  for (const tab of root.querySelectorAll<HTMLButtonElement>('[data-screen]')) {
    tab.setAttribute(
      'aria-pressed',
      tab.dataset.screen === screen ? 'true' : 'false',
    )
  }
}
