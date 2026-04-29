export const IPC_CHANNELS = {
  APP: {
    GET_STARTUP_STATUS: 'app:getStartupStatus',
  },
  JOURNAL: {
    GET_TODAY: 'journal:getToday',
    SAVE_TODAY: 'journal:saveToday',
  },
  SETTINGS: {
    GET: 'settings:get',
    SET_RAW_RESPONSE_STORAGE: 'settings:setRawResponseStorage',
  },
  CREDENTIALS: {
    GET_PROVIDER_KEY_STATUS: 'credentials:getProviderKeyStatus',
  },
} as const;
