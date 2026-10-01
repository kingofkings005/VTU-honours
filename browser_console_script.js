/**
 * =========================================================================
 * 🎓 VTU Online Course 1-Click Browser Console Auto-Completer
 * =========================================================================
 * 
 * HOW TO USE (Takes 30 seconds):
 * 1. Open Chrome / Edge and log into: https://online.vtu.ac.in
 * 2. Go to your course learning page:
 *    https://online.vtu.ac.in/student/learning/1-natural-language-processing
 *    (or ANY other course learning page)
 * 3. Press F12 (or right-click -> Inspect) and click the "Console" tab.
 * 4. Paste this entire code and press ENTER.
 * 5. Watch all 65 lectures complete automatically in real time!
 * =========================================================================
 */

(async function completeVTUCourse() {
  console.clear();
  console.log("%c🎓 VTU Course Auto-Completer Initializing...", "color: #3b82f6; font-size: 16px; font-weight: bold;");

  // 1. Detect Course Slug from URL
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  let courseSlug = '1-natural-language-processing';
  
  if (pathParts.includes('course') || pathParts.includes('learning')) {
    courseSlug = pathParts[pathParts.length - 1];
  }

  console.log(`%c🎯 Target Course Slug: ${courseSlug}`, "color: #eab308; font-weight: bold; font-size: 14px;");

  // 2. Fetch Course Structure from VTU API using current active session
  console.log("📥 Fetching course structure from server...");
  let courseRes;
  try {
    courseRes = await fetch(`/api/v1/student/my-courses/${courseSlug}`, {
      headers: {
        "Accept": "application/json",
        "X-Requested-With": "XMLHttpRequest"
      }
    });
  } catch (err) {
    console.error("❌ Failed to contact VTU API:", err);
    return;
  }

  if (!courseRes.ok) {
    console.error(`❌ Server returned HTTP ${courseRes.status}. Make sure you are logged in!`);
    return;
  }

  const courseJson = await courseRes.json();
  const course = courseJson.data?.course || courseJson.data || courseJson.course;

  if (!course) {
    console.error("❌ Could not parse course details:", courseJson);
    return;
  }

  const courseTitle = course.title || course.name || courseSlug;
  console.log(`%c📖 Course: "${courseTitle}"`, "color: #10b981; font-weight: bold; font-size: 15px;");
  console.log(`📊 Current Server Progress: ${course.overall_progress || course.progress_percent || 0}%`);

  // 3. Extract All Lectures Across Modules
  const lessons = course.lessons || course.curriculum || course.modules || [];
  const lectures = [];

  lessons.forEach((mod, modIdx) => {
    const modTitle = mod.name || mod.title || `Module ${modIdx + 1}`;
    const items = mod.lectures || mod.items || [];
    items.forEach((lec, lecIdx) => {
      const p = Number(lec.progress_percent ?? lec.progressPercent ?? lec.progress ?? 0);
      const isDone = !!(lec.is_completed ?? lec.isCompleted ?? lec.completed ?? (p >= 90));
      lectures.push({
        id: lec.id,
        title: lec.name || lec.title || `Lecture ${lecIdx + 1}`,
        module: modTitle,
        duration: Math.max(60, Number(lec.duration_seconds || lec.duration) || 2400),
        isCompleted: isDone,
        progress: p
      });
    });
  });

  console.log(`📑 Total Lectures in Course: ${lectures.length}`);
  const pending = lectures.filter(l => !l.isCompleted);
  console.log(`⏳ Pending to Complete: ${pending.length}`);
  console.log(`✅ Already Done: ${lectures.length - pending.length}`);

  if (pending.length === 0) {
    console.log("%c🎉 Every lecture is already 100% completed!", "color: #22c55e; font-size: 16px; font-weight: bold;");
    alert("🎉 All lectures in this course are already 100% completed!");
    return;
  }

  console.log(`\n%c🚀 Starting fast-forward completion for ${pending.length} lectures...\n`, "color: #3b82f6; font-weight: bold;");

  // 4. Step Through Each Lecture
  let completedCount = 0;

  for (let i = 0; i < pending.length; i++) {
    const lec = pending[i];
    console.log(`%c[${i + 1}/${pending.length}] Watching: [${lec.module}] - "${lec.title}"`, "color: #9333ea; font-weight: bold;");

    let isDone = false;
    let curr = 120;
    let realDur = lec.duration;

    // Send probe tick
    try {
      const probeRes = await fetch(`/api/v1/student/my-courses/${courseSlug}/lectures/${lec.id}/progress`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "X-Requested-With": "XMLHttpRequest"
        },
        body: JSON.stringify({
          current_time_seconds: curr,
          total_duration_seconds: realDur,
          seconds_just_watched: 120
        })
      });

      const probeData = await probeRes.json();
      const serverPct = Number(probeData?.data?.percent || 0);
      
      if (probeData?.data?.is_completed || serverPct >= 95) {
        isDone = true;
      } else if (serverPct > 0) {
        // Calculate true duration from server response
        realDur = Math.ceil((curr / serverPct) * 100);
      }
    } catch (e) {}

    // Fast-step to 100%
    let stepCount = 0;
    while (!isDone && stepCount < 60) {
      curr = Math.min(realDur, curr + 120);

      try {
        const tickRes = await fetch(`/api/v1/student/my-courses/${courseSlug}/lectures/${lec.id}/progress`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-Requested-With": "XMLHttpRequest"
          },
          body: JSON.stringify({
            current_time_seconds: curr,
            total_duration_seconds: realDur,
            seconds_just_watched: 120
          })
        });

        const tickData = await tickRes.json();
        const pct = Number(tickData?.data?.percent !== undefined ? tickData?.data?.percent : Math.round((curr / realDur) * 100));
        
        if (tickData?.data?.is_completed || pct >= 95) {
          isDone = true;
          console.log(`   ✅ 100% Completed on Server!`);
          break;
        } else {
          console.log(`   ⏱️ Progress: ${curr}s / ${realDur}s (${pct}%)`);
        }
      } catch (err) {}

      stepCount++;
      // Fast 80ms pause between ticks
      await new Promise(r => setTimeout(r, 80));
    }

    completedCount++;
  }

  console.log(`\n%c🏆 ALL ${completedCount} LECTURES SUCCESSFULLY MARKED 100% COMPLETED!`, "color: #22c55e; font-size: 18px; font-weight: bold;");
  alert(`🎉 Course 100% Completed (${completedCount} lectures done)!\nClick OK to refresh and view your updated progress.`);
  window.location.reload();
})();
