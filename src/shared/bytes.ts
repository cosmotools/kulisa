// A size for people: the window's and the agent's (decimal units, as the OSes' file managers show them).
export const sizeText = (bytes: number) => {
  const [n, unit] = bytes < 1e6 ? [bytes / 1e3, 'KB'] : bytes < 1e9 ? [bytes / 1e6, 'MB'] : [bytes / 1e9, 'GB'];
  return `${n < 10 && unit !== 'KB' ? n.toFixed(1) : Math.max(bytes ? 1 : 0, Math.round(n))} ${unit}`;
};
