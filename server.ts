import express from "express";
import path from "path";
import { initializeApp, getApps } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { getMessaging } from "firebase-admin/messaging";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  
  app.use(express.json());
  
  // Lazy initialize Firebase Admin
  function getAdminMessaging() {
    try {
      if (!getApps().length) {
        initializeApp({
          databaseURL: "https://hss-all-in-one-default-rtdb.firebaseio.com",
          projectId: "hss-all-in-one"
        });
      }
      return {
        db: getDatabase(),
        messaging: getMessaging()
      };
    } catch (e) {
      console.warn("Firebase Admin lazy init warning:", e);
      return null;
    }
  }
  
  // Health check endpoints for Cloud Run health checks
  app.get("/health", (req, res) => {
    res.status(200).send("OK");
  });
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });
  
  // API endpoint to send secure FCM push notifications
  app.post("/api/send-fcm", async (req, res) => {
    try {
      const { schoolCode, title, body } = req.body;
      const cleanSchoolCode = (schoolCode || 'SSHSS@111213').trim().toUpperCase();
  
      if (!title || !body) {
        return res.status(400).json({ error: "Title and body are required" });
      }
  
      const adminInstance = getAdminMessaging();
      if (!adminInstance) {
        return res.json({ success: true, sentCount: 0, message: "Firebase Admin not initialized." });
      }
  
      const { db, messaging } = adminInstance;
      const tokensRef = db.ref(`fcm_tokens/${cleanSchoolCode}`);
      const snapshot = await tokensRef.once('value');
      
      const tokens: string[] = [];
      if (snapshot.exists()) {
        const usersObj = snapshot.val();
        Object.keys(usersObj).forEach(uid => {
          const userTokensObj = usersObj[uid];
          if (userTokensObj && typeof userTokensObj === 'object') {
            Object.keys(userTokensObj).forEach(tokenId => {
              const tokenData = userTokensObj[tokenId];
              if (tokenData && tokenData.token) {
                tokens.push(tokenData.token);
              }
            });
          }
        });
      }
  
      if (tokens.length > 0) {
        const message = {
          tokens,
          notification: {
            title: `📢 ${title}`,
            body: body.length > 120 ? body.substring(0, 117) + '...' : body
          },
          webpush: {
            notification: {
              icon: '/icon.png',
              click_action: '/'
            }
          },
          android: {
            notification: {
              icon: 'stock_print_preview',
              color: '#7c3aed',
              click_action: 'FLUTTER_NOTIFICATION_CLICK'
            }
          }
        };
  
        const response = await messaging.sendEachForMulticast(message);
        return res.json({ success: true, sentCount: response.successCount, failureCount: response.failureCount });
      }
  
      return res.json({ success: true, sentCount: 0, message: "No active FCM tokens found for school." });
    } catch (err: any) {
      console.error("Error sending FCM notification:", err);
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
