export function dirname(path) {
  const dir = path.replace(/[/\\][^/\\]+\/?$/, "");
  if (dir === path) return ".";
  return dir;
}
