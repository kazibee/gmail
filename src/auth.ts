import { auth as googleAuth } from '@googleapis/gmail';

export interface Env {
  CLIENT_ID: string;
  CLIENT_SECRET: string;
  REFRESH_TOKEN: string;
}

export function createAuthClient(env: Env): InstanceType<typeof googleAuth.OAuth2> {
  const oauth2 = new googleAuth.OAuth2(env.CLIENT_ID, env.CLIENT_SECRET);
  oauth2.setCredentials({ refresh_token: env.REFRESH_TOKEN });
  return oauth2;
}
