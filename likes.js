// Likes stay on this device. There is no account and no server.
export const LIKES_KEY = "hark-likes";

function storageOf(storage) {
  return storage || globalThis.localStorage;
}

export function readLikes(storage) {
  try {
    const raw = storageOf(storage).getItem(LIKES_KEY);
    const parsed = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return [];
    const numbers = parsed
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);
    return [...new Set(numbers)].sort((a, b) => a - b);
  } catch {
    return [];
  }
}

export function isLiked(number, storage) {
  return readLikes(storage).includes(Number(number));
}

export function toggleLike(number, storage) {
  const store = storageOf(storage);
  const current = readLikes(store);
  const hymn = Number(number);
  if (!Number.isInteger(hymn) || hymn <= 0) return { liked: false, likes: current };
  const liked = !current.includes(hymn);
  const likes = liked
    ? [...current, hymn].sort((a, b) => a - b)
    : current.filter((value) => value !== hymn);
  try {
    store.setItem(LIKES_KEY, JSON.stringify(likes));
  } catch {
    return { liked: current.includes(hymn), likes: current };
  }
  return { liked, likes };
}

export function likeButtonState(liked) {
  return liked
    ? { pressed: true, label: "Unlike this hymn", text: "Liked" }
    : { pressed: false, label: "Like this hymn", text: "Like" };
}

// Hymns in the book that this device has liked, in hymnal order.
export function likedHymns(hymns, storage) {
  const liked = new Set(readLikes(storage));
  return (Array.isArray(hymns) ? hymns : [])
    .filter((hymn) => liked.has(hymn.number))
    .sort((a, b) => a.number - b.number);
}
