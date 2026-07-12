declare namespace NodeJs {
    interface ProcessEnv {
        JWT_SECRET: string;
        DATABASE_URL: string;
        MICROSOFT_TENANT_ID?: string;
        MICROSOFT_CLIENT_ID?: string;
        MICROSOFT_CLIENT_SECRET?: string;
        MICROSOFT_GRAPH_SENDER?: string;
        MICROSOFT_365_SENDER?: string;
        MICROSOFT_GRAPH_SAVE_TO_SENT_ITEMS?: string;
        AZURE_TENANT_ID?: string;
        AZURE_CLIENT_ID?: string;
        AZURE_CLIENT_SECRET?: string;
        EMAIL_FROM_ADDRESS?: string;
        ADMIN_EMAILS?: string;
        SMS_ENABLED?: string;
        SMS_PROVIDER?: string;
        ADMIN_SMS_NUMBERS?: string;
        SMS_RELAY_URL?: string;
        SMS_RELAY_TOKEN?: string;
        SMS_RELAY_TIMEOUT_MS?: string;
        REFERRAL_REMINDER_TIME_ZONE?: string;
        REFERRAL_REMINDER_BUSINESS_START_HOUR?: string;
        REFERRAL_REMINDER_BUSINESS_END_HOUR?: string;
        REFERRAL_REMINDER_DELAY_MINUTES?: string;
        REFERRAL_REMINDER_BATCH_SIZE?: string;
        VOIPMS_API_USERNAME?: string;
        VOIPMS_API_PASSWORD?: string;
        VOIPMS_SMS_DID?: string;
        VOIPMS_API_ENDPOINT?: string;
        THREECX_SMS_WEBHOOK_URL?: string;
        THREECX_SMS_WEBHOOK_TOKEN?: string;
        THREECX_SMS_FROM?: string;
        NEXT_PUBLIC_APP_URL: string;
        TWENTY_SYNC_ENABLED?: string;
        TWENTY_REFERRAL_SYNC_ENABLED?: string;
        TWENTY_PARTNER_SYNC_ENABLED?: string;
        TWENTY_PAYOUT_SYNC_ENABLED?: string;
        TWENTY_WEBHOOK_URL?: string;
        TWENTY_REFERRAL_WEBHOOK_URL?: string;
        TWENTY_PARTNER_WEBHOOK_URL?: string;
        TWENTY_PAYOUT_WEBHOOK_URL?: string;
        TWENTY_WEBHOOK_SECRET?: string;
        TWENTY_WORKFLOW_SIGNING_SECRET?: string;
        TWENTY_WEBHOOK_TIMEOUT_MS?: string;
        TWENTY_API_BASE_URL?: string;
        TWENTY_API_KEY?: string;
        TWENTY_API_TIMEOUT_MS?: string;
        TWENTY_WORKSPACE_ID?: string;
        TWENTY_WORKSPACE_NAME?: string;
        TWENTY_SYNC_MODE?: string;
        TWENTY_OUTBOX_BATCH_SIZE?: string;
        TWENTY_OUTBOX_CONCURRENCY?: string;
        TWENTY_OUTBOX_MAX_ATTEMPTS?: string;
        TWENTY_OUTBOUND_WEBHOOK_SECRET?: string;
        TWENTY_WEBHOOK_REPLAY_WINDOW_SECONDS?: string;
        TWENTY_INTEGRATION_ACTOR_ID?: string;
    }
}

declare var process: {
    env: NodeJs.ProcessEnv;
};
