// src/config/oauth.js
// ตั้งค่าผู้ให้บริการ OAuth — อ่าน client id/secret จาก env
//
// วิธีขอ credentials:
//   Google : console.cloud.google.com -> APIs & Services -> Credentials
//            -> Create OAuth client ID -> Web application
//            Authorized redirect URI: <APP_URL>/api/auth/google/callback
//   GitHub : github.com/settings/developers -> New OAuth App
//            Authorization callback URL: <APP_URL>/api/auth/github/callback
//   Discord: discord.com/developers/applications -> New Application
//            -> OAuth2 -> Redirects: <APP_URL>/api/auth/discord/callback
//
// ผู้ให้บริการที่ไม่ได้ตั้ง env ไว้จะถูกปิดอัตโนมัติ (ปุ่มบนหน้า sign-in หายไป)

const APP_URL = process.env.APP_URL || 'http://localhost:6002';

const callbackUrl = (provider) => `${APP_URL}/api/auth/${provider}/callback`;

const providers = {
  google: {
    name: 'google',
    label: 'Google',
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    scope: 'openid email profile',
  },
  github: {
    name: 'github',
    label: 'GitHub',
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    // ต้องขอ user:email เพราะ /user อาจไม่คืน email ถ้าผู้ใช้ตั้งเป็นส่วนตัว
    scope: 'read:user user:email',
  },
  discord: {
    name: 'discord',
    label: 'Discord',
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    authorizeUrl: 'https://discord.com/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
    userInfoUrl: 'https://discord.com/api/users/@me',
    // identify = id/username/avatar, email = อีเมล (ต้องขอแยก)
    scope: 'identify email',
  },
};

// ผู้ให้บริการที่ตั้งค่าครบเท่านั้นถึงใช้งานได้
const isConfigured = (p) => Boolean(p.clientId && p.clientSecret);

const enabledProviders = () =>
  Object.values(providers).filter(isConfigured).map((p) => ({
    name: p.name,
    label: p.label,
  }));

const getProvider = (name) => {
  const p = providers[name];
  return p && isConfigured(p) ? p : null;
};

module.exports = { providers, getProvider, enabledProviders, callbackUrl, APP_URL };
