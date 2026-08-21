import "@testing-library/jest-dom/vitest";

// jsdom ships no matchMedia, and anything that asks a breakpoint a question needs one.
// the hooks guard against it being missing too; this makes a test able to choose an answer.
// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};

if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: noop,
    removeEventListener: noop,
    addListener: noop,
    removeListener: noop,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
