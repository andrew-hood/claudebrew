export const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');

export const log = (...args: unknown[]): void => {
  if (verbose) console.log(...args);
};
