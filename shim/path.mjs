export function dirname(path) {
  const dir = path.replace(/[/\\][^/\\]+\/?$/, "");
  if (dir === path) return ".";
  return dir;
}

export function basename(path) {
  const match = path.match(/([^/\\]+)[/\\]*$/);
  return match ? match[1] : "";
}
