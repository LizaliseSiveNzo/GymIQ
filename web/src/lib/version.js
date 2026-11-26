// App version. Bump APP_VERSION on each release; APP_BUILD is the git commit id (auto).
export const APP_VERSION = '1.0.0';
export const APP_BUILD = (typeof __APP_BUILD__ === 'string' && __APP_BUILD__) || 'dev';
