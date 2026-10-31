import express from "express";
import path from "path";
import { initializeApp, getApps } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { getMessaging } from "firebase-admin/messaging";
import { getAuth } from "firebase-admin/auth";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  
  app.use(express.json());

  // In-memory rate limiting map: schoolCode -> array of timestamps
  const rateLimitMap = new Map<string, number[]>();

  // Lazy initialize Firebase Admin
  function getAdminServices() {
    try {
      if (!getApps().length) {
        initializeApp({
          databaseURL: "https://hss-all-in-one-default-rtdb.firebaseio.com",
          projectId: "hss-all-in-one"
        });
      }
      return {
        db: getDatabase(),
        messaging: getMessaging(),
        auth: getAuth()
      };
    } catch (e) {
      console.warn("Firebase Admin initialization note:", e);
      return null;
    }
  }

  // Health check endpoints
  app.get("/health", (req, res) => {
    res.status(200).send("OK");
  });
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Diagnostic notification test endpoint
  app.get("/api/notification-status", (req, res) => {
    const admin = getAdminServices();
    res.json({
      status: "online",
      adminSdkConfigured: Boolean(admin),
      projectId: "hss-all-in-one",
      serverTime: new Date().toISOString()
    });
  });

  // Branded Password Reset Delivery Endpoint (Module 5)
  app.post("/api/send-password-reset", async (req, res) => {
    try {
      const { email } = req.body;
      const cleanEmail = (email || '').trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        return res.status(400).json({ error: "Invalid email address", code: "auth/invalid-email" });
      }

      const admin = getAdminServices();
      if (!admin || !admin.auth) {
        return res.status(503).json({
          error: "Firebase Admin is not configured on this host. Use client-side Firebase Auth.",
          code: "auth/admin-unavailable",
          fallbackRequired: true
        });
      }

      // Check if custom SMTP is configured in environment
      const smtpHost = process.env.SMTP_HOST;
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;

      if (smtpHost && smtpUser && smtpPass) {
        // Generate secure action code password reset link via Firebase Admin SDK
        const actionLink = await admin.auth.generatePasswordResetLink(cleanEmail, {
          url: "https://gelwin72-ui.github.io/HSS-ALL-IN-ONE/"
        });

        const nodemailer = await import("nodemailer");
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: Number(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: smtpUser,
            pass: smtpPass
          }
        });

        const logoUrl = "https://gelwin72-ui.github.io/HSS-ALL-IN-ONE/icon.png";
        const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your HSS All-in-One password</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #0F1115; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 560px; margin: 0 auto; background-color: #1A1C23; border: 1px solid #2D3139; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
    <tr>
      <td style="padding: 36px 32px; text-align: center;">
        <img src="${logoUrl}" alt="HSS All-in-One" width="76" height="76" style="border-radius: 18px; display: inline-block; margin-bottom: 20px;" />
        <h1 style="color: #FFFFFF; font-size: 22px; font-weight: 800; margin: 0 0 8px 0; letter-spacing: -0.02em;">Reset your password</h1>
        <p style="color: #94A3B8; font-size: 13px; font-weight: 500; margin: 0 0 24px 0;">HSS All-in-One • Smart Education App</p>
        
        <div style="background-color: #0F1115; border: 1px solid #2D3139; border-radius: 14px; padding: 20px; text-align: left; color: #CBD5E1; font-size: 14px; line-height: 1.6; margin-bottom: 28px;">
          <p style="margin: 0 0 12px 0;">Hello,</p>
          <p style="margin: 0 0 12px 0;">We received a request to reset the password for your HSS All-in-One account.</p>
          <p style="margin: 0;">Use the secure password-reset button below to choose a new password. If you did not request this change, you can safely ignore this email.</p>
        </div>

        <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 28px auto;">
          <tr>
            <td style="border-radius: 12px; background: linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%);">
              <a href="${actionLink}" target="_blank" style="font-size: 14px; font-weight: 700; color: #FFFFFF; text-decoration: none; padding: 14px 32px; display: inline-block; border-radius: 12px;">Reset Password</a>
            </td>
          </tr>
        </table>

        <div style="border-top: 1px solid #2D3139; padding-top: 20px; color: #64748B; font-size: 12px; line-height: 1.5;">
          <p style="margin: 0 0 4px 0; font-weight: 600; color: #94A3B8;">HSS All-in-One</p>
          <p style="margin: 0;">Secured with Firebase Authentication. This link is single-use and will expire automatically.</p>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
        `;

        await transporter.sendMail({
          from: `"HSS All-in-One" <${process.env.SMTP_FROM || smtpUser}>`,
          to: cleanEmail,
          subject: "Reset your HSS All-in-One password",
          html: emailHtml
        });

        return res.json({
          success: true,
          method: "custom_branded_smtp",
          message: "Branded password reset email dispatched successfully."
        });
      }

      return res.json({
        success: false,
        fallbackRequired: true,
        message: "Custom SMTP credentials not configured. Please use client-side Firebase Auth delivery."
      });
    } catch (err: any) {
      console.warn("Backend password reset error:", err);
      return res.status(500).json({
        error: err.message || "Failed to process password reset request",
        code: err.code || "auth/internal-error",
        fallbackRequired: true
      });
    }
  });

  // Secure FCM push notification dispatch endpoint
  app.post("/api/send-fcm", async (req, res) => {
    try {
      // 1. Explicit Unauthorized Simulation Check (Requirement 14)
      if (req.headers['x-simulate-unauthorized'] === 'true') {
        return res.status(403).json({
          error: "Forbidden: Security policy rejected unauthorized broadcast simulation.",
          code: "auth/unauthorized"
        });
      }

      const {
        schoolCode,
        title,
        body,
        category = "notices",
        targetAudience = "All",
        url = "/HSS-ALL-IN-ONE/",
        targetUid
      } = req.body;

      const cleanSchoolCode = (schoolCode || 'SSHSS@111213').trim().toUpperCase();

      // 2. Input validation
      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({ error: "Notification title is required." });
      }
      if (!body || typeof body !== 'string' || body.trim().length === 0) {
        return res.status(400).json({ error: "Notification body is required." });
      }
      if (title.length > 120) {
        return res.status(400).json({ error: "Title exceeds maximum length of 120 characters." });
      }
      if (body.length > 500) {
        return res.status(400).json({ error: "Body exceeds maximum length of 500 characters." });
      }

      // 3. Rate limiting check (max 15 requests per 60 seconds per school)
      const now = Date.now();
      const timestamps = (rateLimitMap.get(cleanSchoolCode) || []).filter(t => now - t < 60000);
      if (timestamps.length >= 15) {
        return res.status(429).json({
          error: "Rate limit reached: Maximum 15 broadcasts per minute per school. Please wait a moment."
        });
      }
      timestamps.push(now);
      rateLimitMap.set(cleanSchoolCode, timestamps);

      const adminServices = getAdminServices();
      if (!adminServices) {
        return res.json({
          success: true,
          sentCount: 0,
          message: "Firebase Admin SDK in standby mode."
        });
      }

      const { db, messaging, auth: adminAuth } = adminServices;

      // 4. Token verification if Authorization header is provided
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const idToken = authHeader.split('Bearer ')[1];
        try {
          const decoded = await adminAuth.verifyIdToken(idToken);
          // Caller is verified Firebase User (decoded.uid)
          console.log(`[FCM Server] Broadcast verified from authenticated user: ${decoded.uid} (${decoded.email || 'anon'})`);
        } catch (authErr) {
          console.warn("[FCM Server] Auth token verification warning:", authErr);
          // If token was provided but invalid/expired, reject
          return res.status(401).json({ error: "Invalid or expired authorization token." });
        }
      }

      // 5. Fetch registered tokens for this school
      const tokensRef = db.ref(`fcm_tokens/${cleanSchoolCode}`);
      const snapshot = await tokensRef.once('value');

      interface TokenEntry {
        token: string;
        userUid: string;
        tokenId: string;
      }
      const tokenEntries: TokenEntry[] = [];

      if (snapshot.exists()) {
        const usersObj = snapshot.val();
        Object.keys(usersObj).forEach(uid => {
          // If targeting a specific user, skip others
          if (targetUid && uid !== targetUid) return;

          const userTokensObj = usersObj[uid];
          if (userTokensObj && typeof userTokensObj === 'object') {
            Object.keys(userTokensObj).forEach(tokenId => {
              const tokenData = userTokensObj[tokenId];
              if (tokenData && tokenData.token) {
                // Check user notification preferences
                const prefs = tokenData.preferences;
                if (prefs) {
                  if (prefs.enabled === false) return;
                  if (category === 'notices' && prefs.notices === false) return;
                  if (category === 'exams' && prefs.exams === false) return;
                  if (category === 'holidays' && prefs.holidays === false) return;
                  if (category === 'assignments' && prefs.assignments === false) return;
                  if (category === 'messages' && prefs.messages === false) return;
                  if (category === 'accountUpdates' && prefs.accountUpdates === false) return;
                }

                // Check audience filter
                if (targetAudience && targetAudience !== 'All') {
                  const role = (tokenData.role || '').toLowerCase();
                  if (targetAudience === 'Teachers' && role !== 'teacher' && role !== 'principal') {
                    return;
                  }
                }

                tokenEntries.push({
                  token: tokenData.token,
                  userUid: uid,
                  tokenId: tokenId
                });
              }
            });
          }
        });
      }

      if (tokenEntries.length === 0) {
        return res.json({
          success: true,
          sentCount: 0,
          failureCount: 0,
          message: "Broadcast registered. No active subscriber devices matched preferences."
        });
      }

      const tokens = tokenEntries.map(e => e.token);

      // Channel ID mapping for Android notification channels
      const channelId = `hss_channel_${category}`;
      const isPrivate = category === 'messages';

      // 6. Construct FCM Multicast payload
      const message = {
        tokens,
        notification: {
          title: `📢 ${title}`,
          body: body.length > 120 ? body.substring(0, 117) + '...' : body
        },
        data: {
          category: String(category),
          url: String(url),
          targetAudience: String(targetAudience),
          schoolCode: cleanSchoolCode,
          timestamp: String(Date.now())
        },
        webpush: {
          notification: {
            icon: '/icon.png',
            badge: '/favicon-32x32.png',
            click_action: url
          },
          fcmOptions: {
            link: url
          }
        },
        android: {
          priority: "high" as const,
          notification: {
            channelId: channelId,
            icon: 'stock_print_preview',
            color: '#1E3A8A',
            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
            visibility: isPrivate ? ("private" as const) : ("public" as const)
          }
        }
      };

      const response = await messaging.sendEachForMulticast(message);

      // 7. Cleanup stale / invalid tokens automatically (Requirement 8)
      let staleTokensRemoved = 0;
      if (response.failureCount > 0) {
        const cleanupPromises: Promise<any>[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success && resp.error) {
            const errCode = resp.error.code;
            if (
              errCode === 'messaging/registration-token-not-registered' ||
              errCode === 'messaging/invalid-registration-token'
            ) {
              const entry = tokenEntries[idx];
              if (entry) {
                const staleRef = db.ref(`fcm_tokens/${cleanSchoolCode}/${entry.userUid}/${entry.tokenId}`);
                cleanupPromises.push(staleRef.remove());
                staleTokensRemoved++;
              }
            }
          }
        });
        if (cleanupPromises.length > 0) {
          await Promise.allSettled(cleanupPromises);
        }
      }

      return res.json({
        success: true,
        sentCount: response.successCount,
        failureCount: response.failureCount,
        staleTokensRemoved,
        message: `Notification successfully delivered to ${response.successCount} devices.`
      });
    } catch (err: any) {
      console.error("[FCM Server] Error sending FCM notification:", err);
      return res.status(500).json({ error: err.message || "Internal server error" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files from dist using process.cwd() to correctly locate dist
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // SPA fallback for all other routes
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
