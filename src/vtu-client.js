const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');

class VTUClient {
  constructor(options = {}) {
    this.apiBase = options.apiBase || 'https://online.vtu.ac.in/api';
    this.frontendBase = options.frontendBase || 'https://online.vtu.ac.in';
    this.jar = new CookieJar();
    
    this.client = wrapper(
      axios.create({
        baseURL: this.apiBase,
        jar: this.jar,
        withCredentials: true,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Origin': this.frontendBase,
          'Referer': `${this.frontendBase}/`
        },
        timeout: 30000
      })
    );

    if (options.sessionCookie) {
      this.setCookieString(options.sessionCookie);
    }
  }

  setCookieString(cookieStr) {
    if (!cookieStr) return;
    const parts = cookieStr.split(';');
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed) {
        try {
          this.jar.setCookieSync(trimmed, this.apiBase);
          this.jar.setCookieSync(trimmed, this.frontendBase);
        } catch (e) {
          // ignore individual cookie parse issues
        }
      }
    }
  }

  /**
   * Helper to parse slug from course URL or raw slug string
   * @param {string} input 
   */
  static parseCourseSlug(input) {
    if (!input) return '1-natural-language-processing';
    let str = input.trim();
    
    // Remove query params or trailing slash
    str = str.split('?')[0].replace(/\/+$/, '');
    
    // If it's a URL, extract the last segment
    if (str.includes('/')) {
      const parts = str.split('/');
      return parts[parts.length - 1];
    }
    return str;
  }

  /**
   * Log into VTU Online Portal
   * @param {string} email 
   * @param {string} password 
   */
  async login(email, password) {
    console.log(`🔐 [VTUClient] Authenticating with email: ${email}...`);
    try {
      const response = await this.client.post('/v1/auth/login', {
        email,
        password
      });

      if (response.data && (response.data.success || response.status === 200)) {
        console.log(`✅ [VTUClient] Login successful!`);
        return response.data;
      } else {
        throw new Error(response.data?.message || 'Login failed');
      }
    } catch (error) {
      const msg = error.response?.data?.message || error.message;
      console.error(`❌ [VTUClient] Login error: ${msg}`);
      throw new Error(`VTU Authentication failed: ${msg}`);
    }
  }

  /**
   * Fetch student profile
   */
  async getProfile() {
    try {
      const response = await this.client.get('/v1/student/profile');
      return response.data;
    } catch (error) {
      try {
        const meRes = await this.client.get('/v1/auth/me');
        return meRes.data;
      } catch (err) {
        throw new Error('Failed to retrieve student profile.');
      }
    }
  }

  /**
   * Fetch all enrolled courses for the logged-in student
   */
  async getEnrollments() {
    console.log(`📋 [VTUClient] Fetching student enrollments...`);
    try {
      const response = await this.client.get('/v1/student/my-enrollments');
      const raw = response.data;
      const list = Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw) ? raw : []);
      
      const courses = [];
      list.forEach(item => {
        if (item.type === 'course' && item.details) {
          courses.push({
            id: item.details.id || item.id,
            title: item.details.title || item.details.name || 'Untitled Course',
            slug: item.details.slug || String(item.details.id),
            progress: Number(item.details.progress_percent || item.details.overall_progress || item.progress || 0)
          });
        } else if (item.type === 'programme' && item.details) {
          const children = item.details.childCourses || item.details.child_courses || [];
          children.forEach(child => {
            courses.push({
              id: child.id,
              title: `[Programme] ${child.title || child.name}`,
              slug: child.slug || String(child.id),
              progress: Number(child.progress_percent || child.overall_progress || child.progress || 0)
            });
          });
        } else if (item.slug || item.title) {
          courses.push({
            id: item.id,
            title: item.title || item.name || 'Untitled Course',
            slug: item.slug || String(item.id),
            progress: Number(item.progress_percent || item.overall_progress || item.progress || 0)
          });
        }
      });

      return courses;
    } catch (error) {
      console.warn(`⚠️ [VTUClient] Could not fetch enrollments list: ${error.message}`);
      return [];
    }
  }

  /**
   * Fetch full course syllabus tree and progress
   * @param {string} courseSlug 
   */
  async getCourseDetails(courseSlug) {
    const slug = VTUClient.parseCourseSlug(courseSlug);
    console.log(`📚 [VTUClient] Fetching course structure for: ${slug}...`);
    const encodedSlug = encodeURIComponent(slug);
    const response = await this.client.get(`/v1/student/my-courses/${encodedSlug}`);
    
    if (!response.data) {
      throw new Error(`Empty response for course slug: ${slug}`);
    }

    return response.data;
  }

  /**
   * Fetch individual lecture metadata (used if duration is missing)
   * @param {string} courseSlug 
   * @param {number|string} lectureId 
   */
  async getLectureDetails(courseSlug, lectureId) {
    const slug = VTUClient.parseCourseSlug(courseSlug);
    const encodedSlug = encodeURIComponent(slug);
    try {
      const response = await this.client.get(`/v1/student/my-courses/${encodedSlug}/lectures/${lectureId}`);
      return response.data?.data || response.data;
    } catch (e) {
      return null;
    }
  }

  /**
   * Multi-strategy parser for VTU course structure
   * Extracts every lecture across modules/lessons
   * @param {object} apiResponse 
   */
  extractLectures(apiResponse) {
    const lectures = [];

    // Course root can be apiResponse.data.course, apiResponse.data, or apiResponse
    const root = apiResponse.data?.course || apiResponse.data || apiResponse.course || apiResponse;

    // VTU uses 'lessons' for modules, and inside each lesson is 'lectures'
    // But we also support 'curriculum', 'modules', 'sections', 'chapters'
    const modules = root.lessons || root.curriculum || root.modules || root.sections || root.chapters || [];

    if (Array.isArray(modules) && modules.length > 0) {
      modules.forEach((mod, modIdx) => {
        const moduleTitle = mod.name || mod.title || `Module ${modIdx + 1}`;
        const items = mod.lectures || mod.lessons || mod.items || mod.topics || [];

        if (Array.isArray(items)) {
          items.forEach((item, itemIdx) => {
            const rawProgress = item.progressPercent ?? item.progress_percent ?? item.progress ?? 0;
            const progress = Number(rawProgress) || 0;
            const isCompleted = !!(item.is_completed ?? item.isCompleted ?? item.completed ?? (progress >= 90));

            lectures.push({
              id: item.id || item.lecture_id,
              title: item.name || item.title || `Lecture ${itemIdx + 1}`,
              duration: Math.max(60, Number(item.duration_seconds || item.duration) || 300),
              isCompleted,
              progressPercent: progress,
              moduleName: moduleTitle,
              moduleIndex: modIdx + 1,
              lectureIndex: itemIdx + 1,
              raw: item
            });
          });
        }
      });
    }

    // Direct lectures list fallback if flat
    if (lectures.length === 0 && Array.isArray(root.lectures)) {
      root.lectures.forEach((item, idx) => {
        const rawProgress = item.progressPercent ?? item.progress_percent ?? item.progress ?? 0;
        const progress = Number(rawProgress) || 0;
        const isCompleted = !!(item.is_completed ?? item.isCompleted ?? item.completed ?? (progress >= 90));

        lectures.push({
          id: item.id,
          title: item.name || item.title || `Lecture ${idx + 1}`,
          duration: Math.max(60, Number(item.duration_seconds || item.duration) || 300),
          isCompleted,
          progressPercent: progress,
          moduleName: 'Curriculum',
          moduleIndex: 1,
          lectureIndex: idx + 1,
          raw: item
        });
      });
    }

    return lectures;
  }

  /**
   * Submit progress for a single lecture
   * @param {string} courseSlug 
   * @param {string|number} lectureId 
   * @param {number} currentTimeSeconds 
   * @param {number} totalDurationSeconds 
   * @param {number} secondsJustWatched 
   */
  async submitProgress(courseSlug, lectureId, currentTimeSeconds, totalDurationSeconds, secondsJustWatched = 120) {
    const slug = VTUClient.parseCourseSlug(courseSlug);
    const encodedSlug = encodeURIComponent(slug);
    const url = `/v1/student/my-courses/${encodedSlug}/lectures/${lectureId}/progress`;
    
    const payload = {
      current_time_seconds: Math.floor(currentTimeSeconds),
      total_duration_seconds: Math.max(1, Math.floor(totalDurationSeconds)),
      seconds_just_watched: Math.min(120, Math.max(1, Math.floor(secondsJustWatched)))
    };

    const response = await this.client.post(url, payload);
    return response.data;
  }

  /**
   * Watch and complete a lecture using stepped increments (respects backend validation)
   * @param {string} courseSlug 
   * @param {object} lecture 
   * @param {number} stepSeconds Size of each progress increment (default: 120s)
   */
  async completeLecture(courseSlug, lecture, stepSeconds = 120) {
    console.log(`\n▶️ [Watching] [${lecture.moduleName}] - "${lecture.title}" (ID: ${lecture.id})`);

    let isDone = false;
    let lastResult = null;
    let serverPercent = 0;
    let currentTime = 120;
    let assumedDuration = 2400; // 40 minutes initial estimate

    // Send probe tick of 120 seconds
    try {
      lastResult = await this.submitProgress(courseSlug, lecture.id, currentTime, assumedDuration, 120);
      const data = lastResult?.data || {};
      serverPercent = Number(data.percent || 0);
      isDone = !!(data.is_completed || serverPercent >= 95);

      console.log(`   ⏱️ Probe Tick: ${currentTime}s | Server Percent: ${serverPercent}% | Completed: ${isDone ? '✅ YES' : '⏳'}`);

      // If already done, return
      if (isDone) {
        console.log(`   🎉 Lecture marked COMPLETED by VTU server!`);
        return { completed: true, lectureId: lecture.id, result: lastResult };
      }

      // If server returned a positive percentage, calculate exact real duration!
      if (serverPercent > 0) {
        assumedDuration = Math.ceil((currentTime / serverPercent) * 100);
        console.log(`   🎯 Detected Real Video Duration: ~${assumedDuration}s (${Math.round(assumedDuration / 60)} min)`);
      }
    } catch (err) {
      console.warn(`   ⚠️ Probe failed: ${err.response?.data?.message || err.message}`);
    }

    // Attempt Fast Jump to real duration first
    try {
      console.log(`   ⚡ Fast-tracking progress to 100% (${assumedDuration}s)...`);
      lastResult = await this.submitProgress(courseSlug, lecture.id, assumedDuration, assumedDuration, 120);
      const fastData = lastResult?.data || {};
      serverPercent = Number(fastData.percent || 0);
      isDone = !!(fastData.is_completed || serverPercent >= 95);

      if (isDone || serverPercent >= 95) {
        console.log(`   🎉 Lecture reached ${serverPercent}% - COMPLETED by server!`);
        return { completed: true, lectureId: lecture.id, result: lastResult };
      }
    } catch (e) {
      // If direct jump rejected by backend, fall through to fast-stepping
    }

    // Fast-stepping loop: advance in 120s chunks until server confirms is_completed === true
    let stepCount = 0;
    const maxSteps = 60; // Max 60 steps (~2 hours video)

    while (!isDone && serverPercent < 95 && stepCount < maxSteps) {
      currentTime += stepSeconds;
      if (currentTime > assumedDuration && serverPercent < 90) {
        assumedDuration = Math.ceil(currentTime * 1.2);
      }

      try {
        lastResult = await this.submitProgress(courseSlug, lecture.id, currentTime, assumedDuration, stepSeconds);
        const data = lastResult?.data || {};
        serverPercent = Number(data.percent !== undefined ? data.percent : serverPercent);
        isDone = !!(data.is_completed || serverPercent >= 95);

        console.log(`   ⏱️ Step ${stepCount + 1}: ${currentTime}s | Server Percent: ${serverPercent}% | Completed: ${isDone ? '✅ YES' : '⏳ IN PROGRESS'}`);

        if (isDone) {
          console.log(`   🎉 Lecture marked COMPLETED by VTU server!`);
          return { completed: true, lectureId: lecture.id, result: lastResult };
        }
      } catch (err) {
        console.warn(`   ⚠️ Progress tick error: ${err.response?.data?.message || err.message}`);
      }

      stepCount++;
      // Fast 150ms delay between ticks
      await new Promise(r => setTimeout(r, 150));
    }

    return { completed: isDone, lectureId: lecture.id, result: lastResult };
  }
}

module.exports = VTUClient;
