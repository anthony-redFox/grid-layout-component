// Get from offsetParent
function offsetXYFromParent(
  evt: {
    clientX: number;
    clientY: number;
  },
  offsetParent: Element,
  scale: number
): { x: number; y: number } {
  const isBody = offsetParent === offsetParent.ownerDocument.body;
  const offsetParentRect = isBody
    ? { left: 0, top: 0 }
    : offsetParent.getBoundingClientRect();

  const x =
    (evt.clientX + offsetParent.scrollLeft - offsetParentRect.left) / scale;
  const y =
    (evt.clientY + offsetParent.scrollTop - offsetParentRect.top) / scale;

  return { x, y };
}

function getTouch(
  e: MouseEvent | TouchEvent,
  identifier: number
): Touch | undefined | false {
  return (
    ("targetTouches" in e &&
      Array.from(e.targetTouches).find((t) => identifier === t.identifier)) ||
    ("changedTouches" in e &&
      Array.from(e.changedTouches).find((t) => identifier === t.identifier))
  );
}

export function getTouchIdentifier(
  e: MouseEvent | TouchEvent
): number | undefined {
  if ("targetTouches" in e && e.targetTouches[0])
    return e.targetTouches[0].identifier;
  if ("changedTouches" in e && e.changedTouches[0])
    return e.changedTouches[0].identifier;
}

// Get {x, y} positions from event.
export function getControlPosition(
  e: MouseEvent | TouchEvent,
  node: HTMLElement,
  scale: number,
  touchIdentifier?: number
): { x: number; y: number } | null {
  const touchObj =
    typeof touchIdentifier === "number" ? getTouch(e, touchIdentifier) : null;
  if (typeof touchIdentifier === "number" && !touchObj) return null; // not the right touch
  const touch = touchObj || e;
  let clientX = 0;
  let clientY = 0;
  if ("clientX" in touch && "clientY" in touch) {
    clientX = touch.clientX;
    clientY = touch.clientY;
  }

  // User can provide an offsetParent if desired.
  const offsetParent = node.offsetParent || node.ownerDocument.body;
  return offsetXYFromParent({ clientX, clientY }, offsetParent, scale);
}
