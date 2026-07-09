declare namespace NodeJs {
    interface ProcessEnv {
        JWT_SECRET: string;
        DATABASE_URL: string;
        RESEND_API_KEY: string;
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
    }
}

declare var process: {
    env: NodeJs.ProcessEnv;
};
