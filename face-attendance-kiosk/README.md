# Face Attendance Kiosk 🏋️

A standalone mobile face recognition attendance app for **Gym ERP**. Uses face-api.js + Firebase Firestore to scan and log member check-ins via camera.

## ⚡ Quick Start

### 1. Download face-api.js models (REQUIRED)

```powershell
.\download-models.ps1
```

This downloads ~6MB of AI model files to `public/models/`. Only needed once.

### 2. Configure Firebase

Open `.env` and fill in your Firebase credentials:

```env
VITE_FIREBASE_API_KEY=your_actual_api_key
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

Find these in: Firebase Console → `gum-erp-project` → Project Settings → Your Apps

The following are already set:
- `VITE_FIREBASE_AUTH_DOMAIN=gum-erp-project.firebaseapp.com`
- `VITE_FIREBASE_PROJECT_ID=gum-erp-project`
- `VITE_FIREBASE_DATABASE_URL=https://gum-erp-project-default-rtdb.firebaseio.com`

### 3. Install dependencies

```bash
npm install
```

### 4. Run the dev server

```bash
npm run dev
```

Open on your Android phone at `http://<your-local-ip>:5173`

---

## App Pages

### Home Page (/)
- Start Face Attendance
- New Member Face Add

### New Member Face Add (/register)
1. Search for a member by name, code, bio ID, or mobile
2. Open camera → detect face → save face descriptor to Firestore

### Face Attendance (/attendance)
- Full-screen camera scan
- Auto-detects registered faces every 500ms
- Green box = match found
- Creates attendance record in /attendance collection
- 5-second cooldown per member

---

## Firestore Collections Used

| Collection | Access |
|---|---|
| /members | Read (search + load face descriptors) |
| /members/{id} | Write (save faceDescriptor, faceRegistered, faceRegisteredAt) |
| /attendance | Read + Write (check today + create record) |

This app does NOT touch any other collection.

---

## Project Structure

```
face-attendance-kiosk/
├── public/models/        <- face-api.js models (run download-models.ps1)
├── src/
│   ├── components/       <- FaceBox, StatusOverlay, LoadingScreen, MemberSearch
│   ├── firebase/         <- config.js
│   ├── hooks/            <- useCamera.js, useFaceApi.js
│   ├── pages/            <- HomePage, NewMemberFace, FaceAttendance
│   └── utils/            <- faceUtils.js, dateUtils.js
├── .env                  <- Firebase config (fill in API key)
├── download-models.ps1   <- Download face-api models
└── README.md
```

---

## Privacy

- No raw face images are stored
- Only 128-dimension face descriptor arrays are stored in Firestore
- Camera stream is only active while the page is open
- Stream is properly stopped when navigating away

---

## Troubleshooting

| Issue | Fix |
|---|---|
| "Failed to load face recognition models" | Run download-models.ps1 first |
| "Firebase not configured" banner | Fill in VITE_FIREBASE_API_KEY in .env |
| Camera permission denied | Allow camera in Chrome > Settings > Site Settings |
| No members showing | Check Firestore /members collection has docs |
| Face not recognized | Re-register with better lighting |
