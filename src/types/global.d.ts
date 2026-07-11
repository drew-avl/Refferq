declare namespace NodeJs {
    interface ProcessEnv {
        JWT_SECRET: string;
        DATABASE_URL: string;
        SMTP_HOST?: string;
        SMTP_PORT?: string;
        SMTP_USER?: string;
        SMTP_PASSWORD?: string;
        SMTP_FROM_EMAIL?: string;
        SMTP_FROM?: string;
        SMTP_SECURE?: string;
        SMTP_REQUIRE_TLS?: string;
        ADMIN_EMAILS?: string;
        SMS_ENABLED?: string;
        SMS_PROVIDER?: string;
        ADMIN_SMS_NUMBERS?: string;
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
        TWENTY_WEBHOOK_TIMEOUT_MS?: string;
        TWENTY_API_BASE_URL?: string;
        TWENTY_API_KEY?: string;
    }
}

declare var process: {
    env: NodeJs.ProcessEnv;
};
