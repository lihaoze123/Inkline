export const IPC_CHANNELS = {
  APP: {
    GET_STARTUP_STATUS: 'app:getStartupStatus',
  },
  WRITING: {
    GET_CURRENT_ATTEMPT: 'practice:getCurrentAttempt',
    GET_WRITING_ATTEMPT: 'practice:getWritingAttempt',
    SAVE_WRITING_ATTEMPT: 'practice:saveWritingAttempt',
    GENERATE_STARTER_PROMPT: 'practice:generateStarterPrompt',
    ACKNOWLEDGE_STARTER_PROMPT_DISCLOSURE: 'practice:acknowledgeStarterPromptDisclosure',
    COMPLETE_REWRITE_PRACTICE: 'practice:completeRewritePractice',
    SKIP_REWRITE_PRACTICE: 'practice:skipRewritePractice',
  },
  SETTINGS: {
    GET: 'settings:get',
    SET_RAW_RESPONSE_STORAGE: 'settings:setRawResponseStorage',
    SET_PROVIDER_CONFIG: 'settings:setProviderConfig',
    SET_DEFAULT_PROVIDER: 'settings:setDefaultProvider',
  },
  CREDENTIALS: {
    GET_PROVIDER_KEY_STATUS: 'credentials:getProviderKeyStatus',
    SET_PROVIDER_API_KEY: 'credentials:setProviderApiKey',
    DELETE_PROVIDER_API_KEY: 'credentials:deleteProviderApiKey',
  },
  REVIEW: {
    ACKNOWLEDGE_DISCLOSURE: 'review:acknowledgeDisclosure',
    START: 'review:start',
    PROGRESS: 'review:progress',
    GET_PREVIEW: 'review:getPreview',
    SAVE: 'review:save',
  },
} as const;
