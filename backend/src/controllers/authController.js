// src/controllers/authController.js
// OAuth 2.0 authorization-code flow ทำเองตรงๆ ไม่ผ่านไลบรารี
//
// ลำดับ:
//   1) GET /api/auth/:provider           -> redirect ไปหน้า login ของ provider พร้อม state
//   2) provider เด้งกลับมาที่ /callback  -> ตรวจ state, แลก code เป็น access token
//   3) เอา token ไปดึงโปรไฟล์ -> หา/สร้างผู้ใช้ -> สร้าง session -> ตั้งคุกกี้ -> เด้งเข้าหน้าแรก

const crypto = require('crypto');
const { authModel } = require('db');
const { getProvider, enabledProviders, callbackUrl, APP_URL } = require('../config/oauth');
const { badRequest, unauthorized } = require('../utils/HttpError');

const SESSION_COOKIE = 'pf_session';
const STATE_COOKIE = 'pf_oauth_state';
const IS_PROD = process.env.NODE_ENV === 'production';

// คุกกี้ session: httpOnly กัน JS อ่าน, sameSite=lax ให้รอดตอน provider redirect กลับมา
const sessionCookieOptions = (expiresAt) => ({
  httpOnly: true,
  sameSite: 'lax',
  // ตั้ง secure เฉพาะตอนรันจริงบน https ไม่งั้น localhost จะใช้ไม่ได้
  secure: IS_PROD && APP_URL.startsWith('https://'),
  path: '/',
  expires: expiresAt,
});

const authController = {
  // GET /api/auth/providers — ให้หน้า sign-in รู้ว่ามีปุ่มอะไรให้กดบ้าง
  providers(req, res) {
    res.json({ providers: enabledProviders() });
  },

  // GET /api/auth/:provider
  start(req, res) {
    const provider = getProvider(req.params.provider);
    if (!provider) {
      throw badRequest('ยังไม่ได้ตั้งค่าการเข้าสู่ระบบด้วยช่องทางนี้');
    }

    // state กัน CSRF: สุ่มค่า เก็บไว้ในคุกกี้ แล้วเทียบตอน callback
    const state = crypto.randomBytes(16).toString('base64url');

    res.cookie(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: IS_PROD && APP_URL.startsWith('https://'),
      path: '/',
      maxAge: 10 * 60 * 1000, // 10 นาที พอสำหรับการกดล็อกอิน
    });

    const params = new URLSearchParams({
      client_id: provider.clientId,
      redirect_uri: callbackUrl(provider.name),
      response_type: 'code',
      scope: provider.scope,
      state,
    });

    res.redirect(`${provider.authorizeUrl}?${params}`);
  },

  // GET /api/auth/:provider/callback
  async callback(req, res) {
    const provider = getProvider(req.params.provider);
    if (!provider) throw badRequest('ช่องทางเข้าสู่ระบบไม่ถูกต้อง');

    const { code, state, error } = req.query;

    // ผู้ใช้กดยกเลิกที่หน้า provider
    if (error) return res.redirect(`/signin?error=${encodeURIComponent(error)}`);
    if (!code) throw badRequest('ไม่พบ code จากผู้ให้บริการ');

    // ตรวจ state ให้ตรงกับที่ออกไป
    const expectedState = req.cookies?.[STATE_COOKIE];
    if (!state || !expectedState || state !== expectedState) {
      throw unauthorized('state ไม่ถูกต้อง (อาจหมดอายุ) กรุณาลองเข้าสู่ระบบใหม่');
    }
    res.clearCookie(STATE_COOKIE, { path: '/' });

    const accessToken = await exchangeCodeForToken(provider, code);
    const profile = await fetchProfile(provider, accessToken);

    const user = await authModel.findOrCreateFromOAuth(profile);
    const { token, expiresAt } = await authModel.createSession(user.id);

    res.cookie(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
    res.redirect('/');
  },

  // POST /api/auth/logout
  async logout(req, res) {
    const token = req.cookies?.[SESSION_COOKIE];
    if (token) await authModel.deleteSession(token);

    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.status(204).end();
  },
};

// ---------- ขั้นตอนย่อยของ OAuth ----------

async function exchangeCodeForToken(provider, code) {
  const res = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      // GitHub คืน form-encoded ถ้าไม่ขอ json มา
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      code,
      redirect_uri: callbackUrl(provider.name),
      grant_type: 'authorization_code',
    }),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.access_token) {
    throw unauthorized('แลกโทเคนกับผู้ให้บริการไม่สำเร็จ');
  }

  return data.access_token;
}

async function fetchProfile(provider, accessToken) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
    'User-Agent': 'preflight-app',
  };

  const res = await fetch(provider.userInfoUrl, { headers });
  if (!res.ok) throw unauthorized('ดึงข้อมูลโปรไฟล์ไม่สำเร็จ');

  const raw = await res.json();

  if (provider.name === 'google') return googleProfile(raw);
  if (provider.name === 'discord') return discordProfile(raw);
  return githubProfile(raw, headers);
}

function googleProfile(raw) {
  // google ยืนยัน email ให้แล้วผ่าน email_verified
  if (!raw.email || raw.email_verified === false) {
    throw unauthorized('บัญชี Google นี้ยังไม่ได้ยืนยันอีเมล');
  }

  return {
    provider: 'google',
    providerAccountId: String(raw.sub),
    email: raw.email,
    fullName: raw.name || raw.email,
    avatarUrl: raw.picture || null,
  };
}

function discordProfile(raw) {
  // discord: verified = ยืนยันอีเมลแล้วหรือยัง, email อาจเป็น null ถ้าไม่ได้ให้ scope email
  if (!raw.email || raw.verified === false) {
    throw unauthorized('บัญชี Discord นี้ยังไม่ได้ยืนยันอีเมล');
  }

  // global_name คือชื่อที่แสดงในปัจจุบัน ส่วน username เป็นชื่อ handle แบบเก่า
  const fullName = raw.global_name || raw.username || raw.email;

  // avatar เป็นแค่ hash ต้องประกอบเป็น URL เอง (null ได้ถ้าใช้รูปเริ่มต้น)
  const avatarUrl = raw.avatar
    ? `https://cdn.discordapp.com/avatars/${raw.id}/${raw.avatar}.png`
    : null;

  return {
    provider: 'discord',
    providerAccountId: String(raw.id),
    email: raw.email,
    fullName,
    avatarUrl,
  };
}

async function githubProfile(raw, headers) {
  // /user คืน email เฉพาะตอนผู้ใช้ตั้งเป็นสาธารณะ จึงต้องถาม /user/emails เพิ่ม
  let email = raw.email;

  if (!email) {
    const res = await fetch('https://api.github.com/user/emails', { headers });
    if (res.ok) {
      const emails = await res.json();
      // เอาเฉพาะ email หลักที่ยืนยันแล้ว
      email = emails.find((e) => e.primary && e.verified)?.email
        ?? emails.find((e) => e.verified)?.email;
    }
  }

  if (!email) {
    throw unauthorized('ไม่พบอีเมลที่ยืนยันแล้วในบัญชี GitHub นี้');
  }

  return {
    provider: 'github',
    providerAccountId: String(raw.id),
    email,
    fullName: raw.name || raw.login,
    avatarUrl: raw.avatar_url || null,
  };
}

module.exports = authController;
module.exports.SESSION_COOKIE = SESSION_COOKIE;
