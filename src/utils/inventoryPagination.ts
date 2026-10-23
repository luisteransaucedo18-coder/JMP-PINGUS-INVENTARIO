/** Reset only known scroll containers; do not let scrollIntoView move the application shell. */
export function resetInventoryPageScroll(marker: HTMLElement | null) {
  if (!marker) return;
  const options: ScrollToOptions = { top: 0, behavior: 'auto' };
  marker.closest<HTMLElement>('.inventory-view')?.scrollTo(options);
  marker.closest<HTMLElement>('.app-scroll')?.scrollTo(options);
  const documentScroll = marker.ownerDocument.scrollingElement;
  if (documentScroll && documentScroll.scrollTop !== 0) documentScroll.scrollTo(options);
}
