# 🎓 VTU Online Course Auto-Completion Engine & n8n Workflow

A production-grade automated course completion system engineered for the **VTU Online LMS** (`https://online.vtu.ac.in`). Designed to work with any enrolled course on the platform using automated API request orchestration, an n8n visual workflow, or browser-based visual simulation.

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
   - Overrides HTML5 / iframe playback rate up to **16x** speed.
   - Automatically detects video completion and advances to the next lecture.
   - Ideal for live demonstrations, presentation recordings, and visual verification.

---

## 📁 Project Architecture

```
VTU-honours/
├── workflows/
│   └── vtu_course_auto_completion.json   # Ready-to-import n8n workflow
├── src/
│   ├── vtu-client.js                     # Core API Client (Auth, Syllabus, Progress)
│   ├── runner.js                         # Interactive & automated CLI runner
│   └── playwright-watcher.js             # Visual Playwright browser automation
├── test/
│   └── test-client.js                    # Unit and integration test suite
├── .env.example                          # Environment variables template
├── package.json                          # Project dependencies
└── README.md                             # Documentation
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- *(Optional)* **n8n** (Desktop or self-hosted) if using visual workflows

### 1. Clone the Repository

```bash
git clone https://github.com/kingofkings005/VTU-honours.git
cd VTU-honours
```

### 2. Install Dependencies

```bash
npm install
```

If you plan to use the browser-based watcher (Playwright), install browser binaries:
```bash
npx playwright install chromium
```

### 3. Configure Environment Variables

Create your local `.env` file from the example template:

```bash
# On Windows (PowerShell):
copy .env.example .env

# On Linux / macOS:
cp .env.example .env
```

Open `.env` in any text editor and fill in your credentials:

```env
# Your VTU Online portal credentials
VTU_EMAIL=your_student_email@domain.com
VTU_PASSWORD=your_portal_password

# Course slug from the URL (e.g., https://online.vtu.ac.in/student/my-courses/<slug>)
VTU_COURSE_SLUG=1-natural-language-processing

# Execution mode: turbo | stepped
VTU_SPEED_MODE=turbo
```

> **Note**: If your account uses Google OAuth or OTP login, you can paste your active browser session cookie into `VTU_SESSION_COOKIE` in `.env`.

---

## 🛠️ Usage Methods

### Method 1: Standalone CLI Runner (Fastest & Simplest)

Run the automated CLI runner directly from your terminal:

```bash
npm start
```

The runner will:
1. Authenticate with the VTU Online API.
2. Query your course curriculum and calculate completed vs. remaining lectures.
3. Sequentially dispatch verified progress ticks until the course reaches 100%.

---

### Method 2: Visual Browser Runner (Playwright)

For live demonstrations, recording video proof, or showing course progress in real-time:

```bash
npm run watch:browser
```

This launches a Chromium browser window, navigates to your enrolled course, accelerates playback speed, and automatically clicks through subsequent lectures upon completion.

---

### Method 3: Visual n8n Workflow

1. Open your **n8n** instance (e.g. `http://localhost:5678`).
2. Go to **Workflows** ➔ **Add Workflow** ➔ **Import from File**.
3. Select `workflows/vtu_course_auto_completion.json`.
4. Double-click the **Course & Auth Config** node to set your `course_slug`, `email`, and `password`.
5. Click **Test workflow** / **Execute**.

Execution flow:
```
[Manual Trigger] ➔ [Course & Auth Config] ➔ [VTU Portal Login]
                         ↓
             [Fetch Course Syllabus]
                         ↓
               [Build Lecture Queue]
                         ↓
  [Loop Over Lectures] ➔ [Submit Progress] ➔ [Verify Completion]
                         ↓
               [Generate Report]
```

---

## 📊 Verification

To verify completion on the official portal:
1. Log in to [VTU Online](https://online.vtu.ac.in/student/my-courses).
2. Open the targeted course.
3. Check the progress indicator — it will show **100% Completed** with all lectures marked verified.

---

## ⚖️ Disclaimer

This software is developed strictly for educational and automation research purposes. Users are responsible for complying with the terms of service of their institution and platform.

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
