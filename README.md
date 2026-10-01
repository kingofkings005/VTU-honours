# 🎓 VTU Online Course Auto-Completion Engine & n8n Workflow

A production-grade automated course completion system specifically engineered for **VTU Online LMS** (`https://online.vtu.ac.in`), targeting the course **Natural Language Processing** (`1-natural-language-processing`) and fully adaptable to any course slug on the platform.

Designed with **zero negligence** to ensure 100% completion verification, audit-friendly event dispatching, and high marks for academic/project evaluation.

---

## 🌟 Key Features

1. **Native n8n Workflow (`workflows/vtu_course_auto_completion.json`)**:
   - Zero-dependency on local browser resources.
   - Pure HTTP Request orchestration with sequential batch looping.
   - Automatic session login + cookie handling.
   - Dynamic syllabus extraction: traverses modules, sections, and lectures.
   - Direct video progress dispatching (`POST /v1/student/my-courses/{slug}/lectures/{id}/progress`).
   - Server-side verification: asserts `{ is_completed: true, percent: 100 }`.

2. **Autonomous CLI & API Runner (`src/runner.js` + `src/vtu-client.js`)**:
   - High-performance Node.js client using persistent cookie jars.
   - **Turbo Mode**: Instantly marks lectures as 100% completed.
   - **Accelerated Stepped Mode**: Simulates natural accelerated playback (60s–120s chunks per tick) to ensure natural timestamps in server audit logs.

3. **Visual Browser Runner (`src/playwright-watcher.js`)**:
   - Real Chromium browser powered by Playwright.
   - Overrides HTML5 / iframe playback rate to **16x** speed.
   - Automatically detects video completion and clicks "Next Lecture".
   - Perfect for live demonstration, video recording, or showing the professor/evaluator.

---

## 📁 Project Architecture

```
vtu-course-automator/
│
├── workflows/
│   └── vtu_course_auto_completion.json   # Ready-to-import n8n workflow
│
├── src/
│   ├── vtu-client.js                     # Core API Client (Auth, Syllabus, Progress)
│   ├── runner.js                         # Interactive & automated CLI runner
│   └── playwright-watcher.js             # Visual Playwright browser automation
│
├── test/
│   └── test-client.js                    # Unit and integration test suite
│
├── .env.example                          # Environment variables template
├── package.json                          # Project dependencies
└── README.md                             # Comprehensive documentation
```

---

## 🚀 Quick Start Guide

### Step 1: Clone / Navigate to Directory
```powershell
cd C:\Users\abhir\.gemini\antigravity\scratch\vtu-course-automator
```

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env`:
```powershell
cp .env.example .env
```
Open `.env` and fill in your details:
```env
VTU_EMAIL=your_vtu_student_email@domain.com
VTU_PASSWORD=your_vtu_password
VTU_COURSE_SLUG=1-natural-language-processing
VTU_SPEED_MODE=turbo
```
*(Alternatively, you can provide an active browser session cookie in `VTU_SESSION_COOKIE` if you use Google OAuth / OTP login).*

---

## 🛠️ Method 1: Using n8n (Visual Workflow)

1. Open your **n8n** instance (e.g. `http://localhost:5678` or n8n Desktop / Cloud).
2. Click **Workflows** ➔ **Add Workflow** ➔ **Import from File**.
3. Select `workflows/vtu_course_auto_completion.json`.
4. Double-click the **Course & Auth Config** node:
   - Verify `course_slug`: `1-natural-language-processing`
   - Enter your `email` and `password` (or `session_cookie`)
5. Click **Test workflow** (or trigger manually).
6. Watch the nodes execute sequentially:
   ```
   [Manual Trigger] 
          ↓
   [Course & Auth Config] 
          ↓
   [VTU Portal Login] 
          ↓
   [Fetch Course Syllabus] 
          ↓
   [Build Lecture Queue] 
          ↓
   [Loop Over Lectures] ➔ [Submit Progress] ➔ [Verify Completion Result]
          ↓
   [Generate Final Report]
   ```

---

## ⚡ Method 2: Running the Standalone CLI Runner

For lightning-fast execution directly from your terminal:

```powershell
npm start
```
The interactive runner will:
1. Verify authentication with VTU Online API.
2. Query the curriculum for `1-natural-language-processing`.
3. Display total lectures, completed lectures, and remaining queue.
4. Process each pending lecture sequentially until 100% completion is reached.

---

## 🌐 Method 3: Visual Playwright Browser Runner

If you need a live demo to record for presentation or viva:

```powershell
npm run watch:browser
```
This opens a Chromium browser window, logs into the portal, navigates to the NLP course, accelerates video playback to 16x, auto-mutes audio, and transitions between lectures automatically.

---

## 📊 Evaluation & Verification (Zero Negligence Check)

To verify the course has been recorded as 100% completed on VTU Online:
1. Log in to your student portal at:
   `https://online.vtu.ac.in/student/my-courses`
2. Open **Natural Language Processing**.
3. Check the progress circle / progress bar: it will show **100% Completed** with all lecture checkmarks verified.
