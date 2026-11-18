// Where a floating player settles, and when a drag has left the screen.
// Corners are named with a vertical letter then a horizontal one: se is bottom right.

export function stageCorner(rect, bounds) {
  const width = Number(rect && rect.width) || 0;
  const height = Number(rect && rect.height) || 0;
  const cx = (Number(rect && rect.left) || 0) + width / 2;
  const cy = (Number(rect && rect.top) || 0) + height / 2;
  const midX = ((Number(bounds && bounds.left) || 0) + (Number(bounds && bounds.right) || 0)) / 2;
  const midY = ((Number(bounds && bounds.top) || 0) + (Number(bounds && bounds.bottom) || 0)) / 2;
  return `${cy >= midY ? "s" : "n"}${cx >= midX ? "e" : "w"}`;
}

export const STAGE_DRAG_SLOP = 8;

// "up" means the mouse button is no longer down, so the gesture must end.
// "drag" means the pointer has moved far enough to be a drag, not a tap.
// "wait" means keep watching. Touch does not use the mouse button mask.
export function stagePointerMove({ pointerType, buttons, distance }) {
  if (pointerType === "mouse" && (Number(buttons) & 1) === 0) return "up";
  if (Number(distance) > STAGE_DRAG_SLOP) return "drag";
  return "wait";
}

// True when less than half of the window is still inside the screen.
export function stageMostlyOff(rect, screen) {
  const width = Math.max(0, Number(rect && rect.width) || 0);
  const height = Math.max(0, Number(rect && rect.height) || 0);
  if (width === 0 || height === 0) return false;
  const left = Number(rect.left) || 0;
  const top = Number(rect.top) || 0;
  const visibleW = Math.min(left + width, Number(screen && screen.right) || 0) - Math.max(left, Number(screen && screen.left) || 0);
  const visibleH = Math.min(top + height, Number(screen && screen.bottom) || 0) - Math.max(top, Number(screen && screen.top) || 0);
  const visible = Math.max(0, visibleW) * Math.max(0, visibleH);
  return visible < width * height * 0.5;
}

// Where the player sits. "float" is a corner of the screen. "dock" follows the
// placeholder the hymn page was drawn with, which is how a phone has always
// worked. "words" is for a computer browser: the player is put right above the
// words of the song that is playing, unless the reader chose to float it.
export function stagePlacement({ wide, onSongPage, choice }) {
  if (!onSongPage) return "float";
  if (!wide) return "dock";
  return choice === "float" ? "float" : "words";
}
