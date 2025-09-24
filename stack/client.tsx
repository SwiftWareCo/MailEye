import { StackClientApp } from "@stackframe/stack";

export const stackClientApp = new StackClientApp({
  tokenStore: "nextjs-cookie",
  projectId: process.env.NEXT_PUBLIC_PROJECT_ID,
  publishableClientKey: process.env.NEXT_PUBLIC_PUBLISHABLE_CLIENT_KEY,
  urls: {
    signIn: "/sign-in",
    signUp: "/sign-up",
  },
});
