export const IPC_CHANNELS = {
  APP: {
    GET_STARTUP_STATUS: 'app:getStartupStatus',
  },
  JOURNAL: {
    GET_TODAY: 'journal:getToday',
    SAVE_TODAY: 'journal:saveToday',
    COMPLETE_REWRITE_PRACTICE: 'journal:completeRewritePractice',
    SKIP_REWRITE_PRACTICE: 'journal:skipRewritePractice',
  },
  SETTINGS: {
    GET: 'settings:get',
    SET_RAW_RESPONSE_STORAGE: 'settings:setRawResponseStorage',
  },
  CREDENTIALS: {
    GET_PROVIDER_KEY_STATUS: 'credentials:getProviderKeyStatus',
  },
  REVIEW: {
    ACKNOWLEDGE_DISCLOSURE: 'review:acknowledgeDisclosure',
    START: 'review:start',
    GET_PREVIEW: 'review:getPreview',
    SAVE: 'review:save',
  },
} as const;
