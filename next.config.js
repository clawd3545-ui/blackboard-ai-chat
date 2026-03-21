/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['openai'],
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://hpvcfizzwljhrioacykn.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwdmNmaXp6d2xqaHJpb2FjeWtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNjkwMDQsImV4cCI6MjA4OTY0NTAwNH0.D72HJjjL6tXIkoKk6eNd9En9pjsrylRuEctSrKq1utY',
    NEXT_PUBLIC_APP_URL: 'https://blackboard-ai-chat.vercel.app',
    SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwdmNmaXp6d2xqaHJpb2FjeWtuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDA2OTAwNCwiZXhwIjoyMDg5NjQ1MDA0fQ.StS8PylcYUkDb44licTDOPBsKWbLZytGBF6onMy8tx8',
    ENCRYPTION_SECRET: '8Wunt2zibsjEixe/xgB6xcM9JZdhkVw3/V5A6S1bF/4=',
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
