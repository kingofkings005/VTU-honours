const fs = require('fs');
const path = require('path');
const VTUClient = require('../src/vtu-client');

function testWorkflowSyntax() {
  console.log('🧪 Testing n8n workflow JSON validity...');
  const workflowPath = path.join(__dirname, '..', 'workflows', 'vtu_course_auto_completion.json');
  const raw = fs.readFileSync(workflowPath, 'utf8');
  const workflow = JSON.parse(raw);

  if (!workflow.name || !Array.isArray(workflow.nodes) || !workflow.connections) {
    throw new Error('Invalid n8n workflow structure!');
  }

  console.log(`✅ Workflow JSON is valid! Name: "${workflow.name}", Total Nodes: ${workflow.nodes.length}`);
  
  const nodeNames = new Set(workflow.nodes.map(n => n.name));
  for (const [sourceName, conns] of Object.entries(workflow.connections)) {
    if (!nodeNames.has(sourceName)) {
      throw new Error(`Connection source "${sourceName}" does not exist in nodes list!`);
    }
    for (const group of conns.main || []) {
      for (const target of group) {
        if (!nodeNames.has(target.node)) {
          throw new Error(`Connection target "${target.node}" does not exist in nodes list!`);
        }
      }
    }
  }
  console.log('✅ All n8n node connections validated successfully!');
}

function testCurriculumParser() {
  console.log('🧪 Testing syllabus parser with realistic VTU Online schema...');
  const client = new VTUClient();
  
  // Real VTU Online schema where modules are 'lessons', and videos are 'lectures'
  const mockVTUResponse = {
    success: true,
    data: {
      course: {
        id: 1,
        title: 'Natural Language Processing',
        slug: '1-natural-language-processing',
        overall_progress: 35,
        lessons: [
          {
            id: 10,
            name: 'Module 1: Introduction to Natural Language Processing',
            lectures: [
              { id: 101, name: 'Overview of NLP', duration: 420, is_completed: true, progressPercent: 100 },
              { id: 102, name: 'Regular Expressions & Tokenization', duration: 600, is_completed: false, progressPercent: 20 },
              { id: 103, name: 'Corpus Linguistics', duration: 550, is_completed: false, progressPercent: 0 }
            ]
          },
          {
            id: 20,
            name: 'Module 2: Syntactic & Semantic Analysis',
            lectures: [
              { id: 201, name: 'Part-of-Speech Tagging', duration: 720, is_completed: false, progressPercent: 0 },
              { id: 202, name: 'Parsing & Grammars', duration: 800, is_completed: false, progressPercent: 0 }
            ]
          }
        ]
      }
    }
  };

  const lectures = client.extractLectures(mockVTUResponse);
  console.log(`✅ Extracted ${lectures.length} lectures across modules.`);
  
  if (lectures.length !== 5) {
    throw new Error(`Expected 5 lectures, got ${lectures.length}`);
  }

  const pending = lectures.filter(l => !l.isCompleted);
  if (pending.length !== 4) {
    throw new Error(`Expected 4 pending lectures, got ${pending.length}`);
  }

  console.log(`✅ Filtered ${pending.length} pending lectures correctly.`);
  console.log('Sample parsed pending lecture:', {
    id: pending[0].id,
    title: pending[0].title,
    module: pending[0].moduleName,
    duration: pending[0].duration,
    isCompleted: pending[0].isCompleted
  });
}

function testSlugParser() {
  console.log('🧪 Testing URL & Slug parser...');
  const tests = [
    { input: 'https://online.vtu.ac.in/student/course/1-natural-language-processing', expected: '1-natural-language-processing' },
    { input: 'https://online.vtu.ac.in/student/learning/2-machine-learning', expected: '2-machine-learning' },
    { input: '3-deep-learning/', expected: '3-deep-learning' },
    { input: 'cloud-computing?ref=dashboard', expected: 'cloud-computing' }
  ];

  for (const t of tests) {
    const res = VTUClient.parseCourseSlug(t.input);
    if (res !== t.expected) {
      throw new Error(`Failed slug parse: "${t.input}" -> got "${res}", expected "${t.expected}"`);
    }
  }
  console.log('✅ URL & Slug parser passed all test cases!');
}

try {
  testWorkflowSyntax();
  testCurriculumParser();
  testSlugParser();
  console.log('\n🎉 ALL UPDATED INTEGRATION TESTS PASSED!\n');
} catch (err) {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
}
