require('dotenv').config();
const readline = require('readline');
const VTUClient = require('./vtu-client');

function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(question, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

async function main() {
  console.log(`
======================================================
🎓 VTU ONLINE COURSE AUTO-COMPLETION SYSTEM
======================================================
Target Platform: https://online.vtu.ac.in
`);

  let email = process.env.VTU_EMAIL;
  let password = process.env.VTU_PASSWORD;
  let sessionCookie = process.env.VTU_SESSION_COOKIE;
  let defaultCourse = process.env.VTU_COURSE_SLUG || '1-natural-language-processing';

  // If credentials are not configured in .env, prompt interactively
  if (!sessionCookie && (!email || !password || email.includes('example.com'))) {
    console.log(`🔑 Authentication required:`);
    console.log(`1) Login with Email & Password`);
    console.log(`2) Enter Session Cookie / Token\n`);
    
    const choice = await prompt(`Choose option (1 or 2, default: 1): `) || '1';

    if (choice === '2') {
      sessionCookie = await prompt(`Paste Session Cookie: `);
    } else {
      email = await prompt(`VTU Student Email: `);
      password = await prompt(`VTU Password: `);
    }
  }

  const client = new VTUClient({ sessionCookie });

  try {
    // 1. Authenticate
    if (sessionCookie) {
      console.log(`🍪 Initialized with session cookie.`);
    } else if (email && password) {
      await client.login(email, password);
    } else {
      throw new Error('No authentication method provided.');
    }

    // 2. Fetch Profile
    try {
      const profile = await client.getProfile();
      const pName = profile?.name || profile?.user?.name || profile?.email || 'Student';
      console.log(`👤 Active Student: ${pName}`);
    } catch (e) {
      console.log(`ℹ️ Session established.`);
    }

    // 3. Fetch Enrolled Courses
    console.log(`\n🔍 Checking enrolled courses...`);
    const enrollments = await client.getEnrollments();
    
    let targetSlug = defaultCourse;

    if (enrollments && enrollments.length > 0) {
      console.log(`\n📚 Your Enrolled Courses:`);
      enrollments.forEach((c, idx) => {
        console.log(`  [${idx + 1}] ${c.title} (Progress: ${c.progress}%) -> slug: ${c.slug}`);
      });
      console.log(`  [C] Enter custom course URL or Slug`);

      const choice = await prompt(`\nSelect course number [1-${enrollments.length}] or press Enter for default (${defaultCourse}): `);
      
      if (choice && choice.toUpperCase() !== 'C') {
        const selectedIdx = parseInt(choice, 10) - 1;
        if (!isNaN(selectedIdx) && enrollments[selectedIdx]) {
          targetSlug = enrollments[selectedIdx].slug;
        } else if (choice.trim().length > 0) {
          targetSlug = VTUClient.parseCourseSlug(choice);
        }
      } else if (choice.toUpperCase() === 'C') {
        const customInput = await prompt(`Enter Course URL or Slug: `);
        if (customInput) {
          targetSlug = VTUClient.parseCourseSlug(customInput);
        }
      }
    } else {
      console.log(`ℹ️ Using configured course: ${targetSlug}`);
      const opt = await prompt(`Press Enter to continue with "${targetSlug}" or type another course slug/URL: `);
      if (opt && opt.trim()) {
        targetSlug = VTUClient.parseCourseSlug(opt);
      }
    }

    console.log(`\n🎯 Target Course Slug: "${targetSlug}"`);

    // 4. Fetch Course Curriculum
    const courseResponse = await client.getCourseDetails(targetSlug);
    const courseData = courseResponse.data?.course || courseResponse.data || courseResponse;
    
    const courseTitle = courseData.title || courseData.name || targetSlug;
    const initialProgress = courseData.overall_progress || courseData.progress_percent || courseData.progress || 0;
    
    console.log(`📖 Course: "${courseTitle}"`);
    console.log(`📊 Current Server Progress: ${initialProgress}%`);

    // 5. Extract Lectures
    const lectures = client.extractLectures(courseResponse);
    console.log(`📑 Total Lectures Discovered: ${lectures.length}`);

    if (lectures.length === 0) {
      console.log(`\n⚠️ Warning: No lectures found using default parser.`);
      console.log(`Raw course keys:`, Object.keys(courseData));
      if (courseData.lessons) {
        console.log(`course.lessons length:`, courseData.lessons.length);
      }
      return;
    }

    // List all lectures with status
    console.log(`\n--- Course Syllabus Overview ---`);
    lectures.forEach((lec, idx) => {
      const statusIcon = lec.isCompleted ? '✅' : '⏳';
      console.log(`  ${statusIcon} [${idx + 1}] [${lec.moduleName}] ${lec.title} (Duration: ${lec.duration}s, Progress: ${lec.progressPercent}%)`);
    });

    const pendingLectures = lectures.filter(l => !l.isCompleted);
    console.log(`\n📊 Status Summary: ${lectures.length - pendingLectures.length}/${lectures.length} completed.`);
    console.log(`⏳ Remaining to watch: ${pendingLectures.length} lectures.`);

    if (pendingLectures.length === 0) {
      console.log(`\n🎉 Every lecture in this course is already marked 100% completed!`);
      const rewatch = await prompt(`Do you want to re-watch / re-mark all lectures anyway? (y/N): `);
      if (rewatch.toLowerCase() !== 'y') {
        console.log(`Exiting. Have a great day!`);
        return;
      }
      // If user forces re-watch:
      pendingLectures.push(...lectures);
    }

    // 6. Execute Course Auto-Watcher
    console.log(`\n🚀 Starting Automated Playback for ${pendingLectures.length} lectures...\n`);
    let completedCount = 0;

    for (let i = 0; i < pendingLectures.length; i++) {
      const lecture = pendingLectures[i];
      console.log(`======================================================`);
      console.log(`Processing: [${i + 1}/${pendingLectures.length}] - Overall: ${Math.round((i / pendingLectures.length) * 100)}%`);

      const result = await client.completeLecture(targetSlug, lecture, 120);
      if (result?.completed) completedCount++;

      // Pause briefly between lectures
      await new Promise(r => setTimeout(r, 400));
    }

    console.log(`\n======================================================`);
    console.log(`🎯 SUCCESSFULLY COMPLETED ${completedCount}/${pendingLectures.length} LECTURES!`);
    
    // Verify updated progress on server
    try {
      const updatedRes = await client.getCourseDetails(targetSlug);
      const updatedData = updatedRes.data?.course || updatedRes.data || updatedRes;
      const finalProgress = updatedData.overall_progress ?? updatedData.progress_percent ?? '0';
      console.log(`🏆 Verified Course Progress on VTU Server: ${finalProgress}%`);
    } catch {}
    console.log(`======================================================\n`);

  } catch (error) {
    console.error(`\n❌ Error occurred:`, error.message);
    if (error.response?.data) {
      console.error(`Response details:`, error.response.data);
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
