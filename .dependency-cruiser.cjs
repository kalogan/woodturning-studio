/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'core-no-browser',
      comment: 'src/core must not import browser APIs, Three.js, React, or UI layers',
      severity: 'error',
      from: { path: '^src/core/' },
      to: {
        path: [
          '^src/client/',
          '^src/input/',
          '^src/session/',
          'three',
          'react',
          '@react-three',
          'zustand',
        ],
      },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    externalModuleResolutionStrategy: 'node_modules',
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
