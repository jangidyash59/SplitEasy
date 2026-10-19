# ✂️ SplitEasy

> **Production-ready Splitwise alternative** powered by MERN, Upstash Redis, Google Gemini 3.8 Flash AI, and Socket.IO. Features **Greedy Min Cash Flow debt simplification**, **Observer pattern real-time alerts**, **Strategy-driven expense splitting**, and a **Single Point of Net Settlement** across all shared groups and direct peer payments.

---

## 🌟 Key Features

- **⚡ Single Point of Net Settlement:** Friends section unifies debts across all shared groups AND individual peer splits into one single absolute net balance with 1-click settlement.
- **🏠 Group-Scoped Expense Pools:** Dedicated group ledgers where members can track group expenses independently.
- **🧠 Greedy Minimum Cash Flow Algorithm:** Reduces N-way debt webs into the minimum number of transactions possible.
- **🧾 AI Receipt & Payment Screenshot Scanning:** Integrated with Google Gemini 3.8 Flash to automatically extract line items, merchant, tax, and total amount.
- **🔌 Real-Time Observer Pattern (Socket.IO):** Instant live updates when expenses or settlements are recorded without page refresh.
- **📧 Automated Email Notifications:** Sends confirmation receipts and settlement alerts with breakdown details.
- **🔒 Distributed Locking:** Powered by Upstash Redis to prevent race conditions during concurrent settlements.

---

## 🏗️ Architecture & Design Patterns

| Pattern / Component | Purpose & Implementation |
|---|---|
| **Strategy & Factory Pattern** | `splitCalculator.js` dynamically executes `EQUAL`, `EXACT`, or `PERCENTAGE` splits without conditional bloat. |
| **Observer Pattern** | Socket.IO rooms broadcast group and peer expense events to all active members in real-time. |
| **Greedy Min Cash Flow** | `debtSimplifier.js` computes net balances and iteratively settles the maximum creditor with the maximum debtor. |
| **Concurrency Control** | Upstash Redis distributed lock (`SET ... NX EX`) and MongoDB replica set multi-document ACID transactions. |

---

## 🚀 Deployment Guide

### 1. Deploy Backend to Render.com (Free Tier)

1. Go to [Render Dashboard](https://dashboard.render.com/) and click **New +** → **Web Service**.
2. Connect your GitHub repository: `https://github.com/jangidyash59/SplitEasy`.
3. Configure the service settings:
   - **Name:** `spliteasy-backend`
   - **Region:** Any (e.g., Oregon / Singapore / Frankfurt)
   - **Root Directory:** `backend`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Instance Type:** `Free`
4. In the **Environment Variables** section, add:
   ```env
   NODE_ENV=production
   PORT=5000
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.ae8hyei.mongodb.net/spliteasy?retryWrites=true&w=majority
   JWT_SECRET=your_jwt_secret_key_here
   UPSTASH_REDIS_REST_URL=https://relative-leech-143103.upstash.io
   UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token
   GEMINI_API_KEY=your_google_gemini_api_key
   CLIENT_URL=https://your-spliteasy-frontend.vercel.app
   ```
5. Click **Create Web Service**. Once deployed, copy your Render backend URL (e.g., `https://spliteasy-backend-xxxx.onrender.com`).

---

### 2. Deploy Frontend to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard) and click **Add New…** → **Project**.
2. Import the repository: `jangidyash59/SplitEasy`.
3. Configure the project:
   - **Framework Preset:** `Vite`
   - **Root Directory:** Click Edit and select `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Expand **Environment Variables** and add:
   ```env
   VITE_API_URL=https://your-spliteasy-backend-xxxx.onrender.com
   VITE_SOCKET_URL=https://your-spliteasy-backend-xxxx.onrender.com
   ```
5. Click **Deploy**.
6. *(Optional)* Go back to Render backend environment variables and set `CLIENT_URL` to your live Vercel domain (e.g., `https://spliteasy.vercel.app`).

---

## 💻 Local Development Setup

### Prerequisites
- Node.js >= 18.0.0
- MongoDB Atlas or local MongoDB instance
- Upstash Redis database (free tier)

### 1. Clone repository
```bash
git clone https://github.com/jangidyash59/SplitEasy.git
cd SplitEasy
```

### 2. Backend Setup
```bash
cd backend
cp .env.example .env
# Edit .env with your credentials
npm install
npm run dev
```

### 3. Frontend Setup
```bash
cd ../frontend
cp .env.example .env
# Set VITE_API_URL=http://localhost:5000
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📄 License
MIT © Yash Jangid
