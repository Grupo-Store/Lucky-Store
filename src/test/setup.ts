import "@testing-library/jest-dom";

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

window.print = () => {};

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// O Radix (Select, Dropdown) usa Pointer Capture e scrollIntoView, que o jsdom
// nao implementa. Sem estes stubs o menu do Select nunca abre nos testes, o que
// torna impossivel preencher formularios que dependem de um Select.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
