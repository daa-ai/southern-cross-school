class SchoolHub {
    constructor() {
        this.currentUser = null;
        this.data = this.loadData();
        this.init();
    }

    loadData() {
        const defaultData = {
            students: [
                {id: 1, name: "John Doe", class: "10A", attendance: 85, marks: {math: 78, english: 82}, fees: {total: 5000, paid: 3000}},
                {id: 2, name: "Jane Smith", class: "10B", attendance: 92, marks: {math: 88, english: 90}, fees: {total: 5000, paid: 5000}},
                {id: 3, name: "Mike Johnson", class: "11A", attendance: 78, marks: {math: 65, english: 75}, fees: {total: 5500, paid: 2000}}
            ],
            teachers: [
                {id: 1, name: "Mr. Wilson", subject: "Math", classes: ["10A", "10B"], email: "wilson@school.com"},
                {id: 2, name: "Ms. Johnson", subject: "English", classes: ["10A", "11A"], email: "johnson@school.com"},
                {id: 3, name: "Dr. Brown", subject: "Science", classes: ["10B", "11A"], email: "brown@school.com"}
            ],
            classes: ["10A", "10B", "11A", "11B"],
            announcements: [
                {id: 1, title: "School Holiday", content: "School will be closed next Monday", date: "2024-01-15", priority: "info"},
                {id: 2, title: "Parent Meeting", content: "Monthly parent-teacher meeting on Friday", date: "2024-01-18", priority: "warning"}
            ],
            homework: [
                {id: 1, class: "10A", subject: "Math", task: "Complete Chapter 5 exercises", dueDate: "2024-01-20", teacher: "Mr. Wilson"},
                {id: 2, class: "10B", subject: "English", task: "Write essay on Shakespeare", dueDate: "2024-01-22", teacher: "Ms. Johnson"}
            ],
            messages: [
                {id: 1, from: "Mr. Wilson", to: "Parent", subject: "Math Progress", content: "John is doing well in math", date: "2024-01-10"},
                {id: 2, from: "Parent", to: "Ms. Johnson", subject: "Homework Query", content: "Need clarification on essay topic", date: "2024-01-12"}
            ]
        };
        return JSON.parse(localStorage.getItem('schoolHubData')) || defaultData;
    }

    saveData() {
        localStorage.setItem('schoolHubData', JSON.stringify(this.data));
    }

    init() {
        this.setupEventListeners();
        this.showScreen('login-screen');
    }

    setupEventListeners() {
        document.getElementById('login-form').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());
        document.getElementById('teacher-logout-btn').addEventListener('click', () => this.logout());
        document.getElementById('parent-logout-btn').addEventListener('click', () => this.logout());
        
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleNavigation(e));
        });
    }

    handleLogin(e) {
        e.preventDefault();
        const role = document.getElementById('user-role').value;
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        if (role && username && password) {
            this.currentUser = {role, username};
            this.showDashboard(role);
        }
    }

    logout() {
        this.currentUser = null;
        this.showScreen('login-screen');
        document.getElementById('login-form').reset();
    }

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');
    }

    showDashboard(role) {
        this.showScreen(`${role}-dashboard`);
        this.loadDefaultSection(role);
    }

    loadDefaultSection(role) {
        this.loadSection('dashboard', role);
    }

    handleNavigation(e) {
        const section = e.target.dataset.section;
        const role = this.currentUser.role;
        
        document.querySelectorAll(`#${role}-dashboard .nav-btn`).forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        
        this.loadSection(section, role);
        this.updatePageTitle(section, role);
    }

    updatePageTitle(section, role) {
        const titles = {
            dashboard: 'Dashboard',
            students: 'Student Management',
            teachers: 'Teacher Management',
            classes: 'Class Management',
            fees: 'Fee Management',
            announcements: 'Announcements',
            reports: 'Reports',
            messages: 'Messages',
            calendar: 'Calendar',
            'my-classes': 'My Classes',
            attendance: 'Attendance',
            marks: 'Marks',
            homework: 'Homework',
            timetable: 'Timetable',
            'child-profile': 'Child Profile',
            'attendance-view': 'Attendance',
            progress: 'Academic Progress',
            'homework-view': 'Homework',
            'fees-view': 'Fee Status'
        };
        
        const titleElement = document.getElementById(`${role}-page-title`) || document.getElementById('page-title');
        if (titleElement) {
            titleElement.textContent = titles[section] || 'Dashboard';
        }
    }

    loadSection(section, role) {
        const contentDiv = document.getElementById(`${role}-content`);
        
        // Admin sections
        if (role === 'admin') {
            switch(section) {
                case 'dashboard':
                    contentDiv.innerHTML = this.renderAdminDashboard();
                    break;
                case 'students':
                    contentDiv.innerHTML = this.renderAdminStudentsSection();
                    break;
                case 'teachers':
                    contentDiv.innerHTML = this.renderAdminTeachersSection();
                    break;
                case 'classes':
                    contentDiv.innerHTML = this.renderAdminClassesSection();
                    break;
                case 'fees':
                    contentDiv.innerHTML = this.renderAdminFeesSection();
                    break;
                case 'announcements':
                    contentDiv.innerHTML = this.renderAdminAnnouncementsSection();
                    break;
                case 'reports':
                    contentDiv.innerHTML = this.renderAdminReportsSection();
                    break;
                case 'messages':
                    contentDiv.innerHTML = this.renderAdminMessagesSection();
                    break;
                case 'calendar':
                    contentDiv.innerHTML = this.renderAdminCalendarSection();
                    break;
            }
        }
        
        // Teacher sections
        else if (role === 'teacher') {
            switch(section) {
                case 'dashboard':
                    contentDiv.innerHTML = this.renderTeacherDashboard();
                    break;
                case 'my-classes':
                    contentDiv.innerHTML = this.renderTeacherClassesSection();
                    break;
                case 'attendance':
                    contentDiv.innerHTML = this.renderTeacherAttendanceSection();
                    break;
                case 'marks':
                    contentDiv.innerHTML = this.renderTeacherMarksSection();
                    break;
                case 'homework':
                    contentDiv.innerHTML = this.renderTeacherHomeworkSection();
                    break;
                case 'timetable':
                    contentDiv.innerHTML = this.renderTeacherTimetableSection();
                    break;
                case 'messages':
                    contentDiv.innerHTML = this.renderTeacherMessagesSection();
                    break;
                case 'calendar':
                    contentDiv.innerHTML = this.renderTeacherCalendarSection();
                    break;
            }
        }
        
        // Parent sections
        else if (role === 'parent') {
            switch(section) {
                case 'dashboard':
                    contentDiv.innerHTML = this.renderParentDashboard();
                    break;
                case 'child-profile':
                    contentDiv.innerHTML = this.renderParentChildProfileSection();
                    break;
                case 'attendance-view':
                    contentDiv.innerHTML = this.renderParentAttendanceSection();
                    break;
                case 'progress':
                    contentDiv.innerHTML = this.renderParentProgressSection();
                    break;
                case 'homework-view':
                    contentDiv.innerHTML = this.renderParentHomeworkSection();
                    break;
                case 'fees-view':
                    contentDiv.innerHTML = this.renderParentFeesSection();
                    break;
                case 'messages':
                    contentDiv.innerHTML = this.renderParentMessagesSection();
                    break;
                case 'calendar':
                    contentDiv.innerHTML = this.renderParentCalendarSection();
                    break;
            }
        }
    }

    // ADMIN SECTIONS
    renderAdminDashboard() {
        const stats = this.getAdminStats();
        return `
            <div class="stats-grid">
                ${stats.map(stat => `
                    <div class="stat-card ${stat.type}">
                        <i class="${stat.icon}"></i>
                        <h4>${stat.value}</h4>
                        <p>${stat.label}</p>
                    </div>
                `).join('')}
            </div>
            <div class="card">
                <h3><i class="fas fa-bullhorn"></i> Admin Control Panel</h3>
                <p>Welcome Administrator! Manage your school efficiently.</p>
                <div class="btn-group">
                    <button class="btn btn-primary" onclick="app.quickAddStudent()"><i class="fas fa-user-plus"></i> Quick Add Student</button>
                    <button class="btn btn-success" onclick="app.sendBulkAnnouncement()"><i class="fas fa-bullhorn"></i> Send Announcement</button>
                </div>
            </div>
        `;
    }

    renderAdminStudentsSection() {
        return `
            <div class="card">
                <h3><i class="fas fa-user-graduate"></i> Student Management - Admin</h3>
                <div class="search-box">
                    <i class="fas fa-search"></i>
                    <input type="text" placeholder="Search students..." onkeyup="app.searchStudents(this.value)">
                </div>
                <button class="btn btn-primary" onclick="app.addStudent()"><i class="fas fa-plus"></i> Add Student</button>
            </div>
            <div class="data-grid" id="students-grid">
                ${this.data.students.map(student => `
                    <div class="data-card">
                        <h4><i class="fas fa-user"></i> ${student.name}</h4>
                        <p><i class="fas fa-door-open"></i> Class: ${student.class}</p>
                        <p><i class="fas fa-percentage"></i> Attendance: ${student.attendance}%</p>
                        <p><i class="fas fa-dollar-sign"></i> Fees: $${student.fees.paid}/$${student.fees.total}</p>
                        <div class="btn-group">
                            <button class="btn btn-primary" onclick="app.editStudent(${student.id})"><i class="fas fa-edit"></i> Edit</button>
                            <button class="btn btn-danger" onclick="app.deleteStudent(${student.id})"><i class="fas fa-trash"></i> Delete</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderAdminTeachersSection() {
        return `
            <div class="card">
                <h3><i class="fas fa-chalkboard-teacher"></i> Teacher Management - Admin</h3>
                <button class="btn btn-primary" onclick="app.addTeacher()"><i class="fas fa-plus"></i> Add Teacher</button>
            </div>
            <div class="data-grid">
                ${this.data.teachers.map(teacher => `
                    <div class="data-card">
                        <h4><i class="fas fa-user-tie"></i> ${teacher.name}</h4>
                        <p><i class="fas fa-book"></i> Subject: ${teacher.subject}</p>
                        <p><i class="fas fa-door-open"></i> Classes: ${teacher.classes.join(', ')}</p>
                        <p><i class="fas fa-envelope"></i> Email: ${teacher.email}</p>
                        <div class="btn-group">
                            <button class="btn btn-primary" onclick="app.editTeacher(${teacher.id})"><i class="fas fa-edit"></i> Edit</button>
                            <button class="btn btn-warning" onclick="app.messageTeacher(${teacher.id})"><i class="fas fa-envelope"></i> Message</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderAdminClassesSection() {
        return `
            <div class="card">
                <h3><i class="fas fa-door-open"></i> Class Management - Admin</h3>
                <button class="btn btn-primary" onclick="app.addClass()"><i class="fas fa-plus"></i> Add Class</button>
            </div>
            <div class="data-grid">
                ${this.data.classes.map(className => `
                    <div class="data-card">
                        <h4><i class="fas fa-door-open"></i> Class ${className}</h4>
                        <p><i class="fas fa-user-graduate"></i> Students: ${this.data.students.filter(s => s.class === className).length}</p>
                        <div class="btn-group">
                            <button class="btn btn-primary" onclick="app.viewClassDetails('${className}')"><i class="fas fa-eye"></i> View Details</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderAdminFeesSection() {
        const totalFees = this.data.students.reduce((sum, s) => sum + s.fees.total, 0);
        const paidFees = this.data.students.reduce((sum, s) => sum + s.fees.paid, 0);
        
        return `
            <div class="stats-grid">
                <div class="stat-card success">
                    <i class="fas fa-dollar-sign"></i>
                    <h4>$${paidFees}</h4>
                    <p>Fees Collected</p>
                </div>
                <div class="stat-card danger">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h4>$${totalFees - paidFees}</h4>
                    <p>Pending Fees</p>
                </div>
            </div>
            <div class="card">
                <h3><i class="fas fa-dollar-sign"></i> Fee Management - Admin</h3>
                <div class="data-grid">
                    ${this.data.students.map(student => `
                        <div class="data-card">
                            <h4>${student.name}</h4>
                            <p>Class: ${student.class}</p>
                            <p>Total: $${student.fees.total}</p>
                            <p>Paid: $${student.fees.paid}</p>
                            <div class="btn-group">
                                <button class="btn btn-success" onclick="app.recordPayment(${student.id})"><i class="fas fa-plus"></i> Record Payment</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderAdminAnnouncementsSection() {
        return `
            <div class="card">
                <h3><i class="fas fa-bullhorn"></i> Announcements - Admin</h3>
                <button class="btn btn-primary" onclick="app.addAnnouncement()"><i class="fas fa-plus"></i> Add Announcement</button>
            </div>
            <div class="data-grid">
                ${this.data.announcements.map(ann => `
                    <div class="data-card">
                        <h4><i class="fas fa-bullhorn"></i> ${ann.title}</h4>
                        <p>${ann.content}</p>
                        <p><i class="fas fa-calendar"></i> Date: ${ann.date}</p>
                        <div class="btn-group">
                            <button class="btn btn-danger" onclick="app.deleteAnnouncement(${ann.id})"><i class="fas fa-trash"></i> Delete</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderAdminReportsSection() {
        return `
            <div class="card">
                <h3><i class="fas fa-chart-bar"></i> Reports & Analytics - Admin</h3>
                <div class="btn-group">
                    <button class="btn btn-primary" onclick="app.generateReport('attendance')"><i class="fas fa-clipboard-check"></i> Attendance Report</button>
                    <button class="btn btn-success" onclick="app.generateReport('grades')"><i class="fas fa-star"></i> Grade Report</button>
                </div>
            </div>
        `;
    }

    renderAdminMessagesSection() {
        return `
            <div class="card">
                <h3><i class="fas fa-envelope"></i> Messages - Admin Portal</h3>
                <button class="btn btn-primary" onclick="app.composeMessage()"><i class="fas fa-plus"></i> Compose Message</button>
            </div>
            <div class="data-grid">
                ${this.data.messages.map(msg => `
                    <div class="data-card">
                        <h4><i class="fas fa-envelope"></i> ${msg.subject}</h4>
                        <p><i class="fas fa-user"></i> From: ${msg.from}</p>
                        <p><i class="fas fa-user"></i> To: ${msg.to}</p>
                        <p>${msg.content}</p>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderAdminCalendarSection() {
        return `
            <div class="card">
                <h3><i class="fas fa-calendar"></i> School Calendar - Admin</h3>
                <div class="notification info">
                    <i class="fas fa-info-circle"></i>
                    <div>
                        <strong>School Events</strong>
                        <p>Parent-Teacher Meeting - January 18, 2024</p>
                        <p>Annual Sports Day - February 15, 2024</p>
                    </div>
                </div>
            </div>
        `;
    }

    // TEACHER SECTIONS
    renderTeacherDashboard() {
        const stats = this.getTeacherStats();
        return `
            <div class="stats-grid">
                ${stats.map(stat => `
                    <div class="stat-card ${stat.type}">
                        <i class="${stat.icon}"></i>
                        <h4>${stat.value}</h4>
                        <p>${stat.label}</p>
                    </div>
                `).join('')}
            </div>
            <div class="card">
                <h3><i class="fas fa-chalkboard-teacher"></i> Teacher Portal</h3>
                <p>Welcome Teacher! Manage your classes and students.</p>
                <div class="btn-group">
                    <button class="btn btn-primary" onclick="app.quickTakeAttendance()"><i class="fas fa-clipboard-check"></i> Quick Attendance</button>
                    <button class="btn btn-warning" onclick="app.quickAssignHomework()"><i class="fas fa-book"></i> Assign Homework</button>
                </div>
            </div>
        `;
    }

    renderTeacherClassesSection() {
        return `
            <div class="card">
                <h3><i class="fas fa-door-open"></i> My Classes - Teacher</h3>
                ${['10A', '10B'].map(className => `
                    <div class="data-card">
                        <h4><i class="fas fa-door-open"></i> Class ${className}</h4>
                        <p><i class="fas fa-user-graduate"></i> Students: ${this.data.students.filter(s => s.class === className).length}</p>
                        <div class="btn-group">
                            <button class="btn btn-primary" onclick="app.viewClassDetails('${className}')"><i class="fas fa-eye"></i> View Students</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderTeacherAttendanceSection() {
        return `
            <div class="card">
                <h3><i class="fas fa-clipboard-check"></i> Record Attendance - Teacher</h3>
                <div class="form-row">
                    <div class="form-group">
                        <label>Select Class:</label>
                        <select id="attendance-class">
                            <option value="10A">10A</option>
                            <option value="10B">10B</option>
                        </select>
                    </div>
                </div>
                <button class="btn btn-primary" onclick="app.recordAttendance()"><i class="fas fa-clipboard-check"></i> Take Attendance</button>
            </div>
        `;
    }

    renderTeacherMarksSection() {
        return `
            <div class="card">
                <h3><i class="fas fa-star"></i> Enter Marks - Teacher</h3>
                <div class="form-row">
                    <div class="form-group">
                        <label>Select Class:</label>
                        <select id="marks-class">
                            <option value="10A">10A</option>
                            <option value="10B">10B</option>
                        </select>
                    </div>
                </div>
                <button class="btn btn-primary" onclick="app.enterMarks()"><i class="fas fa-star"></i> Enter Marks</button>
            </div>
        `;
    }

    renderTeacherHomeworkSection() {
        return `
            <div class="card">
                <h3><i class="fas fa-book"></i> Assign Homework - Teacher</h3>
                <div class="form-group">
                    <label>Class:</label>
                    <select id="hw-class">
                        <option value="10A">10A</option>
                        <option value="10B">10B</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Subject:</label>
                    <input type="text" id="hw-subject" placeholder="Subject">
                </div>
                <div class="form-group">
                    <label>Assignment:</label>
                    <textarea id="hw-task" placeholder="Homework description"></textarea>
                </div>
                <button class="btn btn-primary" onclick="app.assignHomework()"><i class="fas fa-plus"></i> Assign Homework</button>
            </div>
        `;
    }

    renderTeacherTimetableSection() {
        return `
            <div class="card">
                <h3><i class="fas fa-clock"></i> My Timetable - Teacher</h3>
                <div class="data-card">
                    <h4><i class="fas fa-calendar-day"></i> Monday</h4>
                    <p><i class="fas fa-clock"></i> 9:00 AM - Math (Class 10A)</p>
                    <p><i class="fas fa-clock"></i> 10:00 AM - Math (Class 10B)</p>
                </div>
            </div>
        `;
    }

    renderTeacherMessagesSection() {
        return `
            <div class="card">
                <h3><i class="fas fa-envelope"></i> Messages - Teacher</h3>
                <button class="btn btn-primary" onclick="app.messageParent()"><i class="fas fa-plus"></i> Message Parent</button>
            </div>
            <div class="data-grid">
                ${this.data.messages.filter(m => m.from === 'Teacher' || m.to === 'Teacher').map(msg => `
                    <div class="data-card">
                        <h4><i class="fas fa-envelope"></i> ${msg.subject}</h4>
                        <p><i class="fas fa-user"></i> From: ${msg.from}</p>
                        <p>${msg.content}</p>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderTeacherCalendarSection() {
        return `
            <div class="card">
                <h3><i class="fas fa-calendar"></i> My Calendar - Teacher</h3>
                <div class="notification info">
                    <i class="fas fa-info-circle"></i>
                    <div>
                        <strong>My Schedule</strong>
                        <p>Class 10A - Math - Daily 9:00 AM</p>
                        <p>Parent Meeting - January 18, 2024</p>
                    </div>
                </div>
            </div>
        `;
    }

    // PARENT SECTIONS
    renderParentDashboard() {
        const stats = this.getParentStats();
        const child = this.data.students[0];
        return `
            <div class="stats-grid">
                ${stats.map(stat => `
                    <div class="stat-card ${stat.type}">
                        <i class="${stat.icon}"></i>
                        <h4>${stat.value}</h4>
                        <p>${stat.label}</p>
                    </div>
                `).join('')}
            </div>
            <div class="card">
                <h3><i class="fas fa-child"></i> Parent Portal</h3>
                <p>Welcome Parent! Monitor ${child.name}'s progress.</p>
                <div class="btn-group">
                    <button class="btn btn-primary" onclick="app.messageTeacher()"><i class="fas fa-envelope"></i> Message Teacher</button>
                </div>
            </div>
        `;
    }

    renderParentChildProfileSection() {
        const child = this.data.students[0];
        return `
            <div class="card">
                <h3><i class="fas fa-child"></i> Child Profile - Parent View</h3>
                <div class="data-card">
                    <h4><i class="fas fa-user"></i> ${child.name}</h4>
                    <p><i class="fas fa-door-open"></i> Class: ${child.class}</p>
                    <p><i class="fas fa-percentage"></i> Attendance: ${child.attendance}%</p>
                    <p><i class="fas fa-star"></i> Math: ${child.marks.math}%</p>
                    <p><i class="fas fa-star"></i> English: ${child.marks.english}%</p>
                </div>
            </div>
        `;
    }

    renderParentAttendanceSection() {
        const child = this.data.students[0];
        return `
            <div class="card">
                <h3><i class="fas fa-clipboard-check"></i> Attendance Record - Parent View</h3>
                <div class="stat-card ${child.attendance > 85 ? 'success' : 'warning'}">
                    <i class="fas fa-percentage"></i>
                    <h4>${child.attendance}%</h4>
                    <p>Current Attendance</p>
                </div>
            </div>
        `;
    }

    renderParentProgressSection() {
        const child = this.data.students[0];
        return `
            <div class="card">
                <h3><i class="fas fa-chart-line"></i> Academic Progress - Parent View</h3>
                <div class="stats-grid">
                    <div class="stat-card info">
                        <i class="fas fa-calculator"></i>
                        <h4>${child.marks.math}%</h4>
                        <p>Mathematics</p>
                    </div>
                    <div class="stat-card success">
                        <i class="fas fa-book-open"></i>
                        <h4>${child.marks.english}%</h4>
                        <p>English</p>
                    </div>
                </div>
            </div>
        `;
    }

    renderParentHomeworkSection() {
        const child = this.data.students[0];
        return `
            <div class="card">
                <h3><i class="fas fa-book"></i> Homework - Parent View</h3>
                <div class="data-grid">
                    ${this.data.homework.filter(hw => hw.class === child.class).map(hw => `
                        <div class="data-card">
                            <h4><i class="fas fa-book"></i> ${hw.subject}</h4>
                            <p>${hw.task}</p>
                            <p><i class="fas fa-calendar"></i> Due: ${hw.dueDate}</p>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderParentFeesSection() {
        const child = this.data.students[0];
        return `
            <div class="card">
                <h3><i class="fas fa-dollar-sign"></i> Fee Status - Parent View</h3>
                <div class="stats-grid">
                    <div class="stat-card success">
                        <i class="fas fa-dollar-sign"></i>
                        <h4>$${child.fees.paid}</h4>
                        <p>Amount Paid</p>
                    </div>
                    <div class="stat-card ${child.fees.paid >= child.fees.total ? 'success' : 'danger'}">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h4>$${child.fees.total - child.fees.paid}</h4>
                        <p>Pending Amount</p>
                    </div>
                </div>
            </div>
        `;
    }

    renderParentMessagesSection() {
        return `
            <div class="card">
                <h3><i class="fas fa-envelope"></i> Messages - Parent</h3>
                <button class="btn btn-primary" onclick="app.messageTeacher()"><i class="fas fa-plus"></i> Message Teacher</button>
            </div>
            <div class="data-grid">
                ${this.data.messages.filter(m => m.from === 'Parent' || m.to === 'Parent').map(msg => `
                    <div class="data-card">
                        <h4><i class="fas fa-envelope"></i> ${msg.subject}</h4>
                        <p><i class="fas fa-user"></i> From: ${msg.from}</p>
                        <p>${msg.content}</p>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderParentCalendarSection() {
        return `
            <div class="card">
                <h3><i class="fas fa-calendar"></i> Child's Calendar - Parent View</h3>
                <div class="notification info">
                    <i class="fas fa-info-circle"></i>
                    <div>
                        <strong>Child's Events</strong>
                        <p>Parent-Teacher Meeting - January 18, 2024</p>
                        <p>Math Test - January 25, 2024</p>
                    </div>
                </div>
            </div>
        `;
    }

    getAdminStats() {
        return [
            {icon: 'fas fa-user-graduate', value: this.data.students.length, label: 'Total Students', type: 'success'},
            {icon: 'fas fa-chalkboard-teacher', value: this.data.teachers.length, label: 'Total Teachers', type: 'info'},
            {icon: 'fas fa-door-open', value: this.data.classes.length, label: 'Total Classes', type: 'warning'},
            {icon: 'fas fa-dollar-sign', value: '$' + this.data.students.reduce((sum, s) => sum + s.fees.paid, 0), label: 'Fees Collected', type: 'success'}
        ];
    }

    getTeacherStats() {
        return [
            {icon: 'fas fa-door-open', value: 2, label: 'My Classes', type: 'info'},
            {icon: 'fas fa-user-graduate', value: this.data.students.filter(s => ['10A', '10B'].includes(s.class)).length, label: 'My Students', type: 'success'},
            {icon: 'fas fa-book', value: this.data.homework.length, label: 'Assignments Given', type: 'warning'},
            {icon: 'fas fa-envelope', value: this.data.messages.filter(m => m.from === 'Teacher').length, label: 'Messages Sent', type: 'info'}
        ];
    }

    getParentStats() {
        const child = this.data.students[0];
        return [
            {icon: 'fas fa-percentage', value: child.attendance + '%', label: 'Child Attendance', type: child.attendance > 85 ? 'success' : 'warning'},
            {icon: 'fas fa-star', value: Math.round((child.marks.math + child.marks.english) / 2) + '%', label: 'Average Grade', type: 'info'},
            {icon: 'fas fa-book', value: this.data.homework.filter(h => h.class === child.class).length, label: 'Pending Homework', type: 'warning'},
            {icon: 'fas fa-dollar-sign', value: '$' + (child.fees.total - child.fees.paid), label: 'Pending Fees', type: child.fees.paid >= child.fees.total ? 'success' : 'danger'}
        ];
    }

    // Action methods
    addStudent() {
        const name = prompt("Enter student name:");
        const className = prompt("Enter class:");
        if (name && className) {
            this.data.students.push({
                id: Date.now(),
                name,
                class: className,
                attendance: 100,
                marks: {math: 0, english: 0},
                fees: {total: 5000, paid: 0}
            });
            this.saveData();
            this.loadSection('students', 'admin');
        }
    }

    deleteStudent(id) {
        if (confirm("Delete this student?")) {
            this.data.students = this.data.students.filter(s => s.id !== id);
            this.saveData();
            this.loadSection('students', 'admin');
        }
    }

    addTeacher() {
        const name = prompt("Enter teacher name:");
        const subject = prompt("Enter subject:");
        if (name && subject) {
            this.data.teachers.push({
                id: Date.now(),
                name,
                subject,
                email: name.toLowerCase().replace(' ', '') + '@school.com',
                classes: []
            });
            this.saveData();
            this.loadSection('teachers', 'admin');
        }
    }

    recordPayment(studentId) {
        const amount = parseFloat(prompt("Enter payment amount:"));
        if (amount && amount > 0) {
            const student = this.data.students.find(s => s.id === studentId);
            if (student) {
                student.fees.paid = Math.min(student.fees.paid + amount, student.fees.total);
                this.saveData();
                this.loadSection('fees', 'admin');
                alert('Payment recorded successfully!');
            }
        }
    }

    assignHomework() {
        const className = document.getElementById('hw-class').value;
        const subject = document.getElementById('hw-subject').value;
        const task = document.getElementById('hw-task').value;
        
        if (className && subject && task) {
            this.data.homework.push({
                id: Date.now(),
                class: className,
                subject,
                task,
                dueDate: new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0],
                teacher: this.currentUser.username
            });
            this.saveData();
            this.loadSection('homework', 'teacher');
            alert('Homework assigned successfully!');
        }
    }

    composeMessage() {
        const to = prompt("Send message to:");
        const subject = prompt("Message subject:");
        const content = prompt("Message content:");
        
        if (to && subject && content) {
            this.data.messages.push({
                id: Date.now(),
                from: this.currentUser.username,
                to,
                subject,
                content,
                date: new Date().toISOString().split('T')[0]
            });
            this.saveData();
            this.loadSection('messages', this.currentUser.role);
            alert('Message sent successfully!');
        }
    }

    recordAttendance() {
        alert("Attendance recorded successfully!");
    }

    enterMarks() {
        alert("Marks entered successfully!");
    }

    messageTeacher() {
        alert("Message sent to teacher!");
    }

    generateReport(type) {
        alert(`Generating ${type} report...`);
    }

    searchStudents(query) {
        const filtered = this.data.students.filter(s => 
            s.name.toLowerCase().includes(query.toLowerCase()) ||
            s.class.toLowerCase().includes(query.toLowerCase())
        );
        
        const grid = document.getElementById('students-grid');
        if (grid) {
            grid.innerHTML = filtered.map(student => `
                <div class="data-card">
                    <h4><i class="fas fa-user"></i> ${student.name}</h4>
                    <p><i class="fas fa-door-open"></i> Class: ${student.class}</p>
                    <p><i class="fas fa-percentage"></i> Attendance: ${student.attendance}%</p>
                    <p><i class="fas fa-dollar-sign"></i> Fees: $${student.fees.paid}/$${student.fees.total}</p>
                    <div class="btn-group">
                        <button class="btn btn-primary" onclick="app.editStudent(${student.id})"><i class="fas fa-edit"></i> Edit</button>
                        <button class="btn btn-danger" onclick="app.deleteStudent(${student.id})"><i class="fas fa-trash"></i> Delete</button>
                    </div>
                </div>
            `).join('');
        }
    }
}

const app = new SchoolHub();