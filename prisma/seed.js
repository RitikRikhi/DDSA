const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting comprehensive database seeding for DSA Media Crew...');

  // Clear existing records in correct relation order
  await prisma.activityLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.borrowRecord.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.eventAssignment.deleteMany();
  await prisma.mediaAsset.deleteMany();
  await prisma.equipment.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();
  await prisma.department.deleteMany();

  console.log('🧹 Cleaned existing tables.');

  // ==========================================
  // 1. DEPARTMENTS (5 Required)
  // ==========================================
  const departmentsData = [
    { name: 'Photography', description: 'Editorial portraits, sports action freeze, prime optics and raw frame capture.' },
    { name: 'Videography', description: 'Cinematography, 4K multi-cam coverage, drone aerials and aftermovies.' },
    { name: 'Editing', description: 'DaVinci color grading, Premiere timeline pacing, and VFX post-production.' },
    { name: 'Design', description: '300 DPI vector posters, 3D typography, brand identity and social graphics.' },
    { name: 'Social Media', description: 'Viral 9:16 reels, engagement campaigns, algorithmic growth and live coverage.' }
  ];

  const depts = {};
  for (const d of departmentsData) {
    const created = await prisma.department.create({ data: d });
    depts[d.name] = created;
  }
  console.log('✅ Created 5 Departments');

  // ==========================================
  // 2. ROLES (9 Required)
  // ==========================================
  const rolesData = [
    { name: 'Super Admin', key: 'SUPER_ADMIN', permissions: JSON.stringify(['ALL']) },
    { name: 'Admin', key: 'ADMIN', permissions: JSON.stringify(['MANAGE_USERS', 'MANAGE_EVENTS', 'MANAGE_MEDIA', 'MANAGE_EQUIPMENT', 'MANAGE_ATTENDANCE']) },
    { name: 'Technical Head', key: 'TECHNICAL_HEAD', permissions: JSON.stringify(['MANAGE_EVENTS', 'ASSIGN_CREW', 'MANAGE_EQUIPMENT']) },
    { name: 'Photographer', key: 'PHOTOGRAPHER', permissions: JSON.stringify(['UPLOAD_MEDIA', 'VIEW_EVENTS', 'VIEW_EQUIPMENT']) },
    { name: 'Videographer', key: 'VIDEOGRAPHER', permissions: JSON.stringify(['UPLOAD_MEDIA', 'VIEW_EVENTS', 'VIEW_EQUIPMENT']) },
    { name: 'Editor', key: 'EDITOR', permissions: JSON.stringify(['UPLOAD_MEDIA', 'VIEW_EVENTS']) },
    { name: 'Designer', key: 'DESIGNER', permissions: JSON.stringify(['UPLOAD_MEDIA', 'VIEW_EVENTS']) },
    { name: 'Social Media Manager', key: 'SOCIAL_MEDIA_MANAGER', permissions: JSON.stringify(['UPLOAD_MEDIA', 'VIEW_EVENTS', 'ANALYTICS']) },
    { name: 'Volunteer', key: 'VOLUNTEER', permissions: JSON.stringify(['VIEW_EVENTS', 'MARK_ATTENDANCE']) }
  ];

  const roles = {};
  for (const r of rolesData) {
    const created = await prisma.role.create({ data: r });
    roles[r.key] = created;
  }
  console.log('✅ Created 9 System Roles');

  // ==========================================
  // 3. USERS & MEMBERS (60+ Members)
  // ==========================================
  const passwordHash = await bcrypt.hash('admin123', 10);

  const keyMembers = [
    {
      name: 'Ritik Rikhi',
      email: 'admin@dsa.com',
      phone: '+91 98765 43210',
      roleKey: 'SUPER_ADMIN',
      dept: 'Photography',
      year: 'Final Year',
      skills: ['Production Management', 'Lead Cinematography', 'System Architecture', 'Color Retouching'],
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800',
      bannerImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800',
      attendance: 99.4
    },
    {
      name: 'Prince Kumar',
      email: 'prince@dsa.com',
      phone: '+91 98765 43211',
      roleKey: 'ADMIN',
      dept: 'Videography',
      year: '3rd Year',
      skills: ['DaVinci Resolve Studio', 'DJI Ronin Gimbal', 'Anamorphic Framing', 'Festival Aftermovies'],
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800',
      bannerImage: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800',
      attendance: 98.2
    },
    {
      name: 'Anshiv',
      email: 'anshiv@dsa.com',
      phone: '+91 98765 43212',
      roleKey: 'TECHNICAL_HEAD',
      dept: 'Photography',
      year: '3rd Year',
      skills: ['Prime Glass 85mm GM', 'Low-Light Concerts', 'Editorial Lighting', 'Stage Dynamics'],
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800',
      bannerImage: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800',
      attendance: 97.5
    },
    {
      name: 'Tajesh',
      email: 'tajesh@dsa.com',
      phone: '+91 98765 43230',
      roleKey: 'ADMIN',
      dept: 'Videography',
      year: '3rd Year',
      skills: ['Executive Operations', 'Cinematography', 'Live Broadcasting', 'Creative Direction'],
      avatar: '/media/DSC03047-2.jpg',
      bannerImage: '/media/DSC03047-2.jpg',
      attendance: 98.0
    },
    {
      name: 'Anshul Toppo',
      email: 'anshul@dsa.com',
      phone: '+91 98765 43213',
      roleKey: 'TECHNICAL_HEAD',
      dept: 'Editing',
      year: '3rd Year',
      skills: ['Sound Design & Foley', 'Speed Ramping', 'Motion Graphics', 'Multi-Cam Synchronization'],
      avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=800',
      bannerImage: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=800',
      attendance: 96.8
    },
    {
      name: 'Divyanshu',
      email: 'divyanshu@dsa.com',
      phone: '+91 98765 43214',
      roleKey: 'DESIGNER',
      dept: 'Design',
      year: '2nd Year',
      skills: ['3D Spline', 'Typography Artboards', 'Vector Systems', 'Keynote Brand Decks'],
      avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=800',
      bannerImage: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800',
      attendance: 95.0
    },
    {
      name: 'Priyanshu Verma',
      email: 'priyanshu@dsa.com',
      phone: '+91 98765 43215',
      roleKey: 'SOCIAL_MEDIA_MANAGER',
      dept: 'Social Media',
      year: '2nd Year',
      skills: ['Viral Hook Scripting', 'Reels Algorithm', 'Fast-Paced Cutdowns', 'Audience Analytics'],
      avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800',
      bannerImage: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800',
      attendance: 94.7
    }
  ];

  // Extended generator for 60+ members
  const firstNames = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan', 'Shaurya', 'Atharva', 'Kabir', 'Rudra', 'Aryan', 'Dhruv', 'Ananya', 'Diya', 'Gauri', 'Ishita', 'Kavya', 'Khushi', 'Mira', 'Navya', 'Pooja', 'Riya', 'Saanvi', 'Tanvi', 'Veda', 'Zoya', 'Tanya', 'Sneha', 'Meera', 'Rohan', 'Kunal', 'Sameer', 'Vikram', 'Manish', 'Harsh', 'Dev', 'Yash', 'Siddharth', 'Nikhil', 'Tushar', 'Varun', 'Karan', 'Chirag', 'Mohit', 'Rahul', 'Gaurav', 'Deepak', 'Sanjay', 'Kartik', 'Saurabh', 'Alok'];
  const lastNames = ['Sharma', 'Verma', 'Gupta', 'Malhotra', 'Kapoor', 'Singh', 'Chopra', 'Bhatia', 'Joshi', 'Patel', 'Reddy', 'Mehta', 'Nair', 'Saxena', 'Deshmukh', 'Choudhury', 'Iyer', 'Menon', 'Rao', 'Pandey', 'Mishra', 'Agarwal', 'Thakur', 'Goyal', 'Bose'];
  
  const rolePool = ['PHOTOGRAPHER', 'VIDEOGRAPHER', 'EDITOR', 'DESIGNER', 'SOCIAL_MEDIA_MANAGER', 'VOLUNTEER'];
  const deptNames = ['Photography', 'Videography', 'Editing', 'Design', 'Social Media'];
  const years = ['1st Year', '2nd Year', '3rd Year', 'Final Year'];
  const skillBank = [
    'Sony 85mm GM', 'Editorial Lighting', 'Color Retouching', 'DaVinci Resolve', 'Speed Ramping',
    'After Effects', 'Vector Design', 'Reels 9:16', 'Stage Dynamics', 'Audio Foley', 'DJI Drone Pilot',
    '3D Typography', 'Adobe Lightroom', 'High-Speed Action', 'Concert Photography', 'Premiere Pro'
  ];

  const createdUsers = [];

  // 1. Insert Key Members
  for (const m of keyMembers) {
    const role = roles[m.roleKey];
    const dept = depts[m.dept];
    const user = await prisma.user.create({
      data: {
        name: m.name,
        email: m.email,
        password: passwordHash,
        phone: m.phone,
        avatar: m.avatar,
        bannerImage: m.bannerImage,
        year: m.year,
        skills: JSON.stringify(m.skills),
        attendancePercentage: m.attendance,
        departmentId: dept.id,
        category: dept.name,
        roleId: role.id,
        roleName: role.name
      }
    });
    createdUsers.push(user);
  }

  // 2. Insert Remaining to reach 65 members
  for (let i = 0; i < 59; i++) {
    const fName = firstNames[i % firstNames.length];
    const lName = lastNames[(i * 3) % lastNames.length];
    const fullName = `${fName} ${lName}`;
    const email = `${fName.toLowerCase()}.${lName.toLowerCase()}${i+1}@dsa.com`;
    const rKey = rolePool[i % rolePool.length];
    const role = roles[rKey];
    const dName = deptNames[i % deptNames.length];
    const dept = depts[dName];
    const userYear = years[i % years.length];
    const userSkills = [
      skillBank[(i * 2) % skillBank.length],
      skillBank[(i * 3 + 1) % skillBank.length],
      skillBank[(i * 5 + 2) % skillBank.length]
    ];
    const attendance = parseFloat((88 + (i % 12) + Math.random()).toFixed(1));
    const avatar = `https://images.unsplash.com/photo-${1500000000000 + (i * 1234567) % 900000000}?w=800`;

    const user = await prisma.user.create({
      data: {
        name: fullName,
        email,
        password: passwordHash,
        phone: `+91 98${10000000 + i}`,
        avatar: avatar.startsWith('http') ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800' : avatar,
        year: userYear,
        skills: JSON.stringify(userSkills),
        attendancePercentage: Math.min(100, attendance),
        departmentId: dept.id,
        category: dept.name,
        roleId: role.id,
        roleName: role.name
      }
    });
    createdUsers.push(user);
  }
  console.log(`✅ Created ${createdUsers.length} Team Members`);

  // ==========================================
  // 4. EVENTS (25 Required Events)
  // ==========================================
  const eventTemplates = [
    { title: 'Meraki 2026 Mega Cultural Fest', venue: 'Main University Amphitheatre', status: 'live', priority: 'urgent', tasksCount: 24, completedTasks: 19, desc: 'Flagship multi-day cultural festival featuring live concerts, battle of bands, fashion night and celebrity performances.', date: '2026-03-24' },
    { title: 'TechX Global Robotics Conclave', venue: 'Block 3 Convention Hall', status: 'planning', priority: 'high', tasksCount: 16, completedTasks: 6, desc: 'International technical symposium with autonomous bot arenas, drone racing, and keynote talks.', date: '2026-04-05' },
    { title: 'Inter-University Football Championship', venue: 'Central Sports Complex Stadium', status: 'live', priority: 'high', tasksCount: 14, completedTasks: 11, desc: 'Championship finals with full stadium multi-cam live broadcast and pitch-side 1/2000s shutter action coverage.', date: '2026-03-28' },
    { title: 'DSA Annual Film Gala & Awards', venue: 'Auditorium Alpha', status: 'completed', priority: 'medium', tasksCount: 20, completedTasks: 20, desc: 'Annual film screening, red carpet arrivals, and official awards ceremony celebrating outstanding creative productions.', date: '2026-02-18' },
    { title: 'EDM Sunset Soundwave Festival', venue: 'Open Air Lakefront Grounds', status: 'planning', priority: 'high', tasksCount: 18, completedTasks: 4, desc: 'Electronic music extravaganza with heavy laser rigs, pyrotechnics, and 4K UHD 60fps drone synchronization.', date: '2026-04-20' },
    { title: 'TEDx Youth Innovators Summit', venue: 'Silver Oak Auditorium', status: 'completed', priority: 'medium', tasksCount: 12, completedTasks: 12, desc: 'Distinguished ideas conference featuring 12 national keynote speakers with synchronized multi-angle 4K recording.', date: '2026-01-15' },
    { title: 'National Street Dance Showdown', venue: 'Inner Courtyard Arena', status: 'live', priority: 'high', tasksCount: 15, completedTasks: 10, desc: 'Fast-paced hip-hop crews and b-boy battles captured in 120fps slow-motion and vertical 9:16 mobile feeds.', date: '2026-03-25' },
    { title: 'DSA Editorial Studio Masterclass', venue: 'Creative Production Lab 2', status: 'completed', priority: 'low', tasksCount: 8, completedTasks: 8, desc: 'Hands-on lighting setups, 85mm prime portrait craft, and color grading workshops for incoming recruits.', date: '2026-02-05' },
    { title: 'Formula Bharat Auto Expo & Track Day', venue: 'Motorsports Proving Grounds', status: 'planning', priority: 'urgent', tasksCount: 22, completedTasks: 7, desc: 'Formula student racing car unveils, high-speed telemetry filming, and trackside panning photography.', date: '2026-05-02' },
    { title: 'E-Summit Global Venture Showcase', venue: 'Innovation Hub Atrium', status: 'planning', priority: 'medium', tasksCount: 14, completedTasks: 3, desc: 'Pitch competitions, investor roundtables, and high-profile executive portrait sessions.', date: '2026-04-18' },
    { title: 'Spic Macay Classical Sitar Concert', venue: 'Heritage Music Hall', status: 'completed', priority: 'low', tasksCount: 10, completedTasks: 10, desc: 'Acoustic ambient concert with warm low-light cinematography and high-fidelity sound capture.', date: '2026-01-28' },
    { title: 'Inter-College Basketball Slam Fest', venue: 'Indoor Wooden Court Arena', status: 'completed', priority: 'medium', tasksCount: 12, completedTasks: 12, desc: 'High-flying alley-oops, dynamic rim-mounted GoPro cameras, and buzzer-beater excitement.', date: '2026-02-22' },
    { title: 'Designathon 36-Hour Hack & Craft', venue: 'Design Thinking Studio', status: 'planning', priority: 'low', tasksCount: 10, completedTasks: 2, desc: 'Non-stop design marathon with UI/UX prototyping, 3D motion design, and rapid pitch showcases.', date: '2026-05-14' },
    { title: 'DSA Orientation & Induction 2026', venue: 'Main Auditorium Alpha', status: 'completed', priority: 'high', tasksCount: 16, completedTasks: 16, desc: 'Welcoming 200+ new applicants with keynote showreels, live gear demos, and portfolio reviews.', date: '2026-01-10' },
    { title: 'Cosplay & Pop Culture Expo', venue: 'Exhibition Hall B', status: 'planning', priority: 'medium', tasksCount: 14, completedTasks: 5, desc: 'Vibrant pop-culture showcase with dedicated portrait photo-booths and stylized cinematic reels.', date: '2026-04-26' },
    { title: 'Chamber Orchestra Symphony Night', venue: 'Conservatory Hall', status: 'completed', priority: 'low', tasksCount: 10, completedTasks: 10, desc: '60-piece orchestra symphonic performance captured with multi-track ambient microphones and telephoto lenses.', date: '2026-02-12' },
    { title: 'DSA Behind-The-Lens Documentary', venue: 'Various Campus Locations', status: 'live', priority: 'medium', tasksCount: 20, completedTasks: 15, desc: 'Full-length insider documentary spotlighting the late-night edits, camera rigs, and passion of the crew.', date: '2026-03-30' },
    { title: 'Alumni Homecoming Dinner & Gala', venue: 'Presidential Banquet Lawn', status: 'completed', priority: 'medium', tasksCount: 12, completedTasks: 12, desc: 'Formal evening reception with candid networking photography, speech recordings, and memory reels.', date: '2026-02-28' },
    { title: 'Summer Rock Jam & Open Mic', venue: 'Cafeteria Amphitheatre', status: 'planning', priority: 'low', tasksCount: 8, completedTasks: 1, desc: 'Casual acoustic sets and band performances with moody neon lighting and audience candid shots.', date: '2026-05-20' },
    { title: 'RoboWars Battle Arena Showdown', venue: 'Mechanical Engineering Arena', status: 'planning', priority: 'high', tasksCount: 16, completedTasks: 4, desc: 'Combat robots battling inside armored polycarbonate cages with spark-filled slow-mo footage.', date: '2026-04-12' },
    { title: 'Meraki 2025 Retrospective Screening', venue: 'Mini Theater Block 1', status: 'completed', priority: 'low', tasksCount: 6, completedTasks: 6, desc: 'Archival showcase of classic festival aftermovies from 2020 through 2025.', date: '2026-01-20' },
    { title: 'Cricket League Super 8 Finals', venue: 'Main University Oval', status: 'planning', priority: 'medium', tasksCount: 12, completedTasks: 3, desc: 'Floodlit evening cricket finals with boundary-line telephoto cameras and drone flyovers.', date: '2026-05-08' },
    { title: 'Street Play & Nukkad Natak Fest', venue: 'Student Center Circle', status: 'completed', priority: 'medium', tasksCount: 10, completedTasks: 10, desc: 'Passionate theatrical street plays captured candidly with wide-angle prime lenses.', date: '2026-02-14' },
    { title: 'Fashion Runway & Couture Night', venue: 'Grand Auditorium Stage', status: 'planning', priority: 'urgent', tasksCount: 20, completedTasks: 6, desc: 'High-fashion student runway show with continuous studio strobes and dedicated 4K master cams.', date: '2026-04-28' },
    { title: 'DSA Production Masterclass: DaVinci VFX', venue: 'Post-Production Suite 1', status: 'completed', priority: 'low', tasksCount: 8, completedTasks: 8, desc: 'Intensive DaVinci Resolve color grading, node tree architecture, and sound synchronization workshop.', date: '2026-03-05' }
  ];

  const createdEvents = [];
  for (let i = 0; i < eventTemplates.length; i++) {
    const t = eventTemplates[i];
    const banner = `https://images.unsplash.com/photo-${1500000000000 + (i * 2468135) % 900000000}?w=800`;
    const event = await prisma.event.create({
      data: {
        title: t.title,
        name: t.title,
        venue: t.venue,
        description: t.desc,
        status: t.status,
        priority: t.priority,
        tasksCount: t.tasksCount,
        completedTasks: t.completedTasks,
        banner: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800',
        coverImage: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800',
        startDate: new Date(t.date),
        date: t.date,
        time: '06:00 PM',
        createdById: createdUsers[0].id
      }
    });
    createdEvents.push(event);

    // Assign 2-4 crew members per event
    const assignCount = 2 + (i % 3);
    for (let k = 0; k < assignCount; k++) {
      const assignedUser = createdUsers[(i * 3 + k) % createdUsers.length];
      const responsibilities = ['Lead Cinematographer', 'Chief Editor', 'Still Photographer', 'Drone Pilot', 'Sound Engineer'];
      await prisma.eventAssignment.create({
        data: {
          userId: assignedUser.id,
          eventId: event.id,
          responsibility: responsibilities[k % responsibilities.length]
        }
      });
    }
  }
  console.log(`✅ Created ${createdEvents.length} Events & Crew Assignments`);

  // ==========================================
  // 5. EQUIPMENT (40 Items Across 6 Categories)
  // ==========================================
  const gearList = [
    // Cameras (10)
    { name: 'Sony FX3 Full-Frame Cinema Camera', category: 'Camera', serialNumber: 'SN-FX3-1001', condition: 'Excellent', status: 'In Use', image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=500' },
    { name: 'Sony FX6 Full-Frame Cinema Camera', category: 'Camera', serialNumber: 'SN-FX6-1002', condition: 'Excellent', status: 'Available', image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=500' },
    { name: 'Sony A7 IV Hybrid Camera Body #1', category: 'Camera', serialNumber: 'SN-A74-1003', condition: 'Excellent', status: 'In Use', image: 'https://images.unsplash.com/photo-1502982720700-bfff97f2da71?w=500' },
    { name: 'Sony A7 IV Hybrid Camera Body #2', category: 'Camera', serialNumber: 'SN-A74-1004', condition: 'Good', status: 'Available', image: 'https://images.unsplash.com/photo-1502982720700-bfff97f2da71?w=500' },
    { name: 'Sony A7R V High-Resolution 61MP', category: 'Camera', serialNumber: 'SN-A7R5-1005', condition: 'Excellent', status: 'Available', image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=500' },
    { name: 'Canon EOS R5 C Cinema Hybrid', category: 'Camera', serialNumber: 'SN-R5C-1006', condition: 'Good', status: 'In Use', image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=500' },
    { name: 'Blackmagic Pocket Cinema 6K Pro', category: 'Camera', serialNumber: 'SN-BMP-1007', condition: 'Fair', status: 'Available', image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=500' },
    { name: 'RED Komodo 6K Global Shutter', category: 'Camera', serialNumber: 'SN-RED-1008', condition: 'Excellent', status: 'In Use', image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=500' },
    { name: 'Fujifilm X-T5 40MP Retro Body', category: 'Camera', serialNumber: 'SN-FXT5-1009', condition: 'Excellent', status: 'Available', image: 'https://images.unsplash.com/photo-1502982720700-bfff97f2da71?w=500' },
    { name: 'Panasonic Lumix S5 IIX ProRes', category: 'Camera', serialNumber: 'SN-S52X-1010', condition: 'Good', status: 'Available', image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=500' },

    // Lenses (10)
    { name: 'Sony FE 24-70mm f/2.8 GM II', category: 'Lens', serialNumber: 'SN-LNS-2001', condition: 'Excellent', status: 'In Use', image: 'https://images.unsplash.com/photo-1617005082133-548c4dd27f35?w=500' },
    { name: 'Sony FE 70-200mm f/2.8 GM OSS II', category: 'Lens', serialNumber: 'SN-LNS-2002', condition: 'Excellent', status: 'Available', image: 'https://images.unsplash.com/photo-1617005082133-548c4dd27f35?w=500' },
    { name: 'Sony FE 85mm f/1.4 GM Prime', category: 'Lens', serialNumber: 'SN-LNS-2003', condition: 'Excellent', status: 'In Use', image: 'https://images.unsplash.com/photo-1617005082133-548c4dd27f35?w=500' },
    { name: 'Sony FE 35mm f/1.4 GM Wide Prime', category: 'Lens', serialNumber: 'SN-LNS-2004', condition: 'Excellent', status: 'Available', image: 'https://images.unsplash.com/photo-1617005082133-548c4dd27f35?w=500' },
    { name: 'Sony FE 50mm f/1.2 GM Standard', category: 'Lens', serialNumber: 'SN-LNS-2005', condition: 'Good', status: 'Available', image: 'https://images.unsplash.com/photo-1617005082133-548c4dd27f35?w=500' },
    { name: 'Sony FE 16-35mm f/2.8 GM Ultra-Wide', category: 'Lens', serialNumber: 'SN-LNS-2006', condition: 'Excellent', status: 'In Use', image: 'https://images.unsplash.com/photo-1617005082133-548c4dd27f35?w=500' },
    { name: 'Sigma 24-70mm f/2.8 DG DN Art', category: 'Lens', serialNumber: 'SN-LNS-2007', condition: 'Good', status: 'Available', image: 'https://images.unsplash.com/photo-1617005082133-548c4dd27f35?w=500' },
    { name: 'Sirui 50mm T2.9 1.6x Anamorphic Lens', category: 'Lens', serialNumber: 'SN-LNS-2008', condition: 'Excellent', status: 'Available', image: 'https://images.unsplash.com/photo-1617005082133-548c4dd27f35?w=500' },
    { name: 'Sony FE 90mm f/2.8 Macro G OSS', category: 'Lens', serialNumber: 'SN-LNS-2009', condition: 'Good', status: 'Available', image: 'https://images.unsplash.com/photo-1617005082133-548c4dd27f35?w=500' },
    { name: 'Canon RF 28-70mm f/2L USM', category: 'Lens', serialNumber: 'SN-LNS-2010', condition: 'Excellent', status: 'Available', image: 'https://images.unsplash.com/photo-1617005082133-548c4dd27f35?w=500' },

    // Gimbals & Stabilization (6)
    { name: 'DJI RS 3 Pro Gimbal Combo', category: 'Gimbal', serialNumber: 'SN-GMB-3001', condition: 'Excellent', status: 'In Use', image: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=500' },
    { name: 'DJI RS 2 Carbon Fiber Stabilizer', category: 'Gimbal', serialNumber: 'SN-GMB-3002', condition: 'Good', status: 'Available', image: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=500' },
    { name: 'Zhiyun Crane 4 Professional Gimbal', category: 'Gimbal', serialNumber: 'SN-GMB-3003', condition: 'Excellent', status: 'Available', image: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=500' },
    { name: 'DJI Ronin 4D 6K Cinema Gimbal Rig', category: 'Gimbal', serialNumber: 'SN-GMB-3004', condition: 'Excellent', status: 'In Use', image: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=500' },
    { name: 'Tilta Float Handheld Support Rig', category: 'Gimbal', serialNumber: 'SN-GMB-3005', condition: 'Good', status: 'Available', image: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=500' },
    { name: 'EasyRig Minimax Cinema Vest', category: 'Gimbal', serialNumber: 'SN-GMB-3006', condition: 'Excellent', status: 'Available', image: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=500' },

    // Audio Gear (6)
    { name: 'Røde Wireless PRO Dual 32-bit Float', category: 'Audio', serialNumber: 'SN-AUD-4001', condition: 'Excellent', status: 'In Use', image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500' },
    { name: 'DJI Mic 2 Wireless System (2 TX + 1 RX)', category: 'Audio', serialNumber: 'SN-AUD-4002', condition: 'Excellent', status: 'Available', image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500' },
    { name: 'Sennheiser MKE 600 Shotgun Microphone', category: 'Audio', serialNumber: 'SN-AUD-4003', condition: 'Good', status: 'Available', image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500' },
    { name: 'Zoom H6 All-Black 6-Track Recorder', category: 'Audio', serialNumber: 'SN-AUD-4004', condition: 'Excellent', status: 'Available', image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500' },
    { name: 'Deity TC-1 Wireless Timecode Boxes (x3)', category: 'Audio', serialNumber: 'SN-AUD-4005', condition: 'Excellent', status: 'Available', image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500' },
    { name: 'Sony MDR-7506 Studio Monitor Cans', category: 'Audio', serialNumber: 'SN-AUD-4006', condition: 'Good', status: 'Available', image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500' },

    // Lighting (5)
    { name: 'Aputure LS 300d Mark II Monolight', category: 'Lighting', serialNumber: 'SN-LGT-5001', condition: 'Excellent', status: 'In Use', image: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500' },
    { name: 'Aputure Amaran 200x Bi-Color LED', category: 'Lighting', serialNumber: 'SN-LGT-5002', condition: 'Excellent', status: 'Available', image: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500' },
    { name: 'Nanlite PavoTube II 30X RGB Tubes (Pair)', category: 'Lighting', serialNumber: 'SN-LGT-5003', condition: 'Excellent', status: 'In Use', image: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500' },
    { name: 'Godox SL-150W II Video Continuous Light', category: 'Lighting', serialNumber: 'SN-LGT-5004', condition: 'Good', status: 'Available', image: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500' },
    { name: 'Aputure Light Dome III Softbox (90cm)', category: 'Lighting', serialNumber: 'SN-LGT-5005', condition: 'Excellent', status: 'Available', image: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500' },

    // Drones & Aerials (3)
    { name: 'DJI Mavic 3 Pro Cine Tri-Camera Drone', category: 'Drone', serialNumber: 'SN-DRN-6001', condition: 'Excellent', status: 'In Use', image: 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=500' },
    { name: 'DJI Avata 2 FPV CineWhoop Drone Kit', category: 'Drone', serialNumber: 'SN-DRN-6002', condition: 'Excellent', status: 'Available', image: 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=500' },
    { name: 'DJI Mini 4 Pro Lightweight Aerial Kit', category: 'Drone', serialNumber: 'SN-DRN-6003', condition: 'Good', status: 'Available', image: 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=500' }
  ];

  const createdGear = [];
  for (let i = 0; i < gearList.length; i++) {
    const g = gearList[i];
    const item = await prisma.equipment.create({
      data: {
        name: g.name,
        category: g.category,
        serialNumber: g.serialNumber,
        serialNo: g.serialNumber,
        qrCode: `QR-${g.serialNumber}`,
        condition: g.condition,
        availability: g.status,
        status: g.status,
        image: g.image
      }
    });
    createdGear.push(item);

    // If In Use, generate an active BorrowRecord
    if (g.status === 'In Use') {
      const borrowerUser = createdUsers[i % createdUsers.length];
      await prisma.borrowRecord.create({
        data: {
          equipmentId: item.id,
          userId: borrowerUser.id,
          borrower: borrowerUser.name,
          issueDate: new Date(Date.now() - 86400000 * (1 + (i % 3))),
          returnDate: new Date(Date.now() + 86400000 * 2),
          expectedReturn: 'Tomorrow 05:00 PM',
          status: 'Active'
        }
      });
    }
  }
  console.log(`✅ Created ${createdGear.length} Equipment Items with Active Borrow Records`);

  // ==========================================
  // 6. ATTENDANCE (50 Records)
  // ==========================================
  const dutyEvents = ['Meraki Production', 'Concert Stage Rigging', 'Football Live Stream', 'Studio Portraits', 'Aftermovie Edit Bay', 'Reels Live Capture', 'Robotics Coverage'];
  for (let i = 0; i < 50; i++) {
    const user = createdUsers[i % createdUsers.length];
    const evt = dutyEvents[i % dutyEvents.length];
    const isCompleted = i > 10;
    const hours = isCompleted ? parseFloat((3.5 + (i % 5) * 0.8).toFixed(1)) : 1.0;
    const pastDays = Math.floor(i / 3);
    const dateStr = new Date(Date.now() - pastDays * 86400000).toISOString().split('T')[0];

    await prisma.attendance.create({
      data: {
        userId: user.id,
        creator: user.name,
        eventId: createdEvents[i % createdEvents.length].id,
        date: dateStr,
        checkIn: `${9 + (i % 3)}:00 AM`,
        checkOut: isCompleted ? `${5 + (i % 4)}:30 PM` : null,
        totalHours: hours,
        status: isCompleted ? 'Present' : 'On Duty'
      }
    });
  }
  console.log('✅ Created 50 Attendance Records');

  // ==========================================
  // 7. MEDIA ASSETS (300+ Curated Items across 8 Categories)
  // ==========================================
  const mediaCategories = [
    'photography',
    'videography',
    'editing',
    'achievements',
    'reels',
    'team-bts',
    'archives',
    'sports'
  ];

  const localMediaPool = [
    '/media/DSC01903.jpg',
    '/media/DSC01949-2.jpg',
    '/media/DSC02145-3.jpg',
    '/media/DSC02413-2.jpg',
    '/media/DSC01854-2.jpg',
    '/media/DSC02324.jpg',
    '/media/DSC02418.jpg',
    '/media/DSC02213.jpg',
    '/media/DSC02115.jpg',
    '/media/DSC01918.jpg',
    '/media/DSC02409.jpg',
    '/media/DSC01878.jpg'
  ];

  const videoPool = [
    'videos/digital_3d_logo.mp4',
    'videos/videography_showcase.mp4',
    'videos/meraki_aftermovie_teaser.mp4'
  ];

  const unsplashPool = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800',
    'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800',
    'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800',
    'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=800',
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800',
    'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800',
    'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800'
  ];

  let mediaCount = 0;
  for (let c = 0; c < mediaCategories.length; c++) {
    const cat = mediaCategories[c];
    const isVideoCat = cat === 'videography' || cat === 'reels';
    const itemsInCat = 40; // 8 * 40 = 320 assets

    for (let j = 0; j < itemsInCat; j++) {
      const isVideo = isVideoCat && (j % 2 === 0);
      const uploader = createdUsers[(c * 7 + j) % createdUsers.length];
      const event = createdEvents[(c * 3 + j) % createdEvents.length];
      
      const fileUrl = isVideo 
        ? videoPool[j % videoPool.length] 
        : (j < localMediaPool.length ? localMediaPool[j] : unsplashPool[(c + j) % unsplashPool.length]);

      const fileName = isVideo 
        ? `DSA_${cat.toUpperCase()}_Asset_${j+1}.mp4` 
        : `DSA_${cat.toUpperCase()}_RawFrame_${j+1}.jpg`;

      const sizeStr = isVideo ? `${120 + (j % 200)} MB` : `${8 + (j % 15)}.4 MB`;
      const resStr = isVideo ? (cat === 'reels' ? '1080 x 1920 (9:16)' : '3840 x 2160 (4K 60fps)') : '4000 x 6000 (24MP Raw)';
      const exifStr = isVideo ? 'Sony FX3 · 24-70mm GM II · S-Log3 · 4K 60p' : 'Sony A7R V · 85mm f/1.4 GM · 1/1200s · ISO 100';

      await prisma.mediaAsset.create({
        data: {
          fileName,
          fileUrl,
          thumbnailUrl: fileUrl,
          type: isVideo ? 'video' : 'image',
          size: sizeStr,
          sizeBytes: isVideo ? 150000000 : 12000000,
          res: resStr,
          category: cat,
          tags: JSON.stringify([cat, event.title.split(' ')[0], 'Official']),
          exif: exifStr,
          isFeatured: j % 5 === 0,
          eventId: event.id,
          uploadedById: uploader.id
        }
      });
      mediaCount++;
    }
  }
  console.log(`✅ Created ${mediaCount} Media Assets Across 8 Categories`);

  // ==========================================
  // 8. NOTIFICATIONS & ACTIVITY LOGS
  // ==========================================
  const notificationsData = [
    { title: 'Meraki 2026 Shift Assigned', message: 'You have been assigned as Lead Cinematographer for the Concert Main Stage.', type: 'event' },
    { title: 'Sony FX3 Checked In', message: 'Sony FX3 Cinema Camera returned to inventory in Excellent condition.', type: 'equipment' },
    { title: 'New 4K Photos Uploaded', message: 'Anshiv uploaded 24 high-resolution editorial portrait frames.', type: 'media' },
    { title: 'Attendance Verified', message: 'Your duty attendance for Studio Production has been recorded.', type: 'attendance' },
    { title: 'TechX Conclave Briefing', message: 'Technical Head team call scheduled for Friday at 04:00 PM in Lab 2.', type: 'info' }
  ];

  for (const n of notificationsData) {
    await prisma.notification.create({
      data: {
        title: n.title,
        message: n.message,
        type: n.type,
        readStatus: false,
        userId: createdUsers[0].id
      }
    });
  }

  const activitiesData = [
    { action: 'LOGIN', userName: 'Ritik Rikhi', entityType: 'User', details: 'Admin logged in from Studio Control Room' },
    { action: 'CREATE_EVENT', userName: 'Prince Kumar', entityType: 'Event', details: 'Scheduled Meraki 2026 Mega Fest' },
    { action: 'UPLOAD_MEDIA', userName: 'Anshiv', entityType: 'MediaAsset', details: 'Uploaded 4K Stage Photography Series' },
    { action: 'BORROW_EQUIPMENT', userName: 'Prince Kumar', entityType: 'Equipment', details: 'Checked out Sony FX3 Cinema Camera' },
    { action: 'CHECK_IN', userName: 'Anshul Toppo', entityType: 'Attendance', details: 'Logged check-in for Aftermovie Edit Bay' }
  ];

  for (const a of activitiesData) {
    await prisma.activityLog.create({
      data: {
        action: a.action,
        userName: a.userName,
        entityType: a.entityType,
        details: a.details,
        userId: createdUsers[0].id
      }
    });
  }
  console.log('✅ Created Notifications & Activity Logs');

  console.log('🎉 Seeding successfully completed! Database is fully populated with production data.');
}

main()
  .catch(e => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
