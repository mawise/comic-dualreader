export const process = {
  nextTick: function (cb, ...args) {
    setTimeout(() => cb(...args), 0);
  },
  env: {}
};

export const global = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this;
