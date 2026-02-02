class SchoolHub {
    constructor() {
        this.currentUser = null;
        this.darkMode = localStorage.getItem('darkMode') === 'true';
        this.notifications = [];
        this.chatGroups = this.loadChatGroups();
        this.data = this.loadData();
        this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
        this.sessionTimer = null;
        this.loadingStates = new Set();
        this.undoStack = [];
        this.redoStack = [];
        this.init();
    }

    loadChatGroups() {
        const defaultGroups = {
            teachers: {
                id: 'teachers',
                name: 'Teachers Group',
                members: [],
                messages: [],
                allowedRoles: ['teacher', 'admin']
            },
            parents: {
                id: 'parents', 
                name: 'Parents & Teachers',
                members: [],
                messages: [],
                allowedRoles: ['parent', 'teacher', 'admin']
            },
            admin: {
                id: 'admin',
                name: 'Admin & Teachers',
                members: [],
                messages: [],
                allowedRoles: ['admin', 'teacher']
            }
        };
        return JSON.parse(localStorage.getItem('chatGroups')) || defaultGroups;
    }

    saveChatGroups() {
        localStorage.setItem('chatGroups', JSON.stringify(this.chatGroups));
    }

    loadData() {
        // Try to sync from network first
        this.syncFromNetwork();
        
        const defaultData = {
            students: [
                {id: 1, name: "John Doe", class: "10A", attendance: 85, marks: {math: 78, english: 82, science: 80}, fees: {total: 5000, paid: 3000}, avatar: null, gpa: 0},
                {id: 2, name: "Jane Smith", class: "10B", attendance: 92, marks: {math: 88, english: 90, science: 85}, fees: {total: 5000, paid: 5000}, avatar: null, gpa: 0}
            ],
            teachers: [
                {id: 1, name: "Mr. Wilson", subject: "Math", classes: ["10A", "10B"], email: "wilson@school.com", avatar: null},
                {id: 2, name: "Ms. Johnson", subject: "English", classes: ["10A"], email: "johnson@school.com", avatar: null}
            ],
            classes: ["10A", "10B", "11A"],
            announcements: [
                {id: 1, title: "School Holiday", content: "School closed Monday", date: "2024-01-15", priority: "info"}
            ],
            homework: [
                {id: 1, class: "10A", subject: "Math", task: "Chapter 5 exercises", dueDate: "2024-01-20", status: "pending"}
            ],
            messages: [
                {id: 1, from: "Teacher", to: "Parent", subject: "Progress Update", content: "Good progress", date: "2024-01-10", read: false}
            ],
            events: [
                {id: 1, title: "Parent Meeting", date: "2024-01-18", time: "10:00", type: "meeting"},
                {id: 2, title: "Sports Day", date: "2024-02-15", time: "09:00", type: "event"}
            ],
            library: [
                {id: 1, title: "Mathematics Grade 10", author: "John Smith", isbn: "123456789", available: true, borrowedBy: null}
            ],
            transport: [
                {id: 1, route: "Route A", driver: "Mike Driver", students: ["John Doe"], capacity: 30}
            ],
            exams: [
                {id: 1, subject: "Math", class: "10A", date: "2024-02-01", duration: "2 hours", totalMarks: 100}
            ]
        };
        
        const saved = localStorage.getItem('schoolHubData');
        const data = saved ? JSON.parse(saved) : defaultData;
        
        // Calculate GPA for students
        data.students.forEach(student => {
            const marks = Object.values(student.marks);
            student.gpa = marks.length ? (marks.reduce((sum, mark) => sum + mark, 0) / marks.length / 100 * 4).toFixed(2) : 0;
        });
        
        return data;
    }

    saveData() {
        localStorage.setItem('schoolHubData', JSON.stringify(this.data));
        // Save users to shared file
        const users = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
        const sharedData = {users, messages: this.data.messages, timestamp: Date.now()};
        
        // Try to save to shared file
        try {
            fetch('./shared_data.json', {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(sharedData)
            }).catch(() => {
                // Fallback: save to localStorage with a special key
                localStorage.setItem('SHARED_USERS_' + Date.now(), JSON.stringify(users));
            });
        } catch(e) {
            localStorage.setItem('SHARED_USERS_' + Date.now(), JSON.stringify(users));
        }
    }

    syncToNetwork() {
        try {
            // Get all registered users and messages to sync across devices
            const users = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
            const sharedData = {
                users: users,
                messages: this.data.messages,
                timestamp: Date.now()
            };
            
            // Save to shared localStorage key that all devices can access
            localStorage.setItem('schoolHubShared', JSON.stringify(sharedData));
            
            // Also try to save to sessionStorage as backup
            sessionStorage.setItem('schoolHubShared', JSON.stringify(sharedData));
        } catch (e) {
            console.log('Sync failed:', e);
        }
    }

    syncFromNetwork() {
        try {
            // Try to load from shared storage
            let shared = localStorage.getItem('schoolHubShared');
            if (!shared) {
                shared = sessionStorage.getItem('schoolHubShared');
            }
            
            if (shared) {
                const sharedData = JSON.parse(shared);
                if (sharedData.users && sharedData.users.length > 0) {
                    // Merge users from shared data
                    const existingUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
                    const mergedUsers = [...existingUsers];
                    
                    sharedData.users.forEach(sharedUser => {
                        const exists = mergedUsers.find(u => u.username === sharedUser.username && u.role === sharedUser.role);
                        if (!exists) {
                            mergedUsers.push(sharedUser);
                        }
                    });
                    
                    localStorage.setItem('registeredUsers', JSON.stringify(mergedUsers));
                    
                    // Merge messages
                    if (sharedData.messages && this.data) {
                        const existingMessages = this.data.messages || [];
                        const mergedMessages = [...existingMessages];
                        
                        sharedData.messages.forEach(sharedMsg => {
                            const exists = mergedMessages.find(m => m.id === sharedMsg.id);
                            if (!exists) {
                                mergedMessages.push(sharedMsg);
                            }
                        });
                        
                        if (this.data) {
                            this.data.messages = mergedMessages;
                        }
                    }
                }
            }
        } catch (e) {
            console.log('Sync from network failed:', e);
        }
    }

    startSync() {
        // Sync every 3 seconds to keep data updated across devices
        this.syncInterval = setInterval(() => {
            this.syncFromNetwork();
            // Refresh messages if on messages screen
            if (this.currentSection === 'messages') {
                this.loadContactsInline(this.currentUser.role);
            }
        }, 3000);
    }

    stopSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    init() {
        this.createStyles();
        this.createApp();
        this.checkSession();
        this.startMessagePolling();
        this.applyTheme();
        this.initKeyboardShortcuts();
        this.initDragDrop();
        this.initNotificationCenter();
        this.initMobileSupport();
    }

    checkSession() {
        // Sync data first to get latest users and messages
        this.syncFromNetwork();
        
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            this.startSync(); // Start syncing if user is logged in
            this.showDashboard(this.currentUser.role);
        } else {
            this.renderLoginScreen();
        }
    }

    createStyles() {
        const style = document.createElement('style');
        style.textContent = `
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
            @import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css');
            
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                background: #F3F4F6; 
                height: 100vh; 
                font-weight: 400;
                line-height: 1.6;
                color: #1F2937;
            }
            body.dashboard-mode { overflow: hidden; }
            .app { width: 100%; height: 100vh; }
            .screen { display: none; width: 100%; height: 100%; }
            .screen.active { display: flex; }
            .login { justify-content: center; align-items: center; min-height: 100vh; padding: 20px; overflow-y: auto; }
            .login-box { 
                background: rgba(255, 255, 255, 0.95); 
                backdrop-filter: blur(20px);
                padding: 50px; 
                border-radius: 24px; 
                box-shadow: 0 25px 50px rgba(0,0,0,0.15); 
                width: 480px; 
                border: 1px solid rgba(255,255,255,0.2);
            }
            .login h1 { 
                text-align: center; 
                margin-bottom: 40px; 
                color: #1a202c; 
                font-weight: 700;
                font-size: 32px;
                letter-spacing: -0.5px;
            }
            .form-group { margin-bottom: 24px; position: relative; }
            .form-group label { 
                display: block; 
                margin-bottom: 10px; 
                font-weight: 600; 
                color: #2d3748; 
                font-size: 15px;
                letter-spacing: 0.3px;
            }
            input, select, textarea, button { 
                width: 100%; 
                padding: 16px 20px; 
                border: 2px solid #e2e8f0; 
                border-radius: 16px; 
                font-size: 15px; 
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
                font-family: inherit;
                font-weight: 500;
            }
            input:focus, select:focus, textarea:focus { 
                outline: none; 
                border-color: #667eea; 
                box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
                transform: translateY(-1px);
            }
            button { 
                background: #2563EB; 
                color: white; 
                border: none; 
                cursor: pointer; 
                font-weight: 600; 
                transition: all 0.3s ease;
                font-size: 16px;
                letter-spacing: 0.5px;
            }
            button:hover { 
                transform: translateY(-3px); 
                box-shadow: 0 12px 30px rgba(102, 126, 234, 0.4);
            }
            button:active { transform: translateY(-1px); }
            .dashboard { flex-direction: row; }
            .sidebar { 
                width: 320px; 
                background: #2563EB; 
                color: white; 
                padding: 30px; 
                box-shadow: 4px 0 20px rgba(0,0,0,0.15);
                overflow-y: auto;
                height: 100vh;
            }
            .sidebar h2 { 
                margin-bottom: 40px; 
                text-align: center; 
                font-weight: 700; 
                font-size: 24px;
                letter-spacing: -0.5px;
            }
            .nav-btn { 
                background: transparent; 
                color: rgba(255,255,255,0.8); 
                border: 2px solid rgba(255,255,255,0.1); 
                margin-bottom: 16px; 
                text-align: left; 
                border-radius: 16px; 
                padding: 16px 20px; 
                transition: all 0.3s ease;
                font-weight: 500;
                font-size: 15px;
                display: flex;
                align-items: center;
                gap: 12px;
            }
            .nav-btn:hover, .nav-btn.active { 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                border-color: #667eea; 
                transform: translateX(8px);
                color: white;
                box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
            }
            .main { 
                flex: 1; 
                padding: 40px; 
                background: #f7fafc; 
                overflow-y: auto;
            }
            .header { 
                display: flex; 
                justify-content: space-between; 
                align-items: center; 
                margin-bottom: 40px; 
                padding: 25px 0; 
                border-bottom: 3px solid #e2e8f0;
            }
            .header h2 { 
                color: #1a202c; 
                font-weight: 700; 
                font-size: 32px;
                letter-spacing: -0.8px;
            }
            .header-controls { display: flex; gap: 16px; align-items: center; }
            .theme-toggle { 
                background: linear-gradient(135deg, #f6ad55 0%, #ed8936 100%); 
                width: auto; 
                padding: 12px 24px; 
                border-radius: 30px;
                font-weight: 600;
            }
            .logout { 
                background: linear-gradient(135deg, #f56565 0%, #e53e3e 100%); 
                width: auto; 
                padding: 12px 24px; 
                border-radius: 30px;
                font-weight: 600;
            }
            .card { 
                background: white; 
                padding: 35px; 
                border-radius: 20px; 
                box-shadow: 0 8px 30px rgba(0,0,0,0.08); 
                margin-bottom: 30px; 
                border: 1px solid #e2e8f0;
                transition: all 0.3s ease;
            }
            .card:hover {
                transform: translateY(-2px);
                box-shadow: 0 12px 40px rgba(0,0,0,0.12);
            }
            .card h3 { 
                margin-bottom: 30px; 
                color: #1a202c; 
                font-weight: 700; 
                font-size: 24px;
                letter-spacing: -0.5px;
                display: flex;
                align-items: center;
                gap: 12px;
            }
            .stats { 
                display: grid; 
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
                gap: 30px; 
                margin-bottom: 40px;
            }
            .stat { 
                background: white; 
                padding: 30px; 
                border-radius: 20px; 
                text-align: center; 
                box-shadow: 0 8px 30px rgba(0,0,0,0.08); 
                border-left: 6px solid #667eea; 
                transition: all 0.3s ease;
                position: relative;
                overflow: hidden;
            }
            .stat::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 4px;
                background: linear-gradient(90deg, #667eea, #764ba2);
            }
            .stat:hover { 
                transform: translateY(-8px); 
                box-shadow: 0 20px 50px rgba(102, 126, 234, 0.15);
            }
            .stat h4 { 
                font-size: 2.8rem; 
                margin-bottom: 15px; 
                color: #667eea; 
                font-weight: 800;
                letter-spacing: -1px;
            }
            .stat p { 
                color: #4a5568; 
                font-weight: 600;
                font-size: 16px;
                letter-spacing: 0.3px;
            }
            .data-grid { display: grid; gap: 25px; }
            .data-item { 
                background: white; 
                padding: 30px; 
                border-radius: 20px; 
                border-left: 6px solid #667eea; 
                box-shadow: 0 8px 30px rgba(0,0,0,0.08); 
                transition: all 0.3s ease;
                position: relative;
            }
            .data-item:hover { 
                transform: translateY(-4px); 
                box-shadow: 0 15px 40px rgba(0,0,0,0.12);
            }
            .data-item h4 { 
                margin-bottom: 20px; 
                color: #1a202c; 
                font-weight: 700; 
                font-size: 20px;
                letter-spacing: -0.3px;
            }
            .data-item p { 
                margin-bottom: 10px; 
                color: #4a5568; 
                line-height: 1.6;
                font-weight: 500;
            }
            .btn-group { 
                display: flex; 
                gap: 15px; 
                margin-top: 25px; 
                flex-wrap: wrap;
            }
            .btn { 
                width: auto; 
                padding: 12px 20px; 
                font-size: 14px; 
                border-radius: 12px; 
                font-weight: 600; 
                transition: all 0.3s ease;
                letter-spacing: 0.3px;
            }
            .btn:hover { transform: translateY(-2px); }
            .btn-primary { background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%); }
            .btn-success { background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); }
            .btn-warning { background: linear-gradient(135deg, #ed8936 0%, #dd6b20 100%); }
            .btn-danger { background: linear-gradient(135deg, #f56565 0%, #e53e3e 100%); }
            .btn-secondary { background: linear-gradient(135deg, #a0aec0 0%, #718096 100%); }
            .notification { 
                position: fixed; 
                top: 30px; 
                right: 30px; 
                color: white; 
                padding: 20px 28px; 
                border-radius: 16px; 
                box-shadow: 0 12px 35px rgba(0,0,0,0.15); 
                z-index: 1000; 
                max-width: 400px; 
                animation: slideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                font-weight: 600;
                font-size: 15px;
            }
            .notification.success { background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); }
            .notification.error { background: linear-gradient(135deg, #f56565 0%, #e53e3e 100%); }
            .notification.info { background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%); }
            @keyframes slideIn { 
                from { transform: translateX(100%) scale(0.8); opacity: 0; } 
                to { transform: translateX(0) scale(1); opacity: 1; }
            }
            .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; }
            .form-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }
            .input-icon { position: relative; }
            .input-icon input, .input-icon select { padding-left: 50px; }
            .input-icon::before { 
                content: attr(data-icon); 
                position: absolute; 
                left: 18px; 
                top: 50%; 
                transform: translateY(-50%); 
                color: #a0aec0; 
                font-size: 18px; 
                z-index: 1;
                font-weight: 600;
            }
            .modal { 
                position: fixed; 
                top: 0; 
                left: 0; 
                width: 100%; 
                height: 100%; 
                background: rgba(0,0,0,0.6); 
                display: none; 
                justify-content: center; 
                align-items: center; 
                z-index: 2000;
                backdrop-filter: blur(8px);
            }
            .modal.active { display: flex; }
            .modal-content { 
                background: white; 
                padding: 40px; 
                border-radius: 24px; 
                width: 90%; 
                max-width: 700px; 
                max-height: 85vh; 
                overflow-y: auto; 
                box-shadow: 0 25px 80px rgba(0,0,0,0.3);
                animation: modalSlide 0.3s ease;
            }
            @keyframes modalSlide {
                from { transform: scale(0.8) translateY(50px); opacity: 0; }
                to { transform: scale(1) translateY(0); opacity: 1; }
            }
            .modal-header { 
                display: flex; 
                justify-content: space-between; 
                align-items: center; 
                margin-bottom: 30px; 
                padding-bottom: 20px; 
                border-bottom: 3px solid #e2e8f0;
            }
            .modal-header h3 { 
                color: #1a202c; 
                font-weight: 700; 
                font-size: 26px;
                letter-spacing: -0.5px;
            }
            .close-modal { 
                background: #f56565; 
                color: white; 
                border: none; 
                width: 40px; 
                height: 40px; 
                border-radius: 50%; 
                cursor: pointer; 
                font-size: 20px;
                font-weight: 700;
                transition: all 0.3s ease;
            }
            .close-modal:hover {
                background: #e53e3e;
                transform: scale(1.1);
            }
            .contact-dropdown {
                background: white;
                border: 2px solid #e2e8f0;
                border-radius: 16px;
                padding: 16px 20px;
                font-size: 15px;
                font-weight: 500;
                color: #2d3748;
                transition: all 0.3s ease;
                margin-bottom: 20px;
            }
            .contact-dropdown:focus {
                border-color: #667eea;
                box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
            }: space-between; 
                align-items: center; 
                margin-bottom: 40px; 
                padding: 25px 0; 
                border-bottom: 3px solid #e2e8f0;
            }
            .header h2 { 
                color: #1a202c; 
                font-weight: 700; 
                font-size: 32px;
                letter-spacing: -0.8px;
            }
            .header-controls { display: flex; gap: 16px; align-items: center; }
            .theme-toggle { 
                background: linear-gradient(135deg, #f6ad55 0%, #ed8936 100%); 
                width: auto; 
                padding: 12px 24px; 
                border-radius: 30px;
                font-weight: 600;
            }
            .logout { 
                background: linear-gradient(135deg, #f56565 0%, #e53e3e 100%); 
                width: auto; 
                padding: 12px 24px; 
                border-radius: 30px;
                font-weight: 600;
            }
            .card { 
                background: white; 
                padding: 35px; 
                border-radius: 20px; 
                box-shadow: 0 8px 30px rgba(0,0,0,0.08); 
                margin-bottom: 30px; 
                border: 1px solid #e2e8f0;
                transition: all 0.3s ease;
            }
            .card:hover {
                transform: translateY(-2px);
                box-shadow: 0 12px 40px rgba(0,0,0,0.12);
            }
            .card h3 { 
                margin-bottom: 30px; 
                color: #1a202c; 
                font-weight: 700; 
                font-size: 24px;
                letter-spacing: -0.5px;
                display: flex;
                align-items: center;
                gap: 12px;
            }
            .stats { 
                display: grid; 
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
                gap: 30px; 
                margin-bottom: 40px;
            }
            .stat { 
                background: white; 
                padding: 30px; 
                border-radius: 20px; 
                text-align: center; 
                box-shadow: 0 8px 30px rgba(0,0,0,0.08); 
                border-left: 6px solid #667eea; 
                transition: all 0.3s ease;
                position: relative;
                overflow: hidden;
            }
            .stat::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 4px;
                background: linear-gradient(90deg, #667eea, #764ba2);
            }
            .stat:hover { 
                transform: translateY(-8px); 
                box-shadow: 0 20px 50px rgba(102, 126, 234, 0.15);
            }
            .stat h4 { 
                font-size: 2.8rem; 
                margin-bottom: 15px; 
                color: #667eea; 
                font-weight: 800;
                letter-spacing: -1px;
            }
            .stat p { 
                color: #4a5568; 
                font-weight: 600;
                font-size: 16px;
                letter-spacing: 0.3px;
            }
            .data-grid { display: grid; gap: 25px; }
            .data-item { 
                background: white; 
                padding: 30px; 
                border-radius: 20px; 
                border-left: 6px solid #667eea; 
                box-shadow: 0 8px 30px rgba(0,0,0,0.08); 
                transition: all 0.3s ease;
                position: relative;
            }
            .data-item:hover { 
                transform: translateY(-4px); 
                box-shadow: 0 15px 40px rgba(0,0,0,0.12);
            }
            .data-item h4 { 
                margin-bottom: 20px; 
                color: #1a202c; 
                font-weight: 700; 
                font-size: 20px;
                letter-spacing: -0.3px;
            }
            .data-item p { 
                margin-bottom: 10px; 
                color: #4a5568; 
                line-height: 1.6;
                font-weight: 500;
            }
            .btn-group { 
                display: flex; 
                gap: 15px; 
                margin-top: 25px; 
                flex-wrap: wrap;
            }
            .btn { 
                width: auto; 
                padding: 12px 20px; 
                font-size: 14px; 
                border-radius: 12px; 
                font-weight: 600; 
                transition: all 0.3s ease;
                letter-spacing: 0.3px;
            }
            .btn:hover { transform: translateY(-2px); }
            .btn-primary { background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%); }
            .btn-success { background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); }
            .btn-warning { background: linear-gradient(135deg, #ed8936 0%, #dd6b20 100%); }
            .btn-danger { background: linear-gradient(135deg, #f56565 0%, #e53e3e 100%); }
            .btn-secondary { background: linear-gradient(135deg, #a0aec0 0%, #718096 100%); }
            .notification { 
                position: fixed; 
                top: 30px; 
                right: 30px; 
                color: white; 
                padding: 20px 28px; 
                border-radius: 16px; 
                box-shadow: 0 12px 35px rgba(0,0,0,0.15); 
                z-index: 1000; 
                max-width: 400px; 
                animation: slideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                font-weight: 600;
                font-size: 15px;
            }
            .notification.success { background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); }
            .notification.error { background: linear-gradient(135deg, #f56565 0%, #e53e3e 100%); }
            .notification.info { background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%); }
            @keyframes slideIn { 
                from { transform: translateX(100%) scale(0.8); opacity: 0; } 
                to { transform: translateX(0) scale(1); opacity: 1; }
            }
            .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; }
            .form-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }
            .input-icon { position: relative; }
            .input-icon input, .input-icon select { padding-left: 50px; }
            .input-icon::before { 
                content: attr(data-icon); 
                position: absolute; 
                left: 18px; 
                top: 50%; 
                transform: translateY(-50%); 
                color: #a0aec0; 
                font-size: 18px; 
                z-index: 1;
                font-weight: 600;
            }
            .modal { 
                position: fixed; 
                top: 0; 
                left: 0; 
                width: 100%; 
                height: 100%; 
                background: rgba(0,0,0,0.6); 
                display: none; 
                justify-content: center; 
                align-items: center; 
                z-index: 2000;
                backdrop-filter: blur(8px);
            }
            .modal.active { display: flex; }
            .modal-content { 
                background: white; 
                padding: 40px; 
                border-radius: 24px; 
                width: 90%; 
                max-width: 700px; 
                max-height: 85vh; 
                overflow-y: auto; 
                box-shadow: 0 25px 80px rgba(0,0,0,0.3);
                animation: modalSlide 0.3s ease;
            }
            @keyframes modalSlide {
                from { transform: scale(0.8) translateY(50px); opacity: 0; }
                to { transform: scale(1) translateY(0); opacity: 1; }
            }
            .modal-header { 
                display: flex; 
                justify-content: space-between; 
                align-items: center; 
                margin-bottom: 30px; 
                padding-bottom: 20px; 
                border-bottom: 3px solid #e2e8f0;
            }
            .modal-header h3 { 
                color: #1a202c; 
                font-weight: 700; 
                font-size: 26px;
                letter-spacing: -0.5px;
            }
            .close-modal { 
                background: #f56565; 
                color: white; 
                border: none; 
                width: 40px; 
                height: 40px; 
                border-radius: 50%; 
                cursor: pointer; 
                font-size: 20px;
                font-weight: 700;
                transition: all 0.3s ease;
            }
            .close-modal:hover {
                background: #e53e3e;
                transform: scale(1.1);
            }
            .contact-dropdown {
                background: white;
                border: 2px solid #e2e8f0;
                border-radius: 16px;
                padding: 16px 20px;
                font-size: 15px;
                font-weight: 500;
                color: #2d3748;
                transition: all 0.3s ease;
                margin-bottom: 20px;
            }
            .contact-dropdown:focus {
                border-color: #667eea;
                box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
            }
        `;
        document.head.appendChild(style);
        
        // Add mobile responsive styles
        const mobileStyles = document.createElement('style');
        mobileStyles.textContent = `
            /* Mobile Responsive Styles */
            .mobile-header {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                height: 60px;
                background: #2563EB;
                color: white;
                z-index: 1001;
                align-items: center;
                padding: 0 15px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            
            .menu-toggle {
                background: none;
                border: none;
                color: white;
                cursor: pointer;
                padding: 10px;
                margin-right: 15px;
                display: flex;
                flex-direction: column;
                justify-content: space-around;
                width: 30px;
                height: 30px;
            }
            
            .hamburger {
                width: 25px;
                height: 3px;
                background: white;
                border-radius: 2px;
                transition: 0.3s;
            }
            
            .mobile-title {
                display: flex;
                align-items: center;
                font-weight: bold;
                font-size: 18px;
            }
            
            .sidebar-overlay {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.5);
                z-index: 999;
            }
            
            @media (max-width: 768px) {
                .mobile-header {
                    display: flex;
                }
                
                .sidebar {
                    position: fixed;
                    top: 60px;
                    left: -100%;
                    width: 320px;
                    height: calc(100vh - 60px);
                    transition: left 0.3s ease;
                    z-index: 1000;
                    box-shadow: 2px 0 10px rgba(0,0,0,0.1);
                }
                
                .sidebar.visible {
                    left: 0;
                }
                
                .sidebar-overlay {
                    display: block;
                }
                
                .main {
                    margin-left: 0 !important;
                    padding: 5px !important;
                    padding-top: 70px !important;
                    font-size: 12px;
                    width: 100%;
                }
                
                .header {
                    display: none;
                }
                
                .stats {
                    grid-template-columns: 1fr;
                    gap: 8px;
                }
                
                .stat {
                    padding: 10px;
                }
                
                .stat h4 {
                    font-size: 1.5rem;
                }
                
                .card {
                    padding: 10px;
                    margin-bottom: 10px;
                }
                
                .card h3 {
                    font-size: 16px;
                    margin-bottom: 10px;
                }
                
                .btn-group {
                    flex-direction: column;
                    gap: 6px;
                }
                
                .btn-group .btn {
                    width: 100%;
                    padding: 10px;
                    font-size: 12px;
                }
                
                .btn {
                    padding: 8px 12px;
                    font-size: 11px;
                }
                
                .modal-content {
                    margin: 5px;
                    width: calc(100% - 10px);
                    max-height: calc(100vh - 10px);
                    padding: 15px;
                }
                
                .form-row {
                    grid-template-columns: 1fr;
                    gap: 8px;
                }
                
                .form-row-3 {
                    grid-template-columns: 1fr;
                    gap: 8px;
                }
                
                .form-group {
                    margin-bottom: 10px;
                }
                
                input, select, textarea {
                    padding: 10px 12px;
                    font-size: 12px;
                }
                
                .login-box {
                    padding: 20px;
                    width: 95%;
                    max-width: 350px;
                }
                
                .login h1 {
                    font-size: 20px;
                    margin-bottom: 20px;
                }
                
                .data-item {
                    padding: 10px;
                }
                
                .data-item h4 {
                    font-size: 14px;
                }
                
                .nav-btn {
                    padding: 10px 12px;
                    font-size: 12px;
                    margin-bottom: 6px;
                }
                
                .sidebar h2 {
                    font-size: 16px;
                    margin-bottom: 15px;
                }
            }
            
            @media (min-width: 769px) {
                .sidebar {
                    position: fixed;
                    left: 0;
                    transition: left 0.3s ease;
                }
                
                .sidebar:not(.visible) {
                    left: -320px;
                }
                
                .main {
                    margin-left: 320px;
                    transition: margin-left 0.3s ease;
                }
                
                .main.sidebar-collapsed {
                    margin-left: 0 !important;
                }
            }
        `;
        document.head.appendChild(mobileStyles);
        
        // Add professional styles
        const professionalStyles = document.createElement('style');
        professionalStyles.textContent = `
            .loading-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 9999; }
            .spinner { width: 50px; height: 50px; border: 5px solid #f3f3f3; border-top: 5px solid #2563EB; border-radius: 50%; animation: spin 1s linear infinite; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            .error-message { color: #e53e3e; font-size: 12px; margin-top: 5px; display: none; }
            .success-message { color: #38a169; font-size: 12px; margin-top: 5px; display: none; }
            .confirmation-dialog { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 3000; }
            .confirmation-content { background: white; padding: 30px; border-radius: 16px; text-align: center; max-width: 400px; }
            .search-box { width: 100%; padding: 12px 20px; border: 2px solid #e2e8f0; border-radius: 12px; margin-bottom: 20px; }
            .bulk-actions { display: none; background: #f7fafc; padding: 15px; border-radius: 12px; margin-bottom: 20px; }
            .bulk-actions.active { display: block; }
            .checkbox-item { margin-right: 10px; }
            .print-button { background: #6b46c1; }
            .export-button { background: #059669; }
            .session-warning { position: fixed; top: 20px; right: 20px; background: #f59e0b; color: white; padding: 15px; border-radius: 12px; z-index: 1001; }
            .drag-drop-area { border: 2px dashed #e2e8f0; border-radius: 12px; padding: 40px; text-align: center; transition: all 0.3s ease; }
            .drag-drop-area.dragover { border-color: #2563EB; background: #f0f9ff; }
            .progress-bar { width: 100%; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; margin: 10px 0; }
            .progress-fill { height: 100%; background: #2563EB; transition: width 0.3s ease; }
            .pagination { display: flex; justify-content: center; gap: 10px; margin: 20px 0; }
            .pagination button { padding: 8px 12px; border: 1px solid #e2e8f0; background: white; border-radius: 6px; }
            .pagination button.active { background: #2563EB; color: white; }
            .filter-bar { display: flex; gap: 15px; margin-bottom: 20px; flex-wrap: wrap; }
            .mobile-menu { display: none; }
            @media (max-width: 768px) {
                .dashboard { flex-direction: column; }
                .sidebar { width: 100%; height: auto; }
                .main { padding: 20px; }
                .mobile-menu { display: block; }
                .stats { grid-template-columns: 1fr; }
                .form-row { grid-template-columns: 1fr; }
            }
            .notification-center { position: fixed; top: 80px; right: 20px; width: 300px; z-index: 1002; }
            .live-notification { background: white; border-left: 4px solid #2563EB; padding: 15px; margin-bottom: 10px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            .keyboard-shortcut { position: fixed; bottom: 20px; left: 20px; background: rgba(0,0,0,0.8); color: white; padding: 10px; border-radius: 8px; font-size: 12px; }
        `;
        document.head.appendChild(professionalStyles);
    }

    // Security and validation methods
    async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password + 'schoolhub_salt');
        const hash = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async verifyPassword(password, hash) {
        const hashedInput = await this.hashPassword(password);
        return hashedInput === hash;
    }

    validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    validatePassword(password) {
        return password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password);
    }

    validateForm(fields) {
        let isValid = true;
        fields.forEach(field => {
            if (!field.value || field.value.trim() === '') {
                this.showFieldError(field.id, 'This field is required');
                isValid = false;
            } else {
                this.hideFieldError(field.id);
            }
        });
        return isValid;
    }

    showFieldError(fieldId, message) {
        const field = document.getElementById(fieldId);
        if (field) {
            field.style.borderColor = '#e53e3e';
            let errorDiv = field.parentNode.querySelector('.error-message');
            if (!errorDiv) {
                errorDiv = document.createElement('div');
                errorDiv.className = 'error-message';
                field.parentNode.appendChild(errorDiv);
            }
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        }
    }

    hideFieldError(fieldId) {
        const field = document.getElementById(fieldId);
        if (field) {
            field.style.borderColor = '#e2e8f0';
            const errorDiv = field.parentNode.querySelector('.error-message');
            if (errorDiv) {
                errorDiv.style.display = 'none';
            }
        }
    }

    // Loading states
    showLoading(message = 'Loading...') {
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div style="text-align: center; color: white;">
                <div class="spinner"></div>
                <p style="margin-top: 20px; font-weight: 600;">${message}</p>
            </div>
        `;
        document.body.appendChild(overlay);
        this.currentLoadingOverlay = overlay;
    }

    hideLoading() {
        if (this.currentLoadingOverlay) {
            this.currentLoadingOverlay.remove();
            this.currentLoadingOverlay = null;
        }
    }

    // Session management
    startSessionTimer() {
        this.clearSessionTimer();
        this.sessionTimer = setTimeout(() => {
            this.showSessionWarning();
        }, this.sessionTimeout - 5 * 60 * 1000); // 5 minutes before timeout
    }

    clearSessionTimer() {
        if (this.sessionTimer) {
            clearTimeout(this.sessionTimer);
            this.sessionTimer = null;
        }
    }

    showSessionWarning() {
        const warning = document.createElement('div');
        warning.className = 'session-warning';
        warning.innerHTML = `
            <p>Your session will expire in 5 minutes.</p>
            <button onclick="app.extendSession()" style="background: white; color: #f59e0b; border: none; padding: 5px 10px; border-radius: 5px; margin-top: 10px;">Extend Session</button>
        `;
        document.body.appendChild(warning);
        
        setTimeout(() => {
            if (warning.parentNode) {
                this.logout();
            }
        }, 5 * 60 * 1000);
    }

    extendSession() {
        this.startSessionTimer();
        const warning = document.querySelector('.session-warning');
        if (warning) warning.remove();
        this.showNotification('Session extended', 'success');
    }

    // Audit logging
    logAuditEvent(action, details) {
        const auditLog = JSON.parse(localStorage.getItem('auditLog') || '[]');
        auditLog.push({
            id: Date.now(),
            timestamp: new Date().toISOString(),
            user: this.currentUser?.username || 'anonymous',
            action,
            details,
            ip: 'localhost' // In real app, get actual IP
        });
        
        // Keep only last 1000 entries
        if (auditLog.length > 1000) {
            auditLog.splice(0, auditLog.length - 1000);
        }
        
        localStorage.setItem('auditLog', JSON.stringify(auditLog));
    }

    // Confirmation dialogs
    showConfirmation(message, onConfirm, onCancel = null) {
        const dialog = document.createElement('div');
        dialog.className = 'confirmation-dialog';
        dialog.innerHTML = `
            <div class="confirmation-content">
                <h3>Confirm Action</h3>
                <p style="margin: 20px 0;">${message}</p>
                <div style="display: flex; gap: 15px; justify-content: center;">
                    <button class="btn btn-danger" onclick="app.handleConfirmation(true)">Yes, Delete</button>
                    <button class="btn btn-secondary" onclick="app.handleConfirmation(false)">Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(dialog);
        this.currentConfirmation = { dialog, onConfirm, onCancel };
    }

    handleConfirmation(confirmed) {
        if (this.currentConfirmation) {
            if (confirmed && this.currentConfirmation.onConfirm) {
                this.currentConfirmation.onConfirm();
            } else if (!confirmed && this.currentConfirmation.onCancel) {
                this.currentConfirmation.onCancel();
            }
            this.currentConfirmation.dialog.remove();
            this.currentConfirmation = null;
        }
    }

    createApp() {
        document.body.innerHTML = '<div class="app" id="app"></div>';
    }

    createChatWindow() {
        const chatHTML = `
            <button class="chat-toggle" onclick="app.toggleChat()" id="chat-toggle">💬</button>
            <div class="chat-window" id="chat-window">
                <div class="chat-container">
                    <div class="chat-header">
                        <div class="avatar"></div>
                        <div class="chat-title">
                            <h3 id="chat-contact-name">Select Contact</h3>
                            <span id="chat-contact-status">Offline</span>
                        </div>
                        <button class="close-btn" onclick="app.toggleChat()">×</button>
                    </div>
                    <div class="chat-main">
                        <div class="contacts-sidebar" id="contacts-sidebar">
                            <!-- Contacts will be loaded here -->
                        </div>
                        <div class="chat-area">
                            <div class="chat-messages" id="chat-messages">
                                <div class="empty-chat">
                                    <div class="empty-chat-icon">💬</div>
                                    <p>Select a contact to start messaging</p>
                                </div>
                            </div>
                            <div class="chat-input">
                                <input type="text" id="chat-input" placeholder="Type a message..." onkeypress="if(event.key==='Enter') app.sendChatMessage()">
                                <button onclick="app.sendChatMessage()">➤</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', chatHTML);
    }

    renderLoginScreen() {
        document.body.classList.remove('dashboard-mode');
        document.getElementById('app').innerHTML = `
            <div class="screen login active">
                <div class="login-box">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <div style="width: 80px; height: 80px; background: #2563EB; border-radius: 50%; margin: 0 auto 15px; display: flex; align-items: center; justify-content: center; color: white; font-size: 32px; font-weight: 700;">SC</div>
                        <h1>Southern Cross School</h1>
                        <p style="color: #6B7280; margin-top: 5px;">School Management System</p>
                    </div>
                    <div id="login-form">
                        <div class="form-group">
                            <label>Role:</label>
                            <select id="role">
                                <option value="">Select Role</option>
                                <option value="admin">Admin</option>
                                <option value="teacher">Teacher</option>
                                <option value="parent">Parent</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Username:</label>
                            <input type="text" id="username" placeholder="Enter username">
                        </div>
                        <div class="form-group">
                            <label>Password:</label>
                            <input type="password" id="password" placeholder="Enter password">
                        </div>
                        <button onclick="app.login()">Login</button>
                        <button onclick="app.showRegisterScreen()" style="background: #27ae60; margin-top: 10px;">Register New Account</button>
                    </div>
                    <div id="register-form" style="display: none;">
                        <div class="form-group">
                            <label>Role:</label>
                            <select id="reg-role" onchange="app.showRoleSpecificFields(this.value)">
                                <option value="">Select Role</option>
                                <option value="admin">Admin</option>
                                <option value="teacher">Teacher</option>
                                <option value="parent">Parent</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Full Name:</label>
                            <input type="text" id="reg-name" placeholder="Enter full name">
                        </div>
                        <div class="form-group">
                            <label>Email:</label>
                            <input type="email" id="reg-email" placeholder="Enter email">
                        </div>
                        <div class="form-group">
                            <label>Username:</label>
                            <input type="text" id="reg-username" placeholder="Choose username">
                        </div>
                        <div class="form-group">
                            <label>Password:</label>
                            <input type="password" id="reg-password" placeholder="Choose password">
                        </div>
                        <div class="form-group">
                            <label>Confirm Password:</label>
                            <input type="password" id="reg-confirm" placeholder="Confirm password">
                        </div>
                        <div id="role-specific-fields"></div>
                        <button onclick="app.register()">Register</button>
                        <button onclick="app.showLoginScreen()" style="background: #95a5a6; margin-top: 10px;">Back to Login</button>
                    </div>
                </div>
            </div>
        `;
    }

    async login() {
        const role = document.getElementById('role').value;
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        if (!this.validateForm([{id: 'role', value: role}, {id: 'username', value: username}, {id: 'password', value: password}])) {
            return;
        }

        // Load users from shared file first
        try {
            const response = await fetch('./shared_data.json');
            const sharedData = await response.json();
            if (sharedData.users && sharedData.users.length > 0) {
                localStorage.setItem('registeredUsers', JSON.stringify(sharedData.users));
            }
        } catch(e) {
            // Fallback: check for shared localStorage keys
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('SHARED_USERS_')) {
                    const sharedUsers = JSON.parse(localStorage.getItem(key) || '[]');
                    const existingUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
                    sharedUsers.forEach(sharedUser => {
                        const exists = existingUsers.find(u => u.username === sharedUser.username && u.role === sharedUser.role);
                        if (!exists) {
                            existingUsers.push(sharedUser);
                        }
                    });
                    localStorage.setItem('registeredUsers', JSON.stringify(existingUsers));
                }
            });
        }

        const users = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
        const user = users.find(u => u.username === username && u.role === role);
        
        if (user && password === user.password) {
            this.currentUser = { role, username, name: user.name, email: user.email, id: user.id, phone: user.phone || '', address: user.address || '' };
            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
            this.startSessionTimer();
            this.logAuditEvent('login', `User ${username} logged in`);
            this.showDashboard(role);
            this.showNotification(`Welcome back, ${user.name}!`, 'success');
            this.addUserToGroups(user, this.getUserGroups(role));
        } else {
            this.showNotification('Invalid credentials! Please register first.', 'error');
        }
    }

    showRegisterScreen() {
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('register-form').style.display = 'block';
    }

    showLoginScreen() {
        document.getElementById('login-form').style.display = 'block';
        document.getElementById('register-form').style.display = 'none';
    }

    showRoleSpecificFields(role) {
        const fieldsDiv = document.getElementById('role-specific-fields');
        let fields = '';
        
        switch(role) {
            case 'teacher':
                fields = `
                    <div class="form-group">
                        <label>Subject:</label>
                        <input type="text" id="reg-subject" placeholder="Teaching subject">
                    </div>
                `;
                break;
            case 'parent':
                fields = `
                    <div class="form-group">
                        <label>Child's Name:</label>
                        <input type="text" id="reg-child" placeholder="Child's full name">
                    </div>
                    <div class="form-group">
                        <label>Child's Class:</label>
                        <select id="reg-child-class">
                            <option value="10A">10A</option>
                            <option value="10B">10B</option>
                            <option value="11A">11A</option>
                        </select>
                    </div>
                `;
                break;
            case 'admin':
                fields = `
                    <div class="form-group">
                        <label>Admin Code:</label>
                        <input type="text" id="reg-admin-code" placeholder="Enter SC2026ADMIN">
                    </div>
                `;
                break;
        }
        
        fieldsDiv.innerHTML = fields;
    }

    async register() {
        const role = document.getElementById('reg-role').value;
        const name = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const username = document.getElementById('reg-username').value;
        const password = document.getElementById('reg-password').value;
        const confirm = document.getElementById('reg-confirm').value;
        
        const fields = [{id: 'reg-role', value: role}, {id: 'reg-name', value: name}, {id: 'reg-email', value: email}, {id: 'reg-username', value: username}, {id: 'reg-password', value: password}, {id: 'reg-confirm', value: confirm}];
        
        if (!this.validateForm(fields)) {
            return;
        }
        
        if (!this.validateEmail(email)) {
            this.showFieldError('reg-email', 'Please enter a valid email address');
            return;
        }
        
        if (password !== confirm) {
            this.showFieldError('reg-confirm', 'Passwords do not match');
            return;
        }
        
        const users = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
        const existingUser = users.find(u => u.username === username && u.role === role);
        if (existingUser) {
            this.showFieldError('reg-username', 'Username with this role already exists');
            return;
        }
        
        if (role === 'admin') {
            const adminCode = document.getElementById('reg-admin-code').value;
            if (adminCode !== 'SC2026ADMIN') {
                this.showFieldError('reg-admin-code', 'Invalid admin code');
                return;
            }
        }
        
        const newUser = {
            id: Date.now(),
            role,
            name,
            email,
            username,
            password: password,
            phone: '',
            address: '',
            registeredDate: new Date().toISOString().split('T')[0],
            lastLogin: null,
            isActive: true
        };
        
        users.push(newUser);
        localStorage.setItem('registeredUsers', JSON.stringify(users));
        localStorage.setItem('ALL_USERS_GLOBAL', JSON.stringify(users));
        
        if (role === 'parent') {
            const childName = document.getElementById('reg-child').value;
            const childClass = document.getElementById('reg-child-class').value;
            if (childName && childClass) {
                const childStudent = {
                    id: Date.now() + 1,
                    name: childName,
                    class: childClass,
                    attendance: 100,
                    marks: {math: 0, english: 0, science: 0},
                    fees: {total: 5000, paid: 0},
                    parent: name,
                    avatar: null,
                    gpa: 0
                };
                this.data.students.push(childStudent);
                this.saveData();
            }
        }
        
        this.addUserToGroups(newUser, this.getUserGroups(role));
        this.logAuditEvent('register', `New user ${username} registered with role ${role}`);
        
        this.showNotification('Registration successful! Please login.', 'success');
        document.getElementById('login-form').style.display = 'block';
        document.getElementById('register-form').style.display = 'none';
    }

    showDashboard(role) {
        const screens = {
            admin: this.createAdminScreen(),
            teacher: this.createTeacherScreen(),
            parent: this.createParentScreen()
        };
        
        document.body.classList.add('dashboard-mode');
        document.getElementById('app').innerHTML = screens[role];
        this.loadSection('dashboard', role);
    }

    createAdminScreen() {
        return `
            <div class="screen dashboard active">
                <div class="sidebar">
                    <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                        <div style="width: 60px; height: 60px; background: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: 700;">SC</div>
                        <h3 style="color: white; font-size: 16px; margin: 0;">Southern Cross</h3>
                    </div>
                    <h2><i class="fas fa-graduation-cap"></i> Admin Panel</h2>
                    <button class="nav-btn active" onclick="app.loadSection('dashboard', 'admin')"><i class="fas fa-chart-line"></i> Dashboard</button>
                    <button class="nav-btn" onclick="app.loadSection('students', 'admin')"><i class="fas fa-user-graduate"></i> Students</button>
                    <button class="nav-btn" onclick="app.loadSection('teachers', 'admin')"><i class="fas fa-chalkboard-teacher"></i> Teachers</button>
                    <button class="nav-btn" onclick="app.loadSection('classes', 'admin')"><i class="fas fa-school"></i> Classes</button>
                    <button class="nav-btn" onclick="app.loadSection('fees', 'admin')"><i class="fas fa-dollar-sign"></i> Fees</button>
                    <button class="nav-btn" onclick="app.loadSection('announcements', 'admin')"><i class="fas fa-bullhorn"></i> Announcements</button>
                    <button class="nav-btn" onclick="app.loadSection('reports', 'admin')"><i class="fas fa-chart-bar"></i> Reports</button>
                    <button class="nav-btn" onclick="app.loadSection('messages', 'admin')"><i class="fas fa-envelope"></i> Messages</button>
                    <button class="nav-btn" onclick="app.loadSection('calendar', 'admin')"><i class="fas fa-calendar-alt"></i> Calendar</button>
                    <button class="nav-btn" onclick="app.loadSection('library', 'admin')"><i class="fas fa-book"></i> Library</button>
                    <button class="nav-btn" onclick="app.loadSection('transport', 'admin')"><i class="fas fa-bus"></i> Transport</button>
                    <button class="nav-btn" onclick="app.loadSection('exams', 'admin')"><i class="fas fa-clipboard-list"></i> Exams</button>
                    <button class="nav-btn" onclick="app.loadSection('certificates', 'admin')"><i class="fas fa-certificate"></i> Certificates</button>
                    <button class="nav-btn" onclick="app.loadSection('account', 'admin')"><i class="fas fa-user-circle"></i> My Account</button>
                </div>
                <div class="main">
                    <div class="header">
                        <h2 id="page-title">Admin Dashboard</h2>
                        <div class="header-controls">
                            <button class="theme-toggle" onclick="app.toggleSidebar()" style="background: #6B7280; margin-right: 10px;"><i class="fas fa-bars"></i> Menu</button>
                            <button class="theme-toggle" onclick="app.toggleTheme()"><i class="fas fa-moon"></i> Theme</button>
                            <button class="logout" onclick="app.logout()"><i class="fas fa-sign-out-alt"></i> Logout</button>
                        </div>
                    </div>
                    <div id="content"></div>
                </div>
            </div>
        `;
    }

    createTeacherScreen() {
        return `
            <div class="screen dashboard active">
                <div class="sidebar">
                    <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                        <div style="width: 60px; height: 60px; background: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: 700;">SC</div>
                        <h3 style="color: white; font-size: 16px; margin: 0;">Southern Cross</h3>
                    </div>
                    <h2><i class="fas fa-chalkboard-teacher"></i> Teacher Panel</h2>
                    <button class="nav-btn active" onclick="app.loadSection('dashboard', 'teacher')"><i class="fas fa-chart-line"></i> Dashboard</button>
                    <button class="nav-btn" onclick="app.loadSection('classes', 'teacher')"><i class="fas fa-school"></i> My Classes</button>
                    <button class="nav-btn" onclick="app.loadSection('attendance', 'teacher')"><i class="fas fa-check-circle"></i> Attendance</button>
                    <button class="nav-btn" onclick="app.loadSection('marks', 'teacher')"><i class="fas fa-star"></i> Marks</button>
                    <button class="nav-btn" onclick="app.loadSection('homework', 'teacher')"><i class="fas fa-book-open"></i> Homework</button>
                    <button class="nav-btn" onclick="app.loadSection('timetable', 'teacher')"><i class="fas fa-clock"></i> Timetable</button>
                    <button class="nav-btn" onclick="app.loadSection('messages', 'teacher')"><i class="fas fa-envelope"></i> Messages</button>
                    <button class="nav-btn" onclick="app.loadSection('calendar', 'teacher')"><i class="fas fa-calendar-alt"></i> Calendar</button>
                    <button class="nav-btn" onclick="app.loadSection('exams', 'teacher')"><i class="fas fa-clipboard-list"></i> Exams</button>
                    <button class="nav-btn" onclick="app.loadSection('account', 'teacher')"><i class="fas fa-user-circle"></i> My Account</button>
                </div>
                <div class="main">
                    <div class="header">
                        <h2 id="page-title">Teacher Dashboard</h2>
                        <div class="header-controls">
                            <button class="theme-toggle" onclick="app.toggleSidebar()" style="background: #6B7280; margin-right: 10px;"><i class="fas fa-bars"></i> Menu</button>
                            <button class="theme-toggle" onclick="app.toggleTheme()"><i class="fas fa-moon"></i> Theme</button>
                            <button class="logout" onclick="app.logout()"><i class="fas fa-sign-out-alt"></i> Logout</button>
                        </div>
                    </div>
                    <div id="content"></div>
                </div>
            </div>
        `;
    }

    createParentScreen() {
        return `
            <div class="screen dashboard active">
                <div class="sidebar">
                    <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                        <div style="width: 60px; height: 60px; background: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: 700;">SC</div>
                        <h3 style="color: white; font-size: 16px; margin: 0;">Southern Cross</h3>
                    </div>
                    <h2><i class="fas fa-users"></i> Parent Panel</h2>
                    <button class="nav-btn active" onclick="app.loadSection('dashboard', 'parent')"><i class="fas fa-chart-line"></i> Dashboard</button>
                    <button class="nav-btn" onclick="app.loadSection('profile', 'parent')"><i class="fas fa-child"></i> Child Profile</button>
                    <button class="nav-btn" onclick="app.loadSection('attendance', 'parent')"><i class="fas fa-check-circle"></i> Attendance</button>
                    <button class="nav-btn" onclick="app.loadSection('progress', 'parent')"><i class="fas fa-chart-bar"></i> Progress</button>
                    <button class="nav-btn" onclick="app.loadSection('homework', 'parent')"><i class="fas fa-book-open"></i> Homework</button>
                    <button class="nav-btn" onclick="app.loadSection('fees', 'parent')"><i class="fas fa-dollar-sign"></i> Fees</button>
                    <button class="nav-btn" onclick="app.loadSection('messages', 'parent')"><i class="fas fa-envelope"></i> Messages</button>
                    <button class="nav-btn" onclick="app.loadSection('calendar', 'parent')"><i class="fas fa-calendar-alt"></i> Calendar</button>
                    <button class="nav-btn" onclick="app.loadSection('library', 'parent')"><i class="fas fa-book"></i> Library</button>
                    <button class="nav-btn" onclick="app.loadSection('transport', 'parent')"><i class="fas fa-bus"></i> Transport</button>
                    <button class="nav-btn" onclick="app.loadSection('account', 'parent')"><i class="fas fa-user-circle"></i> My Account</button>
                </div>
                <div class="main">
                    <div class="header">
                        <h2 id="page-title">Parent Dashboard</h2>
                        <div class="header-controls">
                            <button class="theme-toggle" onclick="app.toggleSidebar()" style="background: #6B7280; margin-right: 10px;"><i class="fas fa-bars"></i> Menu</button>
                            <button class="theme-toggle" onclick="app.toggleTheme()"><i class="fas fa-moon"></i> Theme</button>
                            <button class="logout" onclick="app.logout()"><i class="fas fa-sign-out-alt"></i> Logout</button>
                        </div>
                    </div>
                    <div id="content"></div>
                </div>
            </div>
        `;
    }

    loadSection(section, role) {
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        if (event && event.target) event.target.classList.add('active');
        
        const content = document.getElementById('content');
        const titles = {
            dashboard: 'Dashboard', students: 'Student Management', teachers: 'Teacher Management',
            classes: role === 'admin' ? 'Class Management' : 'My Classes', fees: role === 'admin' ? 'Fee Management' : 'Fee Status',
            announcements: 'Announcements', reports: 'Reports', messages: 'Messages', attendance: 'Attendance',
            marks: 'Marks', homework: 'Homework', timetable: 'Timetable', profile: 'Child Profile',
            progress: 'Academic Progress', calendar: 'Calendar', library: 'Library Management',
            transport: 'Transport Management', exams: 'Exam Management', certificates: 'Certificate Generator',
            account: 'My Account'
        };
        
        document.getElementById('page-title').textContent = titles[section] || 'Dashboard';
        
        if (role === 'admin') {
            content.innerHTML = this.getAdminContent(section);
        } else if (role === 'teacher') {
            content.innerHTML = this.getTeacherContent(section);
        } else if (role === 'parent') {
            content.innerHTML = this.getParentContent(section);
        }
    }

    getAdminContent(section) {
        switch(section) {
            case 'dashboard':
                return `
                    <div class="stats">
                        <div class="stat"><h4>${this.data.students.length}</h4><p>Total Students</p></div>
                        <div class="stat"><h4>${this.data.teachers.length}</h4><p>Total Teachers</p></div>
                        <div class="stat"><h4>${this.data.classes.length}</h4><p>Total Classes</p></div>
                        <div class="stat"><h4>$${this.data.students.reduce((sum, s) => sum + s.fees.paid, 0)}</h4><p>Fees Collected</p></div>
                    </div>
                    <div class="card">
                        <h3>🎯 Admin Overview</h3>
                        <p>Welcome Administrator! Manage your school efficiently.</p>
                        <div class="btn-group">
                            <button class="btn btn-primary" onclick="app.addStudent()">➕ Add Student</button>
                            <button class="btn btn-success" onclick="app.quickAction('announcement')">📢 Send Announcement</button>
                        </div>
                    </div>
                `;
            case 'students':
                return `
                    <div class="card">
                        <h3>👨🎓 Student Management</h3>
                        <div style="display: flex; gap: 15px; margin-bottom: 20px;">
                            <button class="btn btn-primary" onclick="app.addStudent()">➕ Add Student</button>
                            <button class="btn export-button" onclick="app.exportData('students')">📊 Export</button>
                            <button class="btn print-button" onclick="app.printData('students')">🖨️ Print</button>
                        </div>
                        <input type="text" class="search-box" placeholder="🔍 Search students..." onkeyup="app.searchData('students', this.value)">
                        <div class="bulk-actions" id="bulk-actions-students">
                            <button class="btn btn-danger" onclick="app.bulkDelete('students')">🗑️ Delete Selected</button>
                            <button class="btn btn-secondary" onclick="app.clearSelection('students')">❌ Clear Selection</button>
                        </div>
                    </div>
                    <div class="data-grid" id="students-list">
                        ${this.renderStudentsList()}
                    </div>
                `;
            case 'account':
                return this.getAccountContent();
            case 'teachers':
                return `
                    <div class="card">
                        <h3>👩🏫 Teacher Management</h3>
                        <button class="btn btn-primary" onclick="app.addTeacher()">➕ Add Teacher</button>
                    </div>
                    <div class="data-grid">
                        ${this.data.teachers.map(teacher => `
                            <div class="data-item">
                                <h4>${teacher.name}</h4>
                                <p>Subject: ${teacher.subject}</p>
                                <p>Classes: ${teacher.classes.join(', ')}</p>
                                <p>Email: ${teacher.email}</p>
                            </div>
                        `).join('')}
                    </div>
                `;
            case 'fees':
                const totalFees = this.data.students.reduce((sum, s) => sum + s.fees.total, 0);
                const paidFees = this.data.students.reduce((sum, s) => sum + s.fees.paid, 0);
                return `
                    <div class="stats">
                        <div class="stat"><h4>$${paidFees}</h4><p>Collected</p></div>
                        <div class="stat"><h4>$${totalFees - paidFees}</h4><p>Pending</p></div>
                    </div>
                    <div class="data-grid">
                        ${this.data.students.map(student => `
                            <div class="data-item">
                                <h4>${student.name}</h4>
                                <p>Total: $${student.fees.total}</p>
                                <p>Paid: $${student.fees.paid}</p>
                                <p>Pending: $${student.fees.total - student.fees.paid}</p>
                                <button class="btn btn-success" onclick="app.recordPayment(${student.id})">💰 Record Payment</button>
                            </div>
                        `).join('')}
                    </div>
                `;
            case 'messages':
                // Get all users from global storage
                let allUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
                const globalUsers = JSON.parse(localStorage.getItem('ALL_USERS_GLOBAL') || '[]');
                
                // Merge global users
                globalUsers.forEach(globalUser => {
                    const exists = allUsers.find(u => u.username === globalUser.username && u.role === globalUser.role);
                    if (!exists) {
                        allUsers.push(globalUser);
                    }
                });
                
                localStorage.setItem('registeredUsers', JSON.stringify(allUsers));
                
                const conversations = this.getConversations();
                return `
                    <div class="card">
                        <h3><i class="fas fa-comments"></i> Messages - Select Contact</h3>
                        <div style="display: flex; gap: 15px; margin-bottom: 20px;">
                            <button class="btn export-button" onclick="app.exportData('messages')">📊 Export Messages</button>
                            <button class="btn print-button" onclick="app.printData('messages')">🖨️ Print</button>
                        </div>
                        <div class="form-group">
                            <label><i class="fas fa-user-friends"></i> Chat with:</label>
                            <select class="contact-dropdown" id="contact-selector" onchange="app.selectContactFromDropdown(this.value)">
                                <option value="">🔍 Select a contact to start messaging</option>
                                ${allUsers.filter(u => u.username !== this.currentUser.username).map(user => 
                                    `<option value="${user.username}">👤 ${user.name} (${user.role.charAt(0).toUpperCase() + user.role.slice(1)})</option>`
                                ).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="chat-container" style="height: 500px; border: 1px solid #e2e8f0; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.08);">
                        <div class="chat-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px 25px; display: flex; align-items: center;">
                            <div class="avatar" style="width: 50px; height: 50px; border-radius: 50%; background: rgba(255,255,255,0.2); margin-right: 20px; display: flex; align-items: center; justify-content: center; font-size: 20px;">💬</div>
                            <div class="chat-title">
                                <h3 id="chat-contact-name" style="margin: 0; font-size: 18px; font-weight: 600;">Select Contact</h3>
                                <span id="chat-contact-status" style="font-size: 14px; opacity: 0.8;">Choose someone to chat with</span>
                            </div>
                        </div>
                        <div class="chat-main" style="display: flex; height: 440px;">
                            <div class="contacts-sidebar" style="width: 140px; background: #f7fafc; border-right: 1px solid #e2e8f0; overflow-y: auto;" id="contacts-sidebar">
                                <!-- Contacts will be loaded here -->
                            </div>
                            <div class="chat-area" style="flex: 1; display: flex; flex-direction: column;">
                                <div class="chat-messages" style="flex: 1; padding: 25px; overflow-y: auto; background: #fafafa;" id="chat-messages">
                                    <div class="empty-chat" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #a0aec0;">
                                        <div style="font-size: 64px; margin-bottom: 20px; opacity: 0.6;">💬</div>
                                        <h4 style="font-weight: 600; margin-bottom: 10px; color: #4a5568;">No conversation selected</h4>
                                        <p style="text-align: center; line-height: 1.6;">Choose a contact from the dropdown or sidebar to start messaging</p>
                                    </div>
                                </div>
                                <div class="chat-input" style="padding: 20px 25px; border-top: 1px solid #e2e8f0; background: white; display: flex; align-items: center; gap: 15px;">
                                    <input type="text" id="chat-input" placeholder="Type your message here..." style="flex: 1; border: 2px solid #e2e8f0; border-radius: 25px; padding: 12px 20px; outline: none; font-size: 15px; font-weight: 500;" onkeypress="if(event.key==='Enter') app.sendChatMessage()">
                                    <button onclick="app.sendChatMessage()" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 50%; width: 45px; height: 45px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; transition: all 0.3s ease;">📤</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <script>setTimeout(() => app.loadContactsInline('admin'), 100);</script>
                `;
            case 'classes':
                return `
                    <div class="card">
                        <h3>🏫 Class Management</h3>
                        <button class="btn btn-primary" onclick="app.addClass()">➕ Add Class</button>
                    </div>
                    <div class="data-grid">
                        ${this.data.classes.map(className => `
                            <div class="data-item">
                                <h4>Class ${className}</h4>
                                <p>Students: ${this.data.students.filter(s => s.class === className).length}</p>
                                <button class="btn btn-primary" onclick="app.viewClass('${className}')">👁️ View Students</button>
                            </div>
                        `).join('')}
                    </div>
                `;
            case 'announcements':
                return `
                    <div class="card">
                        <h3>📢 Announcements</h3>
                        <div class="form-group">
                            <input type="text" id="ann-title" placeholder="Announcement title">
                        </div>
                        <div class="form-group">
                            <textarea id="ann-content" placeholder="Announcement content"></textarea>
                        </div>
                        <button class="btn btn-primary" onclick="app.addAnnouncement()">📢 Post Announcement</button>
                    </div>
                    <div class="data-grid">
                        ${this.data.announcements.map(ann => `
                            <div class="data-item">
                                <h4>${ann.title}</h4>
                                <p>${ann.content}</p>
                                <p>📅 ${ann.date}</p>
                            </div>
                        `).join('')}
                    </div>
                `;
            case 'reports':
                return `
                    <div class="stats">
                        <div class="stat"><h4>${this.data.students.length}</h4><p>Total Students</p></div>
                        <div class="stat"><h4>${Math.round(this.data.students.reduce((sum, s) => sum + s.attendance, 0) / this.data.students.length)}%</h4><p>Avg Attendance</p></div>
                        <div class="stat"><h4>$${this.data.students.reduce((sum, s) => sum + s.fees.paid, 0)}</h4><p>Total Revenue</p></div>
                    </div>
                    <div class="card">
                        <h3>📈 School Reports</h3>
                        <div class="btn-group">
                            <button class="btn btn-primary" onclick="app.generateReport('attendance')">📊 Attendance Report</button>
                            <button class="btn btn-success" onclick="app.generateReport('financial')">💰 Financial Report</button>
                        </div>
                    </div>
                `;
            case 'calendar':
                return `
                    <div class="card">
                        <h3>📅 School Calendar</h3>
                        <button class="btn btn-primary" onclick="app.addEvent()">➕ Add Event</button>
                    </div>
                    <div class="data-grid">
                        ${this.data.events.map(event => `
                            <div class="data-item">
                                <h4>${event.title}</h4>
                                <p>📅 ${event.date} at ${event.time}</p>
                                <p>Type: ${event.type}</p>
                            </div>
                        `).join('')}
                    </div>
                `;
            case 'library':
                return `
                    <div class="card">
                        <h3>📚 Library Management</h3>
                        <div style="display: flex; gap: 15px; margin-bottom: 20px;">
                            <button class="btn btn-primary" onclick="app.addBook()">➕ Add Book</button>
                            <button class="btn btn-success" onclick="app.uploadStudyMaterial()">📖 Upload Study Material</button>
                            <button class="btn btn-warning" onclick="app.uploadDocument()">📄 Upload Document</button>
                            <button class="btn export-button" onclick="app.uploadSyllabus()">📋 Upload Syllabus</button>
                        </div>
                        <input type="text" class="search-box" placeholder="🔍 Search library..." onkeyup="app.searchLibrary(this.value)">
                    </div>
                    <div class="data-grid" id="library-list">
                        ${this.renderLibraryItems()}
                    </div>
                `;
            case 'transport':
                return `
                    <div class="card">
                        <h3>🚌 Transport Management</h3>
                        <button class="btn btn-primary" onclick="app.addRoute()">➕ Add Route</button>
                    </div>
                    <div class="data-grid">
                        ${this.data.transport.map(route => `
                            <div class="data-item">
                                <h4>${route.route}</h4>
                                <p>Driver: ${route.driver}</p>
                                <p>Capacity: ${route.capacity}</p>
                                <p>Students: ${route.students.length}</p>
                            </div>
                        `).join('')}
                    </div>
                `;
            case 'exams':
                return `
                    <div class="card">
                        <h3>📝 Exam Management</h3>
                        <button class="btn btn-primary" onclick="app.addExam()">➕ Schedule Exam</button>
                    </div>
                    <div class="data-grid">
                        ${this.data.exams.map(exam => `
                            <div class="data-item">
                                <h4>${exam.subject} - ${exam.class}</h4>
                                <p>📅 ${exam.date}</p>
                                <p>Duration: ${exam.duration}</p>
                                <p>Total Marks: ${exam.totalMarks}</p>
                            </div>
                        `).join('')}
                    </div>
                `;
            case 'profile':
                return `
                    <div class="card">
                        <h3><i class="fas fa-user-cog"></i> Profile Management</h3>
                        <div style="display: grid; grid-template-columns: 200px 1fr; gap: 30px; align-items: start;">
                            <div style="text-align: center;">
                                <div style="width: 150px; height: 150px; border-radius: 50%; background: #2563EB; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; color: white; font-size: 48px; font-weight: 700; box-shadow: 0 8px 30px rgba(37, 99, 235, 0.3);">
                                    ${this.currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                                </div>
                                <button class="btn btn-secondary" style="font-size: 12px;">Change Photo</button>
                            </div>
                            <div>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>Full Name</label>
                                        <input type="text" value="${this.currentUser.name}" readonly>
                                    </div>
                                    <div class="form-group">
                                        <label>Role</label>
                                        <input type="text" value="${this.currentUser.role.charAt(0).toUpperCase() + this.currentUser.role.slice(1)}" readonly>
                                    </div>
                                </div>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>Email</label>
                                        <input type="email" value="${this.currentUser.email || 'admin@southerncross.edu'}">
                                    </div>
                                    <div class="form-group">
                                        <label>Phone</label>
                                        <input type="tel" placeholder="+1 (555) 123-4567">
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label>School Name</label>
                                    <input type="text" value="Southern Cross School" readonly>
                                </div>
                                <div class="btn-group">
                                    <button class="btn btn-primary">Update Profile</button>
                                    <button class="btn btn-warning">Change Password</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            case 'certificates':
                return `
                    <div class="card">
                        <h3>🏆 Certificate Generator</h3>
                        <div class="form-group">
                            <label>Student:</label>
                            <select id="cert-student">
                                ${this.data.students.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                            </select>
                        </div>
                        <button class="btn btn-primary" onclick="app.generateCertificate()">🏆 Generate Certificate</button>
                    </div>
                `;
            default:
                return `<div class="card"><h3>🚧 ${section.toUpperCase()} - Coming Soon</h3></div>`;
        }
    }

    getTeacherContent(section) {
        switch(section) {
            case 'dashboard':
                return `
                    <div class="stats">
                        <div class="stat"><h4>2</h4><p>My Classes</p></div>
                        <div class="stat"><h4>${this.data.students.length}</h4><p>My Students</p></div>
                        <div class="stat"><h4>${this.data.homework.length}</h4><p>Assignments</p></div>
                    </div>
                    <div class="card">
                        <h3>👩🏫 Teacher Portal</h3>
                        <p>Welcome Teacher! Manage your classes and students.</p>
                        <div class="btn-group">
                            <button class="btn btn-primary" onclick="app.quickAction('attendance')">✅ Take Attendance</button>
                            <button class="btn btn-warning" onclick="app.quickAction('homework')">📚 Assign Homework</button>
                        </div>
                    </div>
                `;
            case 'classes':
                return `
                    <div class="card">
                        <h3>🏫 My Classes</h3>
                        <div style="display: flex; gap: 15px; margin-bottom: 20px;">
                            <button class="btn btn-primary" onclick="app.addAssignment()">📝 Create Assignment</button>
                            <button class="btn btn-success" onclick="app.editTimetable()">⏰ Edit Timetable</button>
                        </div>
                    </div>
                    <div class="data-grid">
                        ${['10A', '10B'].map(className => `
                            <div class="data-item">
                                <h4>Class ${className}</h4>
                                <p>Students: ${this.data.students.filter(s => s.class === className).length}</p>
                                <div class="btn-group">
                                    <button class="btn btn-primary" onclick="app.viewClassStudents('${className}')">👁️ View Students</button>
                                    <button class="btn btn-warning" onclick="app.editClassStudents('${className}')">✏️ Edit Students</button>
                                    <button class="btn btn-success" onclick="app.markClassAttendance('${className}')">✅ Mark Attendance</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            case 'attendance':
                return `
                    <div class="card">
                        <h3>✅ Mark Attendance</h3>
                        <div class="form-group">
                            <label>Class:</label>
                            <select id="att-class">
                                <option value="10A">10A</option>
                                <option value="10B">10B</option>
                            </select>
                        </div>
                        <button class="btn btn-primary" onclick="app.loadClassAttendance()">Load Students</button>
                    </div>
                    <div id="attendance-list"></div>
                `;
            case 'marks':
                return `
                    <div class="card">
                        <h3>⭐ Enter Marks</h3>
                        <div class="form-group">
                            <label>Class:</label>
                            <select id="marks-class">
                                <option value="10A">10A</option>
                                <option value="10B">10B</option>
                            </select>
                        </div>
                        <button class="btn btn-primary" onclick="app.loadClassMarks()">Load Students</button>
                    </div>
                    <div id="marks-list"></div>
                `;
            case 'homework':
                return `
                    <div class="card">
                        <h3>📚 Assign Homework</h3>
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
                            <label>Task:</label>
                            <textarea id="hw-task" placeholder="Homework description"></textarea>
                        </div>
                        <button class="btn btn-primary" onclick="app.assignHomework()">➕ Assign Homework</button>
                    </div>
                    <div class="data-grid">
                        ${this.data.homework.map(hw => `
                            <div class="data-item">
                                <h4>${hw.subject} - Class ${hw.class}</h4>
                                <p>${hw.task}</p>
                                <p>Due: ${hw.dueDate}</p>
                            </div>
                        `).join('')}
                    </div>
                `;
            case 'timetable':
                return `
                    <div class="card">
                        <h3>⏰ My Timetable</h3>
                        <div style="display: flex; gap: 15px; margin-bottom: 20px;">
                            <button class="btn btn-primary" onclick="app.editTimetable()">✏️ Edit Timetable</button>
                            <button class="btn export-button" onclick="app.exportTimetable()">📊 Export</button>
                            <button class="btn print-button" onclick="app.printTimetable()">🖨️ Print</button>
                        </div>
                        <div id="timetable-display">
                            ${this.renderTimetable()}
                        </div>
                    </div>
                `;
            case 'calendar':
                return `
                    <div class="card">
                        <h3>📅 School Calendar</h3>
                        <div class="data-grid">
                            ${this.data.events.map(event => `
                                <div class="data-item">
                                    <h4>${event.title}</h4>
                                    <p>📅 ${event.date} at ${event.time}</p>
                                    <p>Type: ${event.type}</p>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            case 'exams':
                return `
                    <div class="card">
                        <h3>📝 Exam Schedule</h3>
                        <div class="data-grid">
                            ${this.data.exams.map(exam => `
                                <div class="data-item">
                                    <h4>${exam.subject} - ${exam.class}</h4>
                                    <p>📅 ${exam.date}</p>
                                    <p>Duration: ${exam.duration}</p>
                                    <p>Total Marks: ${exam.totalMarks}</p>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            case 'messages':
                const allUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
                return `
                    <div class="card">
                        <h3><i class="fas fa-comments"></i> Messages - Select Contact</h3>
                        <div style="display: flex; gap: 15px; margin-bottom: 20px;">
                            <button class="btn export-button" onclick="app.exportData('messages')">📊 Export Messages</button>
                            <button class="btn print-button" onclick="app.printData('messages')">🖨️ Print</button>
                        </div>
                        <div class="form-group">
                            <label><i class="fas fa-user-friends"></i> Chat with:</label>
                            <select class="contact-dropdown" id="contact-selector" onchange="app.selectContactFromDropdown(this.value)">
                                <option value="">🔍 Select a contact to start messaging</option>
                                ${allUsers.filter(u => u.username !== this.currentUser.username).map(user => 
                                    `<option value="${user.username}">👤 ${user.name} (${user.role.charAt(0).toUpperCase() + user.role.slice(1)})</option>`
                                ).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="chat-container" style="height: 500px; border: 1px solid #e2e8f0; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.08);">
                        <div class="chat-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px 25px; display: flex; align-items: center;">
                            <div class="avatar" style="width: 50px; height: 50px; border-radius: 50%; background: rgba(255,255,255,0.2); margin-right: 20px; display: flex; align-items: center; justify-content: center; font-size: 20px;">💬</div>
                            <div class="chat-title">
                                <h3 id="chat-contact-name-teacher" style="margin: 0; font-size: 18px; font-weight: 600;">Select Contact</h3>
                                <span id="chat-contact-status-teacher" style="font-size: 14px; opacity: 0.8;">Choose someone to chat with</span>
                            </div>
                        </div>
                        <div class="chat-main" style="display: flex; height: 440px;">
                            <div class="contacts-sidebar" style="width: 140px; background: #f7fafc; border-right: 1px solid #e2e8f0; overflow-y: auto;" id="contacts-sidebar-teacher">
                                <!-- Contacts will be loaded here -->
                            </div>
                            <div class="chat-area" style="flex: 1; display: flex; flex-direction: column;">
                                <div class="chat-messages" style="flex: 1; padding: 25px; overflow-y: auto; background: #fafafa;" id="chat-messages-teacher">
                                    <div class="empty-chat" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #a0aec0;">
                                        <div style="font-size: 64px; margin-bottom: 20px; opacity: 0.6;">💬</div>
                                        <h4 style="font-weight: 600; margin-bottom: 10px; color: #4a5568;">No conversation selected</h4>
                                        <p style="text-align: center; line-height: 1.6;">Choose a contact from the dropdown or sidebar to start messaging</p>
                                    </div>
                                </div>
                                <div class="chat-input" style="padding: 20px 25px; border-top: 1px solid #e2e8f0; background: white; display: flex; align-items: center; gap: 15px;">
                                    <input type="text" id="chat-input-teacher" placeholder="Type your message here..." style="flex: 1; border: 2px solid #e2e8f0; border-radius: 25px; padding: 12px 20px; outline: none; font-size: 15px; font-weight: 500;" onkeypress="if(event.key==='Enter') app.sendChatMessageInline('teacher')">
                                    <button onclick="app.sendChatMessageInline('teacher')" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 50%; width: 45px; height: 45px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; transition: all 0.3s ease;">📤</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <script>setTimeout(() => app.loadContactsInline('teacher'), 100);</script>
                `;
            case 'account':
                return this.getAccountContent();
            default:
                return `<div class="card"><h3>🚧 ${section.toUpperCase()} - Coming Soon</h3></div>`;
        }
    }

    getParentContent(section) {
        // Find child based on parent's name or create a dynamic child
        let child = this.data.students.find(s => s.parent === this.currentUser.name);
        if (!child) {
            // If no child found, use the parent's name to create a child name
            const childName = this.currentUser.name.replace(/Mr\.|Mrs\.|Ms\.|Dr\./, '').trim() + ' Jr.';
            child = {
                id: Date.now(),
                name: childName,
                class: "10A",
                attendance: 92,
                marks: {math: 85, english: 88, science: 82},
                fees: {total: 5000, paid: 3000},
                gpa: 3.4
            };
        }
        
        switch(section) {
            case 'dashboard':
                return `
                    <div class="stats">
                        <div class="stat">
                            <i class="fas fa-calendar-check" style="font-size: 2rem; margin-bottom: 10px; color: #667eea;"></i>
                            <h4>${child.attendance}%</h4>
                            <p>Attendance Rate</p>
                        </div>
                        <div class="stat">
                            <i class="fas fa-chart-line" style="font-size: 2rem; margin-bottom: 10px; color: #667eea;"></i>
                            <h4>${child.gpa}</h4>
                            <p>Overall GPA</p>
                        </div>
                        <div class="stat">
                            <i class="fas fa-dollar-sign" style="font-size: 2rem; margin-bottom: 10px; color: #667eea;"></i>
                            <h4>$${child.fees.total - child.fees.paid}</h4>
                            <p>Pending Fees</p>
                        </div>
                    </div>
                    <div class="card">
                        <h3><i class="fas fa-home"></i> Parent Portal</h3>
                        <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 25px;">
                            <div style="width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: 700;">
                                ${child.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                            </div>
                            <div>
                                <h4 style="font-size: 22px; font-weight: 700; color: #1a202c; margin-bottom: 5px;">Welcome! Monitor ${child.name}'s progress</h4>
                                <p style="color: #4a5568; font-size: 16px;">Stay updated with your child's academic journey</p>
                            </div>
                        </div>
                        <button class="btn btn-primary" onclick="app.messageTeacher()"><i class="fas fa-envelope"></i> Message Teacher</button>
                    </div>
                `;
            case 'profile':
                return `
                    <div class="card">
                        <h3><i class="fas fa-user-circle"></i> Child Profile</h3>
                        <div style="display: grid; grid-template-columns: 200px 1fr; gap: 30px; align-items: start;">
                            <div style="text-align: center;">
                                <div style="width: 150px; height: 150px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; color: white; font-size: 48px; font-weight: 700; box-shadow: 0 8px 30px rgba(102, 126, 234, 0.3);">
                                    ${child.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                                </div>
                                <h4 style="font-size: 24px; font-weight: 700; color: #1a202c; margin-bottom: 8px;">${child.name}</h4>
                                <p style="color: #667eea; font-weight: 600; font-size: 16px;">Class ${child.class}</p>
                            </div>
                            <div>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 25px; margin-bottom: 30px;">
                                    <div style="background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); padding: 20px; border-radius: 16px; color: white; text-align: center;">
                                        <i class="fas fa-chart-line" style="font-size: 24px; margin-bottom: 10px;"></i>
                                        <h4 style="font-size: 28px; font-weight: 700; margin-bottom: 5px;">${child.gpa}/4.0</h4>
                                        <p style="font-weight: 600;">Overall GPA</p>
                                    </div>
                                    <div style="background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%); padding: 20px; border-radius: 16px; color: white; text-align: center;">
                                        <i class="fas fa-calendar-check" style="font-size: 24px; margin-bottom: 10px;"></i>
                                        <h4 style="font-size: 28px; font-weight: 700; margin-bottom: 5px;">${child.attendance}%</h4>
                                        <p style="font-weight: 600;">Attendance Rate</p>
                                    </div>
                                </div>
                                <div style="background: #f7fafc; padding: 25px; border-radius: 16px; border-left: 6px solid #667eea;">
                                    <h5 style="font-size: 18px; font-weight: 700; color: #1a202c; margin-bottom: 20px;"><i class="fas fa-book-open"></i> Subject Performance</h5>
                                    <div style="display: grid; gap: 15px;">
                                        <div style="display: flex; justify-content: space-between; align-items: center;">
                                            <span style="font-weight: 600; color: #2d3748;"><i class="fas fa-calculator"></i> Mathematics</span>
                                            <div style="display: flex; align-items: center; gap: 15px;">
                                                <div style="width: 120px; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
                                                    <div style="width: ${child.marks.math}%; height: 100%; background: linear-gradient(90deg, #48bb78, #38a169); transition: width 0.3s ease;"></div>
                                                </div>
                                                <span style="font-weight: 700; color: #1a202c; min-width: 45px;">${child.marks.math}%</span>
                                            </div>
                                        </div>
                                        <div style="display: flex; justify-content: space-between; align-items: center;">
                                            <span style="font-weight: 600; color: #2d3748;"><i class="fas fa-book"></i> English</span>
                                            <div style="display: flex; align-items: center; gap: 15px;">
                                                <div style="width: 120px; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
                                                    <div style="width: ${child.marks.english}%; height: 100%; background: linear-gradient(90deg, #4299e1, #3182ce); transition: width 0.3s ease;"></div>
                                                </div>
                                                <span style="font-weight: 700; color: #1a202c; min-width: 45px;">${child.marks.english}%</span>
                                            </div>
                                        </div>
                                        <div style="display: flex; justify-content: space-between; align-items: center;">
                                            <span style="font-weight: 600; color: #2d3748;"><i class="fas fa-flask"></i> Science</span>
                                            <div style="display: flex; align-items: center; gap: 15px;">
                                                <div style="width: 120px; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
                                                    <div style="width: ${child.marks.science}%; height: 100%; background: linear-gradient(90deg, #ed8936, #dd6b20); transition: width 0.3s ease;"></div>
                                                </div>
                                                <span style="font-weight: 700; color: #1a202c; min-width: 45px;">${child.marks.science}%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            case 'attendance':
                return `
                    <div class="card">
                        <h3>✅ Attendance Record</h3>
                        <h4>${child.name} - Class ${child.class}</h4>
                        <p>Current Attendance: ${child.attendance}%</p>
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 15px;">
                            <h5>Monthly Breakdown:</h5>
                            <p>January: 95% (19/20 days)</p>
                            <p>February: 88% (22/25 days)</p>
                            <p>March: 92% (23/25 days)</p>
                        </div>
                    </div>
                `;
            case 'progress':
                return `
                    <div class="card">
                        <h3>📈 Academic Progress</h3>
                        <h4>${child.name}</h4>
                        <div class="stats">
                            <div class="stat"><h4>${child.marks.math}%</h4><p>Mathematics</p></div>
                            <div class="stat"><h4>${child.marks.english}%</h4><p>English</p></div>
                            <div class="stat"><h4>${child.marks.science}%</h4><p>Science</p></div>
                        </div>
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 15px;">
                            <h5>Teacher Comments:</h5>
                            <p>"${child.name} is showing excellent progress in all subjects. Keep up the good work!"</p>
                        </div>
                    </div>
                `;
            case 'homework':
                return `
                    <div class="data-grid">
                        ${this.data.homework.filter(hw => hw.class === child.class).map(hw => `
                            <div class="data-item">
                                <h4>${hw.subject}</h4>
                                <p>${hw.task}</p>
                                <p>Due: ${hw.dueDate}</p>
                                <button class="btn btn-success" onclick="app.markComplete(${hw.id})">✅ Mark Complete</button>
                            </div>
                        `).join('')}
                    </div>
                `;
            case 'fees':
                return `
                    <div class="stats">
                        <div class="stat"><h4>$${child.fees.paid}</h4><p>Paid</p></div>
                        <div class="stat"><h4>$${child.fees.total - child.fees.paid}</h4><p>Pending</p></div>
                    </div>
                    <div class="card">
                        <h3>💰 Fee Status</h3>
                        <p>Total Fees: $${child.fees.total}</p>
                        <p>Amount Paid: $${child.fees.paid}</p>
                        <p>Pending: $${child.fees.total - child.fees.paid}</p>
                        ${child.fees.paid < child.fees.total ? 
                            '<button class="btn btn-primary" onclick="app.payFees()">💳 Pay Now</button>' : 
                            '<p style="color: green;">✅ All fees paid!</p>'
                        }
                    </div>
                `;
            case 'calendar':
                return `
                    <div class="card">
                        <h3>📅 School Calendar</h3>
                        <div class="data-grid">
                            ${this.data.events.map(event => `
                                <div class="data-item">
                                    <h4>${event.title}</h4>
                                    <p>📅 ${event.date} at ${event.time}</p>
                                    <p>Type: ${event.type}</p>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            case 'library':
                return `
                    <div class="card">
                        <h3>📚 Library Books</h3>
                        <div class="data-grid">
                            ${this.data.library.map(book => `
                                <div class="data-item">
                                    <h4>${book.title}</h4>
                                    <p>Author: ${book.author}</p>
                                    <p>Status: ${book.available ? '✅ Available' : '❌ Borrowed'}</p>
                                    ${book.available ? '<button class="btn btn-primary" onclick="app.borrowBook(' + book.id + ')">📖 Borrow</button>' : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            case 'transport':
                return `
                    <div class="card">
                        <h3>🚌 Transport Information</h3>
                        <div class="data-grid">
                            ${this.data.transport.map(route => `
                                <div class="data-item">
                                    <h4>${route.route}</h4>
                                    <p>Driver: ${route.driver}</p>
                                    <p>Pickup Time: 7:30 AM</p>
                                    <p>Drop Time: 3:30 PM</p>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            case 'messages':
                const allUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
                return `
                    <div class="card">
                        <h3><i class="fas fa-comments"></i> Messages - Select Contact</h3>
                        <div style="display: flex; gap: 15px; margin-bottom: 20px;">
                            <button class="btn export-button" onclick="app.exportData('messages')">📊 Export Messages</button>
                            <button class="btn print-button" onclick="app.printData('messages')">🖨️ Print</button>
                        </div>
                        <div class="form-group">
                            <label><i class="fas fa-user-friends"></i> Chat with:</label>
                            <select class="contact-dropdown" id="contact-selector" onchange="app.selectContactFromDropdown(this.value)">
                                <option value="">🔍 Select a contact to start messaging</option>
                                ${allUsers.filter(u => u.username !== this.currentUser.username).map(user => 
                                    `<option value="${user.username}">👤 ${user.name} (${user.role.charAt(0).toUpperCase() + user.role.slice(1)})</option>`
                                ).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="chat-container" style="height: 500px; border: 1px solid #e2e8f0; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.08);">
                        <div class="chat-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px 25px; display: flex; align-items: center;">
                            <div class="avatar" style="width: 50px; height: 50px; border-radius: 50%; background: rgba(255,255,255,0.2); margin-right: 20px; display: flex; align-items: center; justify-content: center; font-size: 20px;">💬</div>
                            <div class="chat-title">
                                <h3 id="chat-contact-name-parent" style="margin: 0; font-size: 18px; font-weight: 600;">Select Contact</h3>
                                <span id="chat-contact-status-parent" style="font-size: 14px; opacity: 0.8;">Choose someone to chat with</span>
                            </div>
                        </div>
                        <div class="chat-main" style="display: flex; height: 440px;">
                            <div class="contacts-sidebar" style="width: 140px; background: #f7fafc; border-right: 1px solid #e2e8f0; overflow-y: auto;" id="contacts-sidebar-parent">
                                <!-- Contacts will be loaded here -->
                            </div>
                            <div class="chat-area" style="flex: 1; display: flex; flex-direction: column;">
                                <div class="chat-messages" style="flex: 1; padding: 25px; overflow-y: auto; background: #fafafa;" id="chat-messages-parent">
                                    <div class="empty-chat" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #a0aec0;">
                                        <div style="font-size: 64px; margin-bottom: 20px; opacity: 0.6;">💬</div>
                                        <h4 style="font-weight: 600; margin-bottom: 10px; color: #4a5568;">No conversation selected</h4>
                                        <p style="text-align: center; line-height: 1.6;">Choose a contact from the dropdown or sidebar to start messaging</p>
                                    </div>
                                </div>
                                <div class="chat-input" style="padding: 20px 25px; border-top: 1px solid #e2e8f0; background: white; display: flex; align-items: center; gap: 15px;">
                                    <input type="text" id="chat-input-parent" placeholder="Type your message here..." style="flex: 1; border: 2px solid #e2e8f0; border-radius: 25px; padding: 12px 20px; outline: none; font-size: 15px; font-weight: 500;" onkeypress="if(event.key==='Enter') app.sendChatMessageInline('parent')">
                                    <button onclick="app.sendChatMessageInline('parent')" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 50%; width: 45px; height: 45px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; transition: all 0.3s ease;">📤</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <script>setTimeout(() => app.loadContactsInline('parent'), 100);</script>
                `;
            case 'account':
                return this.getAccountContent();
            default:
                return `<div class="card"><h3>🚧 ${section.toUpperCase()} - Coming Soon</h3></div>`;
        }
    }

    getUserGroups(role) {
        switch(role) {
            case 'teacher': return ['teachers', 'parents', 'admin'];
            case 'parent': return ['parents'];
            case 'admin': return ['admin', 'teachers', 'parents'];
            default: return [];
        }
    }

    addUserToGroups(user, groupIds) {
        groupIds.forEach(groupId => {
            if (this.chatGroups[groupId] && this.chatGroups[groupId].allowedRoles.includes(user.role)) {
                const existingMember = this.chatGroups[groupId].members.find(m => m.id === user.id);
                if (!existingMember) {
                    this.chatGroups[groupId].members.push({
                        id: user.id,
                        name: user.name,
                        role: user.role,
                        online: false
                    });
                }
            }
        });
        this.saveChatGroups();
    }

    toggleChat() {
        const chatWindow = document.getElementById('chat-window');
        const chatToggle = document.getElementById('chat-toggle');
        
        if (chatWindow.style.display === 'none' || !chatWindow.style.display) {
            chatWindow.style.display = 'block';
            chatToggle.style.display = 'none';
            this.loadContacts();
        } else {
            chatWindow.style.display = 'none';
            chatToggle.style.display = 'block';
        }
    }

    loadContacts() {
        if (!this.currentUser) return;
        
        const contactsSidebar = document.getElementById('contacts-sidebar');
        const allUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
        const otherUsers = allUsers.filter(u => u.username !== this.currentUser.username);
        
        let contactsHTML = '';
        otherUsers.forEach(user => {
            const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();
            contactsHTML += `
                <div class="contact-item" onclick="app.selectContact('${user.username}', '${user.name}')" data-username="${user.username}">
                    <div class="contact-avatar">${initials}</div>
                    <div class="contact-name">${user.name.split(' ')[0]}</div>
                </div>
            `;
        });
        
        contactsSidebar.innerHTML = contactsHTML;
    }

    selectContact(username, name) {
        this.selectedContact = username;
        
        // Update header
        document.getElementById('chat-contact-name').textContent = name;
        document.getElementById('chat-contact-status').textContent = 'Online';
        
        // Update active contact
        document.querySelectorAll('.contact-item').forEach(item => item.classList.remove('active'));
        document.querySelector(`[data-username="${username}"]`).classList.add('active');
        
        // Load conversation
        this.loadConversation(username);
    }

    loadConversation(username) {
        const messagesContainer = document.getElementById('chat-messages');
        const messages = this.data.messages.filter(msg => 
            (msg.from === this.currentUser.username && msg.to === username) ||
            (msg.from === username && msg.to === this.currentUser.username)
        ).sort((a, b) => new Date(a.date + ' ' + (a.time || '00:00')) - new Date(b.date + ' ' + (b.time || '00:00')));
        
        if (messages.length === 0) {
            messagesContainer.innerHTML = `
                <div class="message bot">
                    Hello 👋 How can I help you?
                </div>
            `;
            return;
        }
        
        let messagesHTML = '';
        messages.forEach(msg => {
            const isUser = msg.from === this.currentUser.username;
            messagesHTML += `
                <div class="message ${isUser ? 'user' : 'bot'}">
                    ${msg.content}
                </div>
            `;
        });
        
        messagesContainer.innerHTML = messagesHTML;
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    loadContactsInline(role) {
        if (!this.currentUser) return;
        
        const contactsSidebar = document.getElementById(`contacts-sidebar-${role}`) || document.getElementById('contacts-sidebar');
        if (!contactsSidebar) return;
        
        const allUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
        const otherUsers = allUsers.filter(u => u.username !== this.currentUser.username);
        
        let contactsHTML = '';
        otherUsers.forEach(user => {
            const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();
            const roleIcon = user.role === 'admin' ? '👑' : user.role === 'teacher' ? '👩‍🏫' : '👨‍👩‍👧‍👦';
            contactsHTML += `
                <div class="contact-item" onclick="app.selectContactInline('${user.username}', '${user.name}', '${role}')" data-username="${user.username}" style="padding: 15px 12px; border-bottom: 1px solid #e2e8f0; cursor: pointer; text-align: center; transition: all 0.3s ease; border-radius: 12px; margin: 8px;">
                    <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(45deg, #667eea, #764ba2); margin: 0 auto 8px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 14px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">${initials}</div>
                    <div style="font-size: 11px; font-weight: 600; color: #2d3748; margin-bottom: 4px;">${user.name.split(' ')[0]}</div>
                    <div style="font-size: 16px;">${roleIcon}</div>
                </div>
            `;
        });
        
        contactsSidebar.innerHTML = contactsHTML;
    }

    selectContactInline(username, name, role) {
        this.selectedContact = username;
        
        // Update header
        const nameEl = document.getElementById(`chat-contact-name-${role}`) || document.getElementById('chat-contact-name');
        const statusEl = document.getElementById(`chat-contact-status-${role}`) || document.getElementById('chat-contact-status');
        if (nameEl) nameEl.textContent = name;
        if (statusEl) statusEl.textContent = 'Online';
        
        // Update active contact - remove previous active states
        document.querySelectorAll('.contact-item').forEach(item => {
            item.style.background = '';
            item.style.color = '';
        });
        
        // Set new active contact
        const activeContact = document.querySelector(`[data-username="${username}"]`);
        if (activeContact) {
            activeContact.style.background = '#667eea';
            activeContact.style.color = 'white';
        }
        
        // Load conversation
        this.loadConversationInline(username, role);
    }

    loadConversationInline(username, role) {
        const messagesContainer = document.getElementById(`chat-messages-${role}`) || document.getElementById('chat-messages');
        const messages = this.data.messages.filter(msg => 
            (msg.from === this.currentUser.username && msg.to === username) ||
            (msg.from === username && msg.to === this.currentUser.username)
        ).sort((a, b) => new Date(a.date + ' ' + (a.time || '00:00')) - new Date(b.date + ' ' + (b.time || '00:00')));
        
        if (messages.length === 0) {
            messagesContainer.innerHTML = `
                <div class="message" style="margin-bottom: 15px; max-width: 80%; padding: 10px 15px; border-radius: 18px; font-size: 14px; line-height: 1.4; background: white; border: 1px solid #e9ecef; margin-right: auto; color: #1F2937;">
                    Hello 👋 How can I help you?
                </div>
            `;
            return;
        }
        
        let messagesHTML = '';
        messages.forEach(msg => {
            const isUser = msg.from === this.currentUser.username;
            const style = isUser ? 
                'margin-bottom: 15px; max-width: 80%; padding: 10px 15px; border-radius: 18px; font-size: 14px; line-height: 1.4; background: #2563EB; color: white; margin-left: auto; font-weight: 500;' :
                'margin-bottom: 15px; max-width: 80%; padding: 10px 15px; border-radius: 18px; font-size: 14px; line-height: 1.4; background: white; border: 1px solid #e9ecef; margin-right: auto; color: #1F2937; font-weight: 500;';
            messagesHTML += `
                <div class="message" style="${style}">
                    ${msg.content}
                </div>
            `;
        });
        
        messagesContainer.innerHTML = messagesHTML;
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    sendChatMessageInline(role) {
        const input = document.getElementById(`chat-input-${role}`) || document.getElementById('chat-input');
        if (!input) return;
        
        const messageText = input.value.trim();
        
        if (!messageText || !this.selectedContact) {
            this.showNotification('Please select a contact and enter a message', 'error');
            return;
        }
        
        const message = {
            id: Date.now(),
            from: this.currentUser.username,
            to: this.selectedContact,
            subject: 'Chat Message',
            content: messageText,
            date: new Date().toISOString().split('T')[0],
            time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            read: false
        };
        
        this.data.messages.push(message);
        this.saveData();
        
        input.value = '';
        this.loadConversationInline(this.selectedContact, role);
        this.showNotification('Message sent!', 'success');
    }

    addStudent() {
        this.showModal('Add New Student', `
            <div class="form-row">
                <div class="form-group input-icon" data-icon="👤">
                    <label>Full Name *</label>
                    <input type="text" id="student-name" placeholder="Enter student's full name" required>
                </div>
                <div class="form-group input-icon" data-icon="🏫">
                    <label>Class *</label>
                    <select id="student-class" required>
                        <option value="">Select Class</option>
                        <option value="10A">10A</option>
                        <option value="10B">10B</option>
                        <option value="11A">11A</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group input-icon" data-icon="📧">
                    <label>Email</label>
                    <input type="email" id="student-email" placeholder="student@email.com">
                </div>
                <div class="form-group input-icon" data-icon="📞">
                    <label>Phone</label>
                    <input type="tel" id="student-phone" placeholder="+1 (555) 123-4567">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group input-icon" data-icon="📅">
                    <label>Date of Birth</label>
                    <input type="date" id="student-dob">
                </div>
                <div class="form-group input-icon" data-icon="🏠">
                    <label>Address</label>
                    <input type="text" id="student-address" placeholder="Student address">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group input-icon" data-icon="👨👩">
                    <label>Parent/Guardian Name</label>
                    <input type="text" id="student-parent" placeholder="Parent or guardian name">
                </div>
                <div class="form-group input-icon" data-icon="💰">
                    <label>Annual Fees</label>
                    <input type="number" id="student-fees" placeholder="5000" value="5000">
                </div>
            </div>
            <div class="btn-group">
                <button class="btn btn-success" onclick="app.saveStudent()">💾 Save Student</button>
                <button class="btn btn-secondary" onclick="app.closeModal()">❌ Cancel</button>
            </div>
        `);
    }

    deleteStudent(id) {
        this.showConfirmation(
            'Are you sure you want to delete this student? This action cannot be undone.',
            () => {
                const studentName = this.data.students.find(s => s.id === id)?.name;
                this.data.students = this.data.students.filter(s => s.id !== id);
                this.saveData();
                this.logAuditEvent('delete_student', `Student ${studentName} deleted`);
                this.loadSection('students', 'admin');
                this.showNotification('Student deleted successfully!', 'success');
            }
        );
    }

    logout() {
        this.clearSessionTimer();
        this.stopSync(); // Stop syncing on logout
        this.logAuditEvent('logout', `User ${this.currentUser?.username} logged out`);
        this.currentUser = null;
        localStorage.removeItem('currentUser');
        this.renderLoginScreen();
        this.showNotification('Logged out successfully!', 'success');
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    addTeacher() {
        this.showModal('Add New Teacher', `
            <div class="form-row">
                <div class="form-group input-icon" data-icon="👩🏫">
                    <label>Full Name *</label>
                    <input type="text" id="teacher-name" placeholder="Enter teacher's full name" required>
                </div>
                <div class="form-group input-icon" data-icon="📚">
                    <label>Subject *</label>
                    <input type="text" id="teacher-subject" placeholder="Teaching subject" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group input-icon" data-icon="📧">
                    <label>Email *</label>
                    <input type="email" id="teacher-email" placeholder="teacher@school.com" required>
                </div>
                <div class="form-group input-icon" data-icon="📞">
                    <label>Phone</label>
                    <input type="tel" id="teacher-phone" placeholder="+1 (555) 123-4567">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group input-icon" data-icon="🎓">
                    <label>Qualification</label>
                    <input type="text" id="teacher-qualification" placeholder="Educational qualification">
                </div>
                <div class="form-group input-icon" data-icon="💼">
                    <label>Experience (Years)</label>
                    <input type="number" id="teacher-experience" placeholder="Years of experience">
                </div>
            </div>
            <div class="form-group">
                <label>Assigned Classes</label>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <label style="display: flex; align-items: center; gap: 5px;"><input type="checkbox" value="10A"> 10A</label>
                    <label style="display: flex; align-items: center; gap: 5px;"><input type="checkbox" value="10B"> 10B</label>
                    <label style="display: flex; align-items: center; gap: 5px;"><input type="checkbox" value="11A"> 11A</label>
                </div>
            </div>
            <div class="btn-group">
                <button class="btn btn-success" onclick="app.saveTeacher()">💾 Save Teacher</button>
                <button class="btn btn-secondary" onclick="app.closeModal()">❌ Cancel</button>
            </div>
        `);
    }

    recordPayment(studentId) {
        const amount = parseFloat(prompt("Payment amount:"));
        if (amount > 0) {
            const student = this.data.students.find(s => s.id === studentId);
            student.fees.paid = Math.min(student.fees.paid + amount, student.fees.total);
            this.saveData();
            this.loadSection('fees', 'admin');
            this.showNotification('Payment recorded!', 'success');
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
                status: 'pending'
            });
            this.saveData();
            this.loadSection('homework', 'teacher');
            this.showNotification('Homework assigned!', 'success');
        }
    }

    getConversations() {
        return this.data.messages.filter(msg => 
            msg.from === this.currentUser.username || msg.to === this.currentUser.username
        ).sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    sendDirectMessage() {
        const recipient = document.getElementById('message-recipient').value;
        const subject = document.getElementById('message-subject').value;
        const content = document.getElementById('message-content').value;
        
        if (recipient && subject && content) {
            this.data.messages.push({
                id: Date.now(),
                from: this.currentUser.username,
                to: recipient,
                subject,
                content,
                date: new Date().toISOString().split('T')[0],
                time: new Date().toLocaleTimeString(),
                read: false
            });
            this.saveData();
            document.getElementById('message-recipient').value = '';
            document.getElementById('message-subject').value = '';
            document.getElementById('message-content').value = '';
            this.loadSection('messages', this.currentUser.role);
            this.showNotification('Message sent!', 'success');
        } else {
            this.showNotification('Please fill all fields', 'error');
        }
    }

    replyMessage(messageId) {
        const message = this.data.messages.find(m => m.id == messageId);
        if (message) {
            const replyTo = message.from === this.currentUser.username ? message.to : message.from;
            document.getElementById('message-recipient').value = replyTo;
            document.getElementById('message-subject').value = message.subject.startsWith('Re: ') ? message.subject : 'Re: ' + message.subject;
            document.getElementById('message-content').focus();
        }
    }

    messageTeacher() {
        this.showNotification('Message sent to teacher!', 'success');
    }

    messageParent() {
        this.showNotification('Message sent to parent!', 'success');
    }

    payFees() {
        this.showNotification('Redirecting to payment...', 'info');
    }

    markComplete(id) {
        this.showNotification('Homework marked complete!', 'success');
    }

    quickAction(action) {
        this.showNotification(`${action} feature activated!`, 'info');
    }

    startMessagePolling() {
        // Remove polling to prevent performance issues
    }

    addClass() {
        const className = prompt("Class name:");
        if (className) {
            this.data.classes.push(className);
            this.saveData();
            this.loadSection('classes', 'admin');
            this.showNotification('Class added!', 'success');
        }
    }

    addAnnouncement() {
        const title = document.getElementById('ann-title').value;
        const content = document.getElementById('ann-content').value;
        if (title && content) {
            this.data.announcements.push({
                id: Date.now(),
                title,
                content,
                date: new Date().toISOString().split('T')[0],
                priority: 'info'
            });
            this.saveData();
            this.loadSection('announcements', 'admin');
            this.showNotification('Announcement posted!', 'success');
        }
    }

    selectContactFromDropdown(username) {
        if (!username) return;
        const allUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
        const user = allUsers.find(u => u.username === username);
        if (user) {
            this.selectContactInline(username, user.name, this.currentUser.role);
        }
    }

    addBook() {
        this.showModal('Add New Book', `
            <div class="form-row">
                <div class="form-group input-icon" data-icon="📖">
                    <label>Book Title *</label>
                    <input type="text" id="book-title" placeholder="Enter book title" required>
                </div>
                <div class="form-group input-icon" data-icon="✍️">
                    <label>Author *</label>
                    <input type="text" id="book-author" placeholder="Author name" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group input-icon" data-icon="🔢">
                    <label>ISBN</label>
                    <input type="text" id="book-isbn" placeholder="ISBN number">
                </div>
                <div class="form-group input-icon" data-icon="📚">
                    <label>Category</label>
                    <select id="book-category">
                        <option value="textbook">📚 Textbook</option>
                        <option value="reference">📋 Reference</option>
                        <option value="fiction">📖 Fiction</option>
                        <option value="science">🔬 Science</option>
                        <option value="history">🏛️ History</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group input-icon" data-icon="📅">
                    <label>Publication Year</label>
                    <input type="number" id="book-year" placeholder="2024" min="1900" max="2024">
                </div>
                <div class="form-group input-icon" data-icon="📊">
                    <label>Copies Available</label>
                    <input type="number" id="book-copies" placeholder="1" value="1" min="1">
                </div>
            </div>
            <div class="btn-group">
                <button class="btn btn-success" onclick="app.saveBook()">💾 Save Book</button>
                <button class="btn btn-secondary" onclick="app.closeModal()">❌ Cancel</button>
            </div>
        `);
    }

    addRoute() {
        const route = prompt("Route name:");
        const driver = prompt("Driver name:");
        if (route && driver) {
            this.data.transport.push({
                id: Date.now(),
                route,
                driver,
                students: [],
                capacity: 30
            });
            this.saveData();
            this.showNotification('Route added!', 'success');
        }
    }

    addEvent() {
        this.showModal('Add New Event', `
            <div class="form-row">
                <div class="form-group input-icon" data-icon="🎉">
                    <label>Event Title *</label>
                    <input type="text" id="event-title" placeholder="Enter event title" required>
                </div>
                <div class="form-group input-icon" data-icon="📅">
                    <label>Event Date *</label>
                    <input type="date" id="event-date" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group input-icon" data-icon="⏰">
                    <label>Start Time</label>
                    <input type="time" id="event-time" value="09:00">
                </div>
                <div class="form-group input-icon" data-icon="📍">
                    <label>Location</label>
                    <input type="text" id="event-location" placeholder="Event location">
                </div>
            </div>
            <div class="form-group">
                <label>Event Type</label>
                <select id="event-type">
                    <option value="meeting">📋 Meeting</option>
                    <option value="event">🎉 Event</option>
                    <option value="exam">📝 Exam</option>
                    <option value="holiday">🏖️ Holiday</option>
                    <option value="sports">⚽ Sports</option>
                </select>
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="event-description" placeholder="Event description (optional)" rows="3"></textarea>
            </div>
            <div class="btn-group">
                <button class="btn btn-success" onclick="app.saveEvent()">💾 Save Event</button>
                <button class="btn btn-secondary" onclick="app.closeModal()">❌ Cancel</button>
            </div>
        `);
    }

    toggleTheme() {
        this.darkMode = !this.darkMode;
        localStorage.setItem('darkMode', this.darkMode);
        this.applyTheme();
        this.showNotification(`Switched to ${this.darkMode ? 'dark' : 'light'} theme!`, 'success');
    }

    applyTheme() {
        const body = document.body;
        const app = document.querySelector('.app');
        
        if (this.darkMode) {
            body.style.background = 'linear-gradient(135deg, #1a202c 0%, #2d3748 100%)';
            if (app) {
                app.style.background = '#1a202c';
                app.style.color = '#f7fafc';
            }
            
            // Update all cards and elements
            document.querySelectorAll('.card, .data-item, .stat').forEach(el => {
                el.style.background = '#2d3748';
                el.style.color = '#f7fafc';
                el.style.borderColor = '#4a5568';
            });
            
            document.querySelectorAll('.main').forEach(el => {
                el.style.background = '#1a202c';
                el.style.color = '#f7fafc';
            });
            
            document.querySelectorAll('input, select, textarea').forEach(el => {
                el.style.background = '#2d3748';
                el.style.color = '#f7fafc';
                el.style.border = '2px solid #4a5568';
            });
            
            document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, label').forEach(el => {
                if (!el.closest('.btn') && !el.closest('.notification')) {
                    el.style.color = '#f7fafc';
                }
            });
            
            document.querySelectorAll('.modal-content').forEach(el => {
                el.style.background = '#2d3748';
                el.style.color = '#f7fafc';
            });
            
        } else {
            body.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            if (app) {
                app.style.background = '';
                app.style.color = '';
            }
            
            document.querySelectorAll('.card, .data-item, .stat').forEach(el => {
                el.style.background = 'white';
                el.style.color = '#1a202c';
                el.style.borderColor = '#e2e8f0';
            });
            
            document.querySelectorAll('.main').forEach(el => {
                el.style.background = '#f7fafc';
                el.style.color = '#1a202c';
            });
            
            document.querySelectorAll('input, select, textarea').forEach(el => {
                el.style.background = 'white';
                el.style.color = '#1a202c';
                el.style.border = '2px solid #e2e8f0';
            });
            
            document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, label').forEach(el => {
                if (!el.closest('.btn') && !el.closest('.notification')) {
                    el.style.color = '';
                }
            });
            
            document.querySelectorAll('.modal-content').forEach(el => {
                el.style.background = 'white';
                el.style.color = '#1a202c';
            });
        }
    }

    addExam() {
        const subject = prompt("Exam subject:");
        const className = prompt("Class:");
        const date = prompt("Exam date (YYYY-MM-DD):");
        if (subject && className && date) {
            this.data.exams.push({
                id: Date.now(),
                subject,
                class: className,
                date,
                duration: '2 hours',
                totalMarks: 100
            });
            this.saveData();
            this.loadSection('exams', 'admin');
            this.showNotification('Exam scheduled!', 'success');
        }
    }

    generateCertificate() {
        const studentId = document.getElementById('cert-student').value;
        const student = this.data.students.find(s => s.id == studentId);
        if (student) {
            this.showNotification(`Certificate generated for ${student.name}!`, 'success');
        }
    }

    generateReport(type) {
        this.showNotification(`${type} report generated!`, 'success');
    }

    viewClass(className) {
        const students = this.data.students.filter(s => s.class === className);
        this.showNotification(`Viewing ${students.length} students in class ${className}`, 'info');
    }

    loadClassAttendance() {
        const className = document.getElementById('att-class').value;
        const students = this.data.students.filter(s => s.class === className);
        const listDiv = document.getElementById('attendance-list');
        
        let html = '<div class="card"><h3>Mark Attendance - Class ' + className + '</h3>';
        students.forEach(student => {
            html += `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #eee;">
                    <span>${student.name}</span>
                    <div>
                        <button class="btn btn-success" onclick="app.markAttendance(${student.id}, 'present')">Present</button>
                        <button class="btn btn-danger" onclick="app.markAttendance(${student.id}, 'absent')">Absent</button>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        listDiv.innerHTML = html;
    }

    loadClassMarks() {
        const className = document.getElementById('marks-class').value;
        const students = this.data.students.filter(s => s.class === className);
        const listDiv = document.getElementById('marks-list');
        
        let html = '<div class="card"><h3>Enter Marks - Class ' + className + '</h3>';
        students.forEach(student => {
            html += `
                <div style="padding: 15px; border-bottom: 1px solid #eee;">
                    <h4>${student.name}</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
                        <div>
                            <label>Math:</label>
                            <input type="number" id="math-${student.id}" value="${student.marks.math}" max="100">
                        </div>
                        <div>
                            <label>English:</label>
                            <input type="number" id="english-${student.id}" value="${student.marks.english}" max="100">
                        </div>
                        <div>
                            <label>Science:</label>
                            <input type="number" id="science-${student.id}" value="${student.marks.science}" max="100">
                        </div>
                    </div>
                    <button class="btn btn-primary" onclick="app.saveMarks(${student.id})" style="margin-top: 10px;">Save Marks</button>
                </div>
            `;
        });
        html += '</div>';
        listDiv.innerHTML = html;
    }

    markAttendance(studentId, status) {
        this.showNotification(`Attendance marked as ${status}!`, 'success');
    }

    saveMarks(studentId) {
        const student = this.data.students.find(s => s.id === studentId);
        if (student) {
            student.marks.math = parseInt(document.getElementById(`math-${studentId}`).value) || 0;
            student.marks.english = parseInt(document.getElementById(`english-${studentId}`).value) || 0;
            student.marks.science = parseInt(document.getElementById(`science-${studentId}`).value) || 0;
            
            // Recalculate GPA
            const marks = Object.values(student.marks);
            student.gpa = marks.length ? (marks.reduce((sum, mark) => sum + mark, 0) / marks.length / 100 * 4).toFixed(2) : 0;
            
            this.saveData();
            this.showNotification(`Marks saved for ${student.name}!`, 'success');
        }
    }

    showModal(title, content) {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="close-modal" onclick="app.closeModal()">×</button>
                </div>
                ${content}
            </div>
        `;
        document.body.appendChild(modal);
        this.currentModal = modal;
    }

    closeModal() {
        if (this.currentModal) {
            this.currentModal.remove();
            this.currentModal = null;
        }
    }

    saveStudent() {
        const name = document.getElementById('student-name').value;
        const className = document.getElementById('student-class').value;
        const email = document.getElementById('student-email').value;
        const phone = document.getElementById('student-phone').value;
        const dob = document.getElementById('student-dob').value;
        const address = document.getElementById('student-address').value;
        const parent = document.getElementById('student-parent').value;
        const fees = parseInt(document.getElementById('student-fees').value) || 5000;
        
        if (!name || !className) {
            this.showNotification('Please fill required fields!', 'error');
            return;
        }
        
        this.data.students.push({
            id: Date.now(),
            name,
            class: className,
            email,
            phone,
            dob,
            address,
            parent,
            attendance: 100,
            marks: {math: 0, english: 0, science: 0},
            fees: {total: fees, paid: 0},
            avatar: null,
            gpa: 0
        });
        
        this.saveData();
        this.closeModal();
        this.loadSection('students', 'admin');
        this.showNotification('Student added successfully!', 'success');
    }

    saveEvent() {
        const title = document.getElementById('event-title').value;
        const date = document.getElementById('event-date').value;
        const time = document.getElementById('event-time').value;
        const location = document.getElementById('event-location').value;
        const type = document.getElementById('event-type').value;
        const description = document.getElementById('event-description').value;
        
        if (!title || !date) {
            this.showNotification('Please fill required fields!', 'error');
            return;
        }
        
        this.data.events.push({
            id: Date.now(),
            title,
            date,
            time: time || '09:00',
            location,
            type,
            description
        });
        
        this.saveData();
        this.closeModal();
        this.loadSection('calendar', 'admin');
        this.showNotification('Event added successfully!', 'success');
    }

    saveTeacher() {
        const name = document.getElementById('teacher-name').value;
        const subject = document.getElementById('teacher-subject').value;
        const email = document.getElementById('teacher-email').value;
        const phone = document.getElementById('teacher-phone').value;
        const qualification = document.getElementById('teacher-qualification').value;
        const experience = document.getElementById('teacher-experience').value;
        
        const classes = [];
        document.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
            classes.push(cb.value);
        });
        
        if (!name || !subject || !email) {
            this.showNotification('Please fill required fields!', 'error');
            return;
        }
        
        this.data.teachers.push({
            id: Date.now(),
            name,
            subject,
            email,
            phone,
            qualification,
            experience: parseInt(experience) || 0,
            classes
        });
        
        this.saveData();
        this.closeModal();
        this.loadSection('teachers', 'admin');
        this.showNotification('Teacher added successfully!', 'success');
    }

    saveBook() {
        const title = document.getElementById('book-title').value;
        const author = document.getElementById('book-author').value;
        const isbn = document.getElementById('book-isbn').value;
        const category = document.getElementById('book-category').value;
        const year = document.getElementById('book-year').value;
        const copies = parseInt(document.getElementById('book-copies').value) || 1;
        
        if (!title || !author) {
            this.showNotification('Please fill required fields!', 'error');
            return;
        }
        
        this.data.library.push({
            id: Date.now(),
            title,
            author,
            isbn: isbn || Math.random().toString().substr(2, 10),
            category,
            year: parseInt(year),
            copies,
            available: true,
            borrowedBy: null
        });
        
        this.saveData();
        this.closeModal();
        this.loadSection('library', 'admin');
        this.showNotification('Book added successfully!', 'success');
    }

    borrowBook(bookId) {
        const book = this.data.library.find(b => b.id === bookId);
        if (book && book.available) {
            book.available = false;
            book.borrowedBy = this.currentUser.name;
            this.saveData();
            this.loadSection('library', 'parent');
            this.showNotification(`${book.title} borrowed successfully!`, 'success');
        }
    }

    sendChatMessage() {
        const input = document.getElementById('chat-input');
        if (!input) return;
        
        const messageText = input.value.trim();
        
        if (!messageText || !this.selectedContact) {
            this.showNotification('Please select a contact and enter a message', 'error');
            return;
        }
        
        const message = {
            id: Date.now(),
            from: this.currentUser.username,
            to: this.selectedContact,
            subject: 'Chat Message',
            content: messageText,
            date: new Date().toISOString().split('T')[0],
            time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            read: false
        };
        
        this.data.messages.push(message);
        this.saveData();
        this.logAuditEvent('send_message', `Message sent to ${this.selectedContact}`);
        
        input.value = '';
        this.loadConversationInline(this.selectedContact, this.currentUser.role);
        this.showNotification('Message sent!', 'success');
    }

    // Professional features implementation
    renderStudentsList() {
        return this.data.students.map(student => `
            <div class="data-item">
                <div class="checkbox-item">
                    <input type="checkbox" id="student-${student.id}" onchange="app.toggleSelection('students', ${student.id})">
                </div>
                <h4>${student.name}</h4>
                <p>Class: ${student.class}</p>
                <p>Attendance: ${student.attendance}%</p>
                <p>GPA: ${student.gpa}/4.0</p>
                <div class="btn-group">
                    <button class="btn btn-warning" onclick="app.editStudent(${student.id})">✏️ Edit</button>
                    <button class="btn btn-danger" onclick="app.deleteStudent(${student.id})">🗑️ Delete</button>
                </div>
            </div>
        `).join('');
    }

    getAccountContent() {
        return `
            <div class="card">
                <h3><i class="fas fa-user-circle"></i> My Account</h3>
                <div style="display: grid; grid-template-columns: 200px 1fr; gap: 30px; align-items: start;">
                    <div style="text-align: center;">
                        <div style="width: 150px; height: 150px; border-radius: 50%; background: #2563EB; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; color: white; font-size: 48px; font-weight: 700; box-shadow: 0 8px 30px rgba(37, 99, 235, 0.3);">
                            ${this.currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </div>
                        <input type="file" id="avatar-upload" accept="image/*" style="display: none;" onchange="app.uploadAvatar(this)">
                        <button class="btn btn-secondary" onclick="document.getElementById('avatar-upload').click()" style="font-size: 12px;">📷 Change Photo</button>
                    </div>
                    <div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Full Name</label>
                                <input type="text" id="account-name" value="${this.currentUser.name}">
                                <div class="error-message"></div>
                            </div>
                            <div class="form-group">
                                <label>Role</label>
                                <input type="text" value="${this.currentUser.role.charAt(0).toUpperCase() + this.currentUser.role.slice(1)}" readonly>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Email</label>
                                <input type="email" id="account-email" value="${this.currentUser.email || ''}">
                                <div class="error-message"></div>
                            </div>
                            <div class="form-group">
                                <label>Phone</label>
                                <input type="tel" id="account-phone" value="${this.currentUser.phone || ''}" placeholder="+1 (555) 123-4567">
                                <div class="error-message"></div>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Address</label>
                            <textarea id="account-address" placeholder="Enter your address">${this.currentUser.address || ''}</textarea>
                            <div class="error-message"></div>
                        </div>
                        <div class="form-group">
                            <label>School Name</label>
                            <input type="text" value="Southern Cross School" readonly>
                        </div>
                        <div class="btn-group">
                            <button class="btn btn-primary" onclick="app.updateAccount()">💾 Update Profile</button>
                            <button class="btn btn-warning" onclick="app.changePassword()">🔒 Change Password</button>
                            <button class="btn export-button" onclick="app.exportAccountData()">📊 Export My Data</button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="card">
                <h3><i class="fas fa-history"></i> Account Activity</h3>
                <div id="account-activity">
                    ${this.getAccountActivity()}
                </div>
            </div>
        `;
    }

    getAccountActivity() {
        const auditLog = JSON.parse(localStorage.getItem('auditLog') || '[]');
        const userActivity = auditLog.filter(log => log.user === this.currentUser.username).slice(-10);
        
        if (userActivity.length === 0) {
            return '<p>No recent activity</p>';
        }
        
        return userActivity.map(activity => `
            <div style="padding: 10px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between;">
                <span>${activity.action.replace('_', ' ').toUpperCase()}: ${activity.details}</span>
                <span style="color: #666; font-size: 12px;">${new Date(activity.timestamp).toLocaleString()}</span>
            </div>
        `).join('');
    }

    async updateAccount() {
        this.showLoading('Updating account...');
        
        const name = document.getElementById('account-name').value;
        const email = document.getElementById('account-email').value;
        const phone = document.getElementById('account-phone').value;
        const address = document.getElementById('account-address').value;
        
        if (!this.validateForm([{id: 'account-name', value: name}, {id: 'account-email', value: email}])) {
            this.hideLoading();
            return;
        }
        
        if (!this.validateEmail(email)) {
            this.showFieldError('account-email', 'Please enter a valid email address');
            this.hideLoading();
            return;
        }
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Update current user
        this.currentUser.name = name;
        this.currentUser.email = email;
        this.currentUser.phone = phone;
        this.currentUser.address = address;
        
        // Update in registered users
        const users = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
        const userIndex = users.findIndex(u => u.id === this.currentUser.id);
        if (userIndex !== -1) {
            users[userIndex] = {...users[userIndex], name, email, phone, address};
            localStorage.setItem('registeredUsers', JSON.stringify(users));
        }
        
        localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
        this.logAuditEvent('update_profile', 'Profile information updated');
        
        this.hideLoading();
        this.showNotification('Account updated successfully!', 'success');
    }

    changePassword() {
        this.showModal('Change Password', `
            <div class="form-group">
                <label>Current Password</label>
                <input type="password" id="current-password" placeholder="Enter current password">
                <div class="error-message"></div>
            </div>
            <div class="form-group">
                <label>New Password</label>
                <input type="password" id="new-password" placeholder="Enter new password">
                <div class="error-message"></div>
            </div>
            <div class="form-group">
                <label>Confirm New Password</label>
                <input type="password" id="confirm-new-password" placeholder="Confirm new password">
                <div class="error-message"></div>
            </div>
            <div class="btn-group">
                <button class="btn btn-primary" onclick="app.saveNewPassword()">🔒 Update Password</button>
                <button class="btn btn-secondary" onclick="app.closeModal()">❌ Cancel</button>
            </div>
        `);
    }

    async saveNewPassword() {
        this.showLoading('Updating password...');
        
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-new-password').value;
        
        const fields = [{id: 'current-password', value: currentPassword}, {id: 'new-password', value: newPassword}, {id: 'confirm-new-password', value: confirmPassword}];
        
        if (!this.validateForm(fields)) {
            this.hideLoading();
            return;
        }
        
        // Verify current password
        const users = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
        const user = users.find(u => u.id === this.currentUser.id);
        
        if (!user || !await this.verifyPassword(currentPassword, user.password)) {
            this.showFieldError('current-password', 'Current password is incorrect');
            this.hideLoading();
            return;
        }
        
        if (!this.validatePassword(newPassword)) {
            this.showFieldError('new-password', 'Password must be at least 8 characters with uppercase, lowercase, and number');
            this.hideLoading();
            return;
        }
        
        if (newPassword !== confirmPassword) {
            this.showFieldError('confirm-new-password', 'Passwords do not match');
            this.hideLoading();
            return;
        }
        
        // Update password
        const hashedPassword = await this.hashPassword(newPassword);
        const userIndex = users.findIndex(u => u.id === this.currentUser.id);
        if (userIndex !== -1) {
            users[userIndex].password = hashedPassword;
            localStorage.setItem('registeredUsers', JSON.stringify(users));
        }
        
        this.logAuditEvent('change_password', 'Password changed successfully');
        this.hideLoading();
        this.closeModal();
        this.showNotification('Password updated successfully!', 'success');
    }

    uploadAvatar(input) {
        const file = input.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                // In a real app, you'd upload to server
                this.showNotification('Avatar uploaded successfully!', 'success');
                this.logAuditEvent('upload_avatar', 'Profile picture updated');
            };
            reader.readAsDataURL(file);
        }
    }

    exportAccountData() {
        const userData = {
            profile: this.currentUser,
            activity: JSON.parse(localStorage.getItem('auditLog') || '[]').filter(log => log.user === this.currentUser.username)
        };
        
        const dataStr = JSON.stringify(userData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${this.currentUser.username}_account_data.json`;
        link.click();
        
        this.logAuditEvent('export_data', 'Account data exported');
        this.showNotification('Account data exported successfully!', 'success');
    }

    searchData(type, query) {
        // Implement search functionality
        const list = document.getElementById(`${type}-list`);
        if (list) {
            const items = list.querySelectorAll('.data-item');
            items.forEach(item => {
                const text = item.textContent.toLowerCase();
                item.style.display = text.includes(query.toLowerCase()) ? 'block' : 'none';
            });
        }
    }

    toggleSelection(type, id) {
        const checkbox = document.getElementById(`${type.slice(0, -1)}-${id}`);
        const bulkActions = document.getElementById(`bulk-actions-${type}`);
        const checkedBoxes = document.querySelectorAll(`input[id^="${type.slice(0, -1)}-"]:checked`);
        
        if (checkedBoxes.length > 0) {
            bulkActions.classList.add('active');
        } else {
            bulkActions.classList.remove('active');
        }
    }

    bulkDelete(type) {
        const checkedBoxes = document.querySelectorAll(`input[id^="${type.slice(0, -1)}-"]:checked`);
        if (checkedBoxes.length === 0) {
            this.showNotification('Please select items to delete', 'error');
            return;
        }
        
        this.showConfirmation(
            `Are you sure you want to delete ${checkedBoxes.length} selected items?`,
            () => {
                checkedBoxes.forEach(checkbox => {
                    const id = parseInt(checkbox.id.split('-')[1]);
                    this.data[type] = this.data[type].filter(item => item.id !== id);
                });
                this.saveData();
                this.logAuditEvent('bulk_delete', `${checkedBoxes.length} ${type} deleted`);
                this.loadSection(type, this.currentUser.role);
                this.showNotification(`${checkedBoxes.length} items deleted successfully!`, 'success');
            }
        );
    }

    clearSelection(type) {
        const checkboxes = document.querySelectorAll(`input[id^="${type.slice(0, -1)}-"]`);
        checkboxes.forEach(checkbox => checkbox.checked = false);
        document.getElementById(`bulk-actions-${type}`).classList.remove('active');
    }

    exportData(type) {
        let data, filename;
        
        switch(type) {
            case 'students':
                data = this.data.students;
                filename = 'students_export.json';
                break;
            case 'messages':
                data = this.data.messages.filter(msg => msg.from === this.currentUser.username || msg.to === this.currentUser.username);
                filename = 'messages_export.json';
                break;
            default:
                data = this.data[type] || [];
                filename = `${type}_export.json`;
        }
        
        const dataStr = JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        
        this.logAuditEvent('export_data', `${type} data exported`);
        this.showNotification(`${type.charAt(0).toUpperCase() + type.slice(1)} data exported successfully!`, 'success');
    }

    printData(type) {
        const printWindow = window.open('', '_blank');
        let content = `
            <html>
                <head>
                    <title>Southern Cross School - ${type.charAt(0).toUpperCase() + type.slice(1)} Report</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        .header { text-align: center; margin-bottom: 30px; }
                        .logo { font-size: 24px; font-weight: bold; color: #2563EB; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f2f2f2; }
                        .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="logo">SC Southern Cross School</div>
                        <h2>${type.charAt(0).toUpperCase() + type.slice(1)} Report</h2>
                        <p>Generated on: ${new Date().toLocaleDateString()}</p>
                    </div>
        `;
        
        if (type === 'students') {
            content += `
                <table>
                    <tr><th>Name</th><th>Class</th><th>Attendance</th><th>GPA</th></tr>
                    ${this.data.students.map(student => 
                        `<tr><td>${student.name}</td><td>${student.class}</td><td>${student.attendance}%</td><td>${student.gpa}</td></tr>`
                    ).join('')}
                </table>
            `;
        }
        
        content += `
                    <div class="footer">
                        <p>Southern Cross School Management System</p>
                    </div>
                </body>
            </html>
        `;
        
        printWindow.document.write(content);
        printWindow.document.close();
        printWindow.print();
        
        this.logAuditEvent('print_data', `${type} report printed`);
        this.showNotification(`${type.charAt(0).toUpperCase() + type.slice(1)} report sent to printer!`, 'success');
    }

    // Enhanced Teacher Functions
    viewClassStudents(className) {
        const students = this.data.students.filter(s => s.class === className);
        this.showModal(`Students in Class ${className}`, `
            <div style="max-height: 400px; overflow-y: auto;">
                ${students.map(student => `
                    <div style="padding: 15px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h4>${student.name}</h4>
                            <p>Attendance: ${student.attendance}% | GPA: ${student.gpa}</p>
                        </div>
                        <button class="btn btn-primary" onclick="app.editStudentInfo(${student.id})">✏️ Edit</button>
                    </div>
                `).join('')}
            </div>
            <button class="btn btn-secondary" onclick="app.closeModal()">Close</button>
        `);
    }

    editClassStudents(className) {
        const students = this.data.students.filter(s => s.class === className);
        this.showModal(`Edit Students - Class ${className}`, `
            <div style="max-height: 400px; overflow-y: auto;">
                ${students.map(student => `
                    <div style="padding: 15px; border-bottom: 1px solid #eee;">
                        <div class="form-row">
                            <div class="form-group">
                                <label>Name</label>
                                <input type="text" id="edit-name-${student.id}" value="${student.name}">
                            </div>
                            <div class="form-group">
                                <label>Attendance %</label>
                                <input type="number" id="edit-attendance-${student.id}" value="${student.attendance}" max="100">
                            </div>
                        </div>
                        <div class="form-row-3">
                            <div class="form-group">
                                <label>Math</label>
                                <input type="number" id="edit-math-${student.id}" value="${student.marks.math}" max="100">
                            </div>
                            <div class="form-group">
                                <label>English</label>
                                <input type="number" id="edit-english-${student.id}" value="${student.marks.english}" max="100">
                            </div>
                            <div class="form-group">
                                <label>Science</label>
                                <input type="number" id="edit-science-${student.id}" value="${student.marks.science}" max="100">
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="btn-group">
                <button class="btn btn-success" onclick="app.saveAllStudentEdits('${className}')">💾 Save All Changes</button>
                <button class="btn btn-secondary" onclick="app.closeModal()">❌ Cancel</button>
            </div>
        `);
    }

    saveAllStudentEdits(className) {
        const students = this.data.students.filter(s => s.class === className);
        students.forEach(student => {
            const name = document.getElementById(`edit-name-${student.id}`)?.value;
            const attendance = document.getElementById(`edit-attendance-${student.id}`)?.value;
            const math = document.getElementById(`edit-math-${student.id}`)?.value;
            const english = document.getElementById(`edit-english-${student.id}`)?.value;
            const science = document.getElementById(`edit-science-${student.id}`)?.value;
            
            if (name) student.name = name;
            if (attendance) student.attendance = parseInt(attendance);
            if (math) student.marks.math = parseInt(math);
            if (english) student.marks.english = parseInt(english);
            if (science) student.marks.science = parseInt(science);
            
            // Recalculate GPA
            const marks = Object.values(student.marks);
            student.gpa = marks.length ? (marks.reduce((sum, mark) => sum + mark, 0) / marks.length / 100 * 4).toFixed(2) : 0;
        });
        
        this.saveData();
        this.logAuditEvent('edit_students', `Updated students in class ${className}`);
        this.closeModal();
        this.showNotification('All student information updated successfully!', 'success');
    }

    markClassAttendance(className) {
        const students = this.data.students.filter(s => s.class === className);
        const today = new Date().toISOString().split('T')[0];
        
        this.showModal(`Mark Attendance - Class ${className}`, `
            <div style="margin-bottom: 20px;">
                <p><strong>Date:</strong> ${today}</p>
                <div style="display: flex; gap: 15px; margin: 15px 0;">
                    <button class="btn btn-success" onclick="app.markAllPresent('${className}')">✅ Mark All Present</button>
                    <button class="btn btn-danger" onclick="app.markAllAbsent('${className}')">❌ Mark All Absent</button>
                </div>
            </div>
            <div style="max-height: 400px; overflow-y: auto;">
                ${students.map(student => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #eee;">
                        <span><strong>${student.name}</strong></span>
                        <div>
                            <button class="btn btn-success" onclick="app.markStudentAttendance(${student.id}, 'present')" id="present-${student.id}">Present</button>
                            <button class="btn btn-danger" onclick="app.markStudentAttendance(${student.id}, 'absent')" id="absent-${student.id}">Absent</button>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="btn-group">
                <button class="btn btn-primary" onclick="app.saveAttendance('${className}')">💾 Save Attendance</button>
                <button class="btn btn-secondary" onclick="app.closeModal()">❌ Cancel</button>
            </div>
        `);
    }

    markStudentAttendance(studentId, status) {
        // Visual feedback
        document.querySelectorAll(`#present-${studentId}, #absent-${studentId}`).forEach(btn => {
            btn.style.opacity = '0.5';
        });
        document.getElementById(`${status}-${studentId}`).style.opacity = '1';
        document.getElementById(`${status}-${studentId}`).style.background = status === 'present' ? '#22C55E' : '#EF4444';
    }

    addAssignment() {
        this.showModal('Create New Assignment', `
            <div class="form-row">
                <div class="form-group">
                    <label>Class</label>
                    <select id="assignment-class">
                        <option value="10A">10A</option>
                        <option value="10B">10B</option>
                        <option value="11A">11A</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Subject</label>
                    <input type="text" id="assignment-subject" placeholder="Subject name">
                </div>
            </div>
            <div class="form-group">
                <label>Assignment Title</label>
                <input type="text" id="assignment-title" placeholder="Assignment title">
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="assignment-description" placeholder="Assignment description and instructions" rows="4"></textarea>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Due Date</label>
                    <input type="date" id="assignment-due" value="${new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0]}">
                </div>
                <div class="form-group">
                    <label>Total Marks</label>
                    <input type="number" id="assignment-marks" value="100" min="1">
                </div>
            </div>
            <div class="form-group">
                <label>Attach Files</label>
                <input type="file" id="assignment-files" multiple accept=".pdf,.doc,.docx,.txt">
            </div>
            <div class="btn-group">
                <button class="btn btn-success" onclick="app.saveAssignment()">📝 Create Assignment</button>
                <button class="btn btn-secondary" onclick="app.closeModal()">❌ Cancel</button>
            </div>
        `);
    }

    saveAssignment() {
        const className = document.getElementById('assignment-class').value;
        const subject = document.getElementById('assignment-subject').value;
        const title = document.getElementById('assignment-title').value;
        const description = document.getElementById('assignment-description').value;
        const dueDate = document.getElementById('assignment-due').value;
        const totalMarks = document.getElementById('assignment-marks').value;
        
        if (!subject || !title || !description) {
            this.showNotification('Please fill all required fields', 'error');
            return;
        }
        
        this.data.homework.push({
            id: Date.now(),
            class: className,
            subject,
            title,
            task: description,
            dueDate,
            totalMarks: parseInt(totalMarks),
            createdBy: this.currentUser.name,
            createdDate: new Date().toISOString().split('T')[0],
            status: 'active'
        });
        
        this.saveData();
        this.logAuditEvent('create_assignment', `Assignment "${title}" created for class ${className}`);
        this.closeModal();
        this.showNotification('Assignment created successfully!', 'success');
    }

    editTimetable() {
        this.showModal('Edit Timetable', `
            <div style="max-height: 500px; overflow-y: auto;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr style="background: #f8f9fa;">
                        <th style="padding: 10px; border: 1px solid #ddd;">Time</th>
                        <th style="padding: 10px; border: 1px solid #ddd;">Monday</th>
                        <th style="padding: 10px; border: 1px solid #ddd;">Tuesday</th>
                        <th style="padding: 10px; border: 1px solid #ddd;">Wednesday</th>
                        <th style="padding: 10px; border: 1px solid #ddd;">Thursday</th>
                        <th style="padding: 10px; border: 1px solid #ddd;">Friday</th>
                    </tr>
                    ${this.generateTimetableEditRows()}
                </table>
            </div>
            <div class="btn-group">
                <button class="btn btn-success" onclick="app.saveTimetable()">💾 Save Timetable</button>
                <button class="btn btn-secondary" onclick="app.closeModal()">❌ Cancel</button>
            </div>
        `);
    }

    generateTimetableEditRows() {
        const times = ['9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM'];
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
        
        return times.map(time => `
            <tr>
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">${time}</td>
                ${days.map(day => `
                    <td style="padding: 5px; border: 1px solid #ddd;">
                        <input type="text" id="${day}-${time.replace(/[^a-zA-Z0-9]/g, '')}" 
                               style="width: 100%; border: none; padding: 5px;" 
                               placeholder="Subject - Class">
                    </td>
                `).join('')}
            </tr>
        `).join('');
    }

    renderTimetable() {
        return `
            <table style="width: 100%; border-collapse: collapse;">
                <tr style="background: #f8f9fa;">
                    <th style="padding: 10px; border: 1px solid #ddd; color: #000;">Time</th>
                    <th style="padding: 10px; border: 1px solid #ddd; color: #000;">Monday</th>
                    <th style="padding: 10px; border: 1px solid #ddd; color: #000;">Tuesday</th>
                    <th style="padding: 10px; border: 1px solid #ddd; color: #000;">Wednesday</th>
                    <th style="padding: 10px; border: 1px solid #ddd; color: #000;">Thursday</th>
                    <th style="padding: 10px; border: 1px solid #ddd; color: #000;">Friday</th>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd; color: #000;">9:00 AM</td>
                    <td style="padding: 10px; border: 1px solid #ddd; color: #000;">Math - 10A</td>
                    <td style="padding: 10px; border: 1px solid #ddd; color: #000;">Math - 10B</td>
                    <td style="padding: 10px; border: 1px solid #ddd; color: #000;">Science - 10A</td>
                    <td style="padding: 10px; border: 1px solid #ddd; color: #000;">English - 10B</td>
                    <td style="padding: 10px; border: 1px solid #ddd; color: #000;">Free Period</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd; color: #000;">10:00 AM</td>
                    <td style="padding: 10px; border: 1px solid #ddd; color: #000;">English - 10A</td>
                    <td style="padding: 10px; border: 1px solid #ddd; color: #000;">Science - 10B</td>
                    <td style="padding: 10px; border: 1px solid #ddd; color: #000;">Math - 10A</td>
                    <td style="padding: 10px; border: 1px solid #ddd; color: #000;">Math - 10B</td>
                    <td style="padding: 10px; border: 1px solid #ddd; color: #000;">Staff Meeting</td>
                </tr>
            </table>
        `;
    }

    // Enhanced Admin Functions
    uploadStudyMaterial() {
        this.showModal('Upload Study Material', `
            <div class="form-row">
                <div class="form-group">
                    <label>Subject</label>
                    <select id="material-subject">
                        <option value="Mathematics">Mathematics</option>
                        <option value="English">English</option>
                        <option value="Science">Science</option>
                        <option value="History">History</option>
                        <option value="Geography">Geography</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Class/Grade</label>
                    <select id="material-class">
                        <option value="10A">10A</option>
                        <option value="10B">10B</option>
                        <option value="11A">11A</option>
                        <option value="All">All Classes</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>Material Title</label>
                <input type="text" id="material-title" placeholder="e.g., Chapter 5 - Algebra Basics">
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="material-description" placeholder="Brief description of the study material" rows="3"></textarea>
            </div>
            <div class="form-group">
                <label>Upload Files</label>
                <input type="file" id="material-files" multiple accept=".pdf,.doc,.docx,.ppt,.pptx">
                <small>Supported formats: PDF, DOC, DOCX, PPT, PPTX</small>
            </div>
            <div class="btn-group">
                <button class="btn btn-success" onclick="app.saveStudyMaterial()">📖 Upload Material</button>
                <button class="btn btn-secondary" onclick="app.closeModal()">❌ Cancel</button>
            </div>
        `);
    }

    uploadDocument() {
        this.showModal('Upload Important Document', `
            <div class="form-row">
                <div class="form-group">
                    <label>Document Type</label>
                    <select id="doc-type">
                        <option value="policy">School Policy</option>
                        <option value="handbook">Student Handbook</option>
                        <option value="form">Forms & Applications</option>
                        <option value="notice">Official Notice</option>
                        <option value="guideline">Guidelines</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Access Level</label>
                    <select id="doc-access">
                        <option value="all">All Users</option>
                        <option value="teachers">Teachers Only</option>
                        <option value="parents">Parents Only</option>
                        <option value="admin">Admin Only</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>Document Title</label>
                <input type="text" id="doc-title" placeholder="e.g., Student Code of Conduct 2024">
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="doc-description" placeholder="Brief description of the document" rows="3"></textarea>
            </div>
            <div class="form-group">
                <label>Upload Document</label>
                <input type="file" id="doc-file" accept=".pdf,.doc,.docx">
                <small>Supported formats: PDF, DOC, DOCX</small>
            </div>
            <div class="btn-group">
                <button class="btn btn-success" onclick="app.saveDocument()">📄 Upload Document</button>
                <button class="btn btn-secondary" onclick="app.closeModal()">❌ Cancel</button>
            </div>
        `);
    }

    uploadSyllabus() {
        this.showModal('Upload Syllabus', `
            <div class="form-row">
                <div class="form-group">
                    <label>Subject</label>
                    <select id="syllabus-subject">
                        <option value="Mathematics">Mathematics</option>
                        <option value="English">English</option>
                        <option value="Science">Science</option>
                        <option value="History">History</option>
                        <option value="Geography">Geography</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Academic Year</label>
                    <select id="syllabus-year">
                        <option value="2026">2026</option>
                        <option value="2027">2027</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Class/Grade</label>
                    <select id="syllabus-class">
                        <option value="10">Grade 10</option>
                        <option value="11">Grade 11</option>
                        <option value="12">Grade 12</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Term/Semester</label>
                    <select id="syllabus-term">
                        <option value="full">Full Year</option>
                        <option value="term1">Term 1</option>
                        <option value="term2">Term 2</option>
                        <option value="term3">Term 3</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>Syllabus Title</label>
                <input type="text" id="syllabus-title" placeholder="e.g., Mathematics Grade 10 - Full Year Syllabus">
            </div>
            <div class="form-group">
                <label>Upload Syllabus</label>
                <input type="file" id="syllabus-file" accept=".pdf,.doc,.docx">
                <small>Supported formats: PDF, DOC, DOCX</small>
            </div>
            <div class="btn-group">
                <button class="btn btn-success" onclick="app.saveSyllabus()">📋 Upload Syllabus</button>
                <button class="btn btn-secondary" onclick="app.closeModal()">❌ Cancel</button>
            </div>
        `);
    }

    renderLibraryItems() {
        const books = this.data.library || [];
        const studyMaterials = JSON.parse(localStorage.getItem('studyMaterials') || '[]');
        const documents = JSON.parse(localStorage.getItem('documents') || '[]');
        const syllabi = JSON.parse(localStorage.getItem('syllabi') || '[]');
        
        let html = '';
        
        // Books
        books.forEach(book => {
            html += `
                <div class="data-item">
                    <h4>📚 ${book.title}</h4>
                    <p>Author: ${book.author}</p>
                    <p>ISBN: ${book.isbn}</p>
                    <p>Status: ${book.available ? '✅ Available' : '❌ Borrowed'}</p>
                    <div class="btn-group">
                        <button class="btn btn-warning" onclick="app.editBook(${book.id})">✏️ Edit</button>
                        <button class="btn btn-danger" onclick="app.deleteLibraryItem('books', ${book.id})">🗑️ Delete</button>
                    </div>
                </div>
            `;
        });
        
        // Study Materials
        studyMaterials.forEach(material => {
            html += `
                <div class="data-item">
                    <h4>📖 ${material.title}</h4>
                    <p>Subject: ${material.subject} | Class: ${material.class}</p>
                    <p>${material.description}</p>
                    <p>Uploaded: ${material.uploadDate}</p>
                    <div class="btn-group">
                        <button class="btn btn-primary" onclick="app.downloadMaterial(${material.id})">⬇️ Download</button>
                        <button class="btn btn-danger" onclick="app.deleteLibraryItem('materials', ${material.id})">🗑️ Delete</button>
                    </div>
                </div>
            `;
        });
        
        // Documents
        documents.forEach(doc => {
            html += `
                <div class="data-item">
                    <h4>📄 ${doc.title}</h4>
                    <p>Type: ${doc.type} | Access: ${doc.access}</p>
                    <p>${doc.description}</p>
                    <p>Uploaded: ${doc.uploadDate}</p>
                    <div class="btn-group">
                        <button class="btn btn-primary" onclick="app.downloadDocument(${doc.id})">⬇️ Download</button>
                        <button class="btn btn-danger" onclick="app.deleteLibraryItem('documents', ${doc.id})">🗑️ Delete</button>
                    </div>
                </div>
            `;
        });
        
        // Syllabi
        syllabi.forEach(syllabus => {
            html += `
                <div class="data-item">
                    <h4>📋 ${syllabus.title}</h4>
                    <p>Subject: ${syllabus.subject} | Class: Grade ${syllabus.class}</p>
                    <p>Year: ${syllabus.year} | Term: ${syllabus.term}</p>
                    <p>Uploaded: ${syllabus.uploadDate}</p>
                    <div class="btn-group">
                        <button class="btn btn-primary" onclick="app.downloadSyllabus(${syllabus.id})">⬇️ Download</button>
                        <button class="btn btn-danger" onclick="app.deleteLibraryItem('syllabi', ${syllabus.id})">🗑️ Delete</button>
                    </div>
                </div>
            `;
        });
        
        return html || '<p>No library items found. Start by adding books or uploading study materials.</p>';
    }

    saveStudyMaterial() {
        const subject = document.getElementById('material-subject').value;
        const className = document.getElementById('material-class').value;
        const title = document.getElementById('material-title').value;
        const description = document.getElementById('material-description').value;
        const files = document.getElementById('material-files').files;
        
        if (!title || !description) {
            this.showNotification('Please fill all required fields', 'error');
            return;
        }
        
        const studyMaterials = JSON.parse(localStorage.getItem('studyMaterials') || '[]');
        studyMaterials.push({
            id: Date.now(),
            subject,
            class: className,
            title,
            description,
            uploadDate: new Date().toISOString().split('T')[0],
            uploadedBy: this.currentUser.name,
            fileCount: files.length
        });
        
        localStorage.setItem('studyMaterials', JSON.stringify(studyMaterials));
        this.logAuditEvent('upload_study_material', `Study material "${title}" uploaded`);
        this.closeModal();
        this.loadSection('library', 'admin');
        this.showNotification('Study material uploaded successfully!', 'success');
    }

    saveDocument() {
        const type = document.getElementById('doc-type').value;
        const access = document.getElementById('doc-access').value;
        const title = document.getElementById('doc-title').value;
        const description = document.getElementById('doc-description').value;
        const file = document.getElementById('doc-file').files[0];
        
        if (!title || !description || !file) {
            this.showNotification('Please fill all required fields and select a file', 'error');
            return;
        }
        
        const documents = JSON.parse(localStorage.getItem('documents') || '[]');
        documents.push({
            id: Date.now(),
            type,
            access,
            title,
            description,
            uploadDate: new Date().toISOString().split('T')[0],
            uploadedBy: this.currentUser.name,
            fileName: file.name
        });
        
        localStorage.setItem('documents', JSON.stringify(documents));
        this.logAuditEvent('upload_document', `Document "${title}" uploaded`);
        this.closeModal();
        this.loadSection('library', 'admin');
        this.showNotification('Document uploaded successfully!', 'success');
    }

    saveSyllabus() {
        const subject = document.getElementById('syllabus-subject').value;
        const year = document.getElementById('syllabus-year').value;
        const className = document.getElementById('syllabus-class').value;
        const term = document.getElementById('syllabus-term').value;
        const title = document.getElementById('syllabus-title').value;
        const file = document.getElementById('syllabus-file').files[0];
        
        if (!title || !file) {
            this.showNotification('Please fill all required fields and select a file', 'error');
            return;
        }
        
        const syllabi = JSON.parse(localStorage.getItem('syllabi') || '[]');
        syllabi.push({
            id: Date.now(),
            subject,
            year,
            class: className,
            term,
            title,
            uploadDate: new Date().toISOString().split('T')[0],
            uploadedBy: this.currentUser.name,
            fileName: file.name
        });
        
        localStorage.setItem('syllabi', JSON.stringify(syllabi));
        this.logAuditEvent('upload_syllabus', `Syllabus "${title}" uploaded`);
        this.closeModal();
        this.loadSection('library', 'admin');
        this.showNotification('Syllabus uploaded successfully!', 'success');
    }

    // Complete Missing Functions
    downloadMaterial(id) {
        const materials = JSON.parse(localStorage.getItem('studyMaterials') || '[]');
        const material = materials.find(m => m.id === id);
        if (material) {
            this.simulateDownload(material.title, 'study-material');
            this.logAuditEvent('download_material', `Downloaded study material: ${material.title}`);
        }
    }

    downloadDocument(id) {
        const documents = JSON.parse(localStorage.getItem('documents') || '[]');
        const doc = documents.find(d => d.id === id);
        if (doc) {
            this.simulateDownload(doc.title, 'document');
            this.logAuditEvent('download_document', `Downloaded document: ${doc.title}`);
        }
    }

    downloadSyllabus(id) {
        const syllabi = JSON.parse(localStorage.getItem('syllabi') || '[]');
        const syllabus = syllabi.find(s => s.id === id);
        if (syllabus) {
            this.simulateDownload(syllabus.title, 'syllabus');
            this.logAuditEvent('download_syllabus', `Downloaded syllabus: ${syllabus.title}`);
        }
    }

    simulateDownload(filename, type) {
        const content = `This is a simulated ${type} file: ${filename}\n\nGenerated by Southern Cross School Management System\nDate: ${new Date().toLocaleString()}`;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
        link.click();
        URL.revokeObjectURL(url);
        this.showNotification(`${filename} downloaded successfully!`, 'success');
    }

    deleteLibraryItem(type, id) {
        this.showConfirmation(
            'Are you sure you want to delete this item?',
            () => {
                let items, storageKey;
                switch(type) {
                    case 'books':
                        this.data.library = this.data.library.filter(item => item.id !== id);
                        this.saveData();
                        break;
                    case 'materials':
                        items = JSON.parse(localStorage.getItem('studyMaterials') || '[]');
                        items = items.filter(item => item.id !== id);
                        localStorage.setItem('studyMaterials', JSON.stringify(items));
                        break;
                    case 'documents':
                        items = JSON.parse(localStorage.getItem('documents') || '[]');
                        items = items.filter(item => item.id !== id);
                        localStorage.setItem('documents', JSON.stringify(items));
                        break;
                    case 'syllabi':
                        items = JSON.parse(localStorage.getItem('syllabi') || '[]');
                        items = items.filter(item => item.id !== id);
                        localStorage.setItem('syllabi', JSON.stringify(items));
                        break;
                }
                this.logAuditEvent('delete_library_item', `Deleted ${type} item with ID ${id}`);
                this.loadSection('library', 'admin');
                this.showNotification('Item deleted successfully!', 'success');
            }
        );
    }

    editBook(id) {
        const book = this.data.library.find(b => b.id === id);
        if (!book) return;
        
        this.showModal('Edit Book', `
            <div class="form-row">
                <div class="form-group">
                    <label>Book Title</label>
                    <input type="text" id="edit-book-title" value="${book.title}">
                </div>
                <div class="form-group">
                    <label>Author</label>
                    <input type="text" id="edit-book-author" value="${book.author}">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>ISBN</label>
                    <input type="text" id="edit-book-isbn" value="${book.isbn}">
                </div>
                <div class="form-group">
                    <label>Category</label>
                    <select id="edit-book-category">
                        <option value="textbook" ${book.category === 'textbook' ? 'selected' : ''}>Textbook</option>
                        <option value="reference" ${book.category === 'reference' ? 'selected' : ''}>Reference</option>
                        <option value="fiction" ${book.category === 'fiction' ? 'selected' : ''}>Fiction</option>
                    </select>
                </div>
            </div>
            <div class="btn-group">
                <button class="btn btn-success" onclick="app.saveBookEdit(${id})">💾 Save Changes</button>
                <button class="btn btn-secondary" onclick="app.closeModal()">❌ Cancel</button>
            </div>
        `);
    }

    saveBookEdit(id) {
        const book = this.data.library.find(b => b.id === id);
        if (book) {
            book.title = document.getElementById('edit-book-title').value;
            book.author = document.getElementById('edit-book-author').value;
            book.isbn = document.getElementById('edit-book-isbn').value;
            book.category = document.getElementById('edit-book-category').value;
            
            this.saveData();
            this.logAuditEvent('edit_book', `Edited book: ${book.title}`);
            this.closeModal();
            this.loadSection('library', 'admin');
            this.showNotification('Book updated successfully!', 'success');
        }
    }

    editStudentInfo(id) {
        const student = this.data.students.find(s => s.id === id);
        if (!student) return;
        
        this.showModal(`Edit Student - ${student.name}`, `
            <div class="form-row">
                <div class="form-group">
                    <label>Full Name</label>
                    <input type="text" id="edit-student-name" value="${student.name}">
                </div>
                <div class="form-group">
                    <label>Class</label>
                    <select id="edit-student-class">
                        <option value="10A" ${student.class === '10A' ? 'selected' : ''}>10A</option>
                        <option value="10B" ${student.class === '10B' ? 'selected' : ''}>10B</option>
                        <option value="11A" ${student.class === '11A' ? 'selected' : ''}>11A</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="edit-student-email" value="${student.email || ''}">
                </div>
                <div class="form-group">
                    <label>Phone</label>
                    <input type="tel" id="edit-student-phone" value="${student.phone || ''}">
                </div>
            </div>
            <div class="form-group">
                <label>Address</label>
                <textarea id="edit-student-address">${student.address || ''}</textarea>
            </div>
            <div class="btn-group">
                <button class="btn btn-success" onclick="app.saveStudentEdit(${id})">💾 Save Changes</button>
                <button class="btn btn-secondary" onclick="app.closeModal()">❌ Cancel</button>
            </div>
        `);
    }

    saveStudentEdit(id) {
        const student = this.data.students.find(s => s.id === id);
        if (student) {
            student.name = document.getElementById('edit-student-name').value;
            student.class = document.getElementById('edit-student-class').value;
            student.email = document.getElementById('edit-student-email').value;
            student.phone = document.getElementById('edit-student-phone').value;
            student.address = document.getElementById('edit-student-address').value;
            
            this.saveData();
            this.logAuditEvent('edit_student', `Edited student: ${student.name}`);
            this.closeModal();
            this.showNotification('Student information updated successfully!', 'success');
        }
    }

    markAllPresent(className) {
        const students = this.data.students.filter(s => s.class === className);
        students.forEach(student => {
            this.markStudentAttendance(student.id, 'present');
        });
        this.showNotification(`All students in ${className} marked present!`, 'success');
    }

    markAllAbsent(className) {
        const students = this.data.students.filter(s => s.class === className);
        students.forEach(student => {
            this.markStudentAttendance(student.id, 'absent');
        });
        this.showNotification(`All students in ${className} marked absent!`, 'info');
    }

    saveAttendance(className) {
        const today = new Date().toISOString().split('T')[0];
        const attendanceRecord = {
            date: today,
            class: className,
            records: [],
            takenBy: this.currentUser.name
        };
        
        const students = this.data.students.filter(s => s.class === className);
        students.forEach(student => {
            const presentBtn = document.getElementById(`present-${student.id}`);
            const absentBtn = document.getElementById(`absent-${student.id}`);
            
            let status = 'not_marked';
            if (presentBtn && presentBtn.style.opacity === '1') status = 'present';
            if (absentBtn && absentBtn.style.opacity === '1') status = 'absent';
            
            attendanceRecord.records.push({
                studentId: student.id,
                studentName: student.name,
                status
            });
        });
        
        const attendanceHistory = JSON.parse(localStorage.getItem('attendanceHistory') || '[]');
        attendanceHistory.push(attendanceRecord);
        localStorage.setItem('attendanceHistory', JSON.stringify(attendanceHistory));
        
        this.logAuditEvent('save_attendance', `Attendance saved for class ${className}`);
        this.closeModal();
        this.showNotification('Attendance saved successfully!', 'success');
    }

    saveTimetable() {
        const times = ['9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM'];
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
        const timetable = {};
        
        times.forEach(time => {
            timetable[time] = {};
            days.forEach(day => {
                const inputId = `${day}-${time.replace(/[^a-zA-Z0-9]/g, '')}`;
                const input = document.getElementById(inputId);
                if (input) {
                    timetable[time][day] = input.value || '';
                }
            });
        });
        
        localStorage.setItem('teacherTimetable', JSON.stringify(timetable));
        this.logAuditEvent('save_timetable', 'Timetable updated');
        this.closeModal();
        this.loadSection('timetable', 'teacher');
        this.showNotification('Timetable saved successfully!', 'success');
    }

    exportTimetable() {
        const timetable = JSON.parse(localStorage.getItem('teacherTimetable') || '{}');
        const dataStr = JSON.stringify(timetable, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'timetable_export.json';
        link.click();
        URL.revokeObjectURL(url);
        this.showNotification('Timetable exported successfully!', 'success');
    }

    printTimetable() {
        const printWindow = window.open('', '_blank');
        const timetableHTML = this.renderTimetable();
        const content = `
            <html>
                <head>
                    <title>Southern Cross School - Teacher Timetable</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        .header { text-align: center; margin-bottom: 30px; }
                        .logo { font-size: 24px; font-weight: bold; color: #2563EB; }
                        table { width: 100%; border-collapse: collapse; }
                        th, td { border: 1px solid #ddd; padding: 10px; text-align: center; }
                        th { background-color: #f2f2f2; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="logo">SC Southern Cross School</div>
                        <h2>Teacher Timetable</h2>
                        <p>Generated on: ${new Date().toLocaleDateString()}</p>
                    </div>
                    ${timetableHTML}
                </body>
            </html>
        `;
        
        printWindow.document.write(content);
        printWindow.document.close();
        printWindow.print();
        this.showNotification('Timetable sent to printer!', 'success');
    }

    searchLibrary(query) {
        const items = document.querySelectorAll('#library-list .data-item');
        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(query.toLowerCase()) ? 'block' : 'none';
        });
    }

    // Professional Features
    initKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case 's':
                        e.preventDefault();
                        this.quickSave();
                        break;
                    case 'z':
                        e.preventDefault();
                        this.undo();
                        break;
                    case 'y':
                        e.preventDefault();
                        this.redo();
                        break;
                    case 'f':
                        e.preventDefault();
                        this.focusSearch();
                        break;
                }
            }
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });
        
        this.showKeyboardShortcuts();
    }

    showKeyboardShortcuts() {
        const shortcuts = document.createElement('div');
        shortcuts.className = 'keyboard-shortcut';
        shortcuts.innerHTML = 'Ctrl+S: Save | Ctrl+Z: Undo | Ctrl+F: Search | Esc: Close';
        document.body.appendChild(shortcuts);
        
        setTimeout(() => shortcuts.remove(), 5000);
    }

    quickSave() {
        this.saveData();
        this.showNotification('Data saved!', 'success');
    }

    undo() {
        if (this.undoStack.length > 0) {
            const lastState = this.undoStack.pop();
            this.redoStack.push(JSON.stringify(this.data));
            this.data = JSON.parse(lastState);
            this.saveData();
            this.showNotification('Action undone!', 'info');
        }
    }

    redo() {
        if (this.redoStack.length > 0) {
            const nextState = this.redoStack.pop();
            this.undoStack.push(JSON.stringify(this.data));
            this.data = JSON.parse(nextState);
            this.saveData();
            this.showNotification('Action redone!', 'info');
        }
    }

    focusSearch() {
        const searchBox = document.querySelector('.search-box');
        if (searchBox) searchBox.focus();
    }

    initDragDrop() {
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
            const dropArea = e.target.closest('.drag-drop-area');
            if (dropArea) dropArea.classList.add('dragover');
        });
        
        document.addEventListener('dragleave', (e) => {
            const dropArea = e.target.closest('.drag-drop-area');
            if (dropArea) dropArea.classList.remove('dragover');
        });
        
        document.addEventListener('drop', (e) => {
            e.preventDefault();
            const dropArea = e.target.closest('.drag-drop-area');
            if (dropArea) {
                dropArea.classList.remove('dragover');
                this.handleFileDrop(e.dataTransfer.files);
            }
        });
    }

    handleFileDrop(files) {
        Array.from(files).forEach(file => {
            if (this.validateFile(file)) {
                this.showNotification(`File ${file.name} ready for upload!`, 'success');
            } else {
                this.showNotification(`File ${file.name} is not supported!`, 'error');
            }
        });
    }

    validateFile(file) {
        const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        const maxSize = 10 * 1024 * 1024; // 10MB
        
        if (!allowedTypes.includes(file.type)) return false;
        if (file.size > maxSize) {
            this.showNotification('File size must be less than 10MB!', 'error');
            return false;
        }
        return true;
    }

    initNotificationCenter() {
        const center = document.createElement('div');
        center.className = 'notification-center';
        center.id = 'notification-center';
        document.body.appendChild(center);
        
        this.startLiveNotifications();
    }

    startLiveNotifications() {
        setInterval(() => {
            if (Math.random() < 0.1) { // 10% chance every 30 seconds
                this.showLiveNotification('System Update', 'New features available!');
            }
        }, 30000);
    }

    showLiveNotification(title, message) {
        const center = document.getElementById('notification-center');
        if (!center) return;
        
        const notification = document.createElement('div');
        notification.className = 'live-notification';
        notification.innerHTML = `
            <strong>${title}</strong><br>
            <small>${message}</small>
        `;
        
        center.appendChild(notification);
        
        setTimeout(() => notification.remove(), 5000);
    }

    initMobileSupport() {
        this.isMobile = window.innerWidth <= 768;
        this.sidebarVisible = !this.isMobile;
        
        this.updateResponsiveLayout();
        
        window.addEventListener('resize', () => {
            this.isMobile = window.innerWidth <= 768;
            this.updateResponsiveLayout();
        });
    }

    updateResponsiveLayout() {
        document.body.classList.toggle('mobile-mode', this.isMobile);
        
        if (this.isMobile) {
            this.createMobileHeader();
            this.sidebarVisible = false;
        } else {
            this.removeMobileHeader();
            this.sidebarVisible = true;
        }
        
        this.updateSidebarVisibility();
    }

    createMobileHeader() {
        let mobileHeader = document.querySelector('.mobile-header');
        if (!mobileHeader) {
            mobileHeader = document.createElement('div');
            mobileHeader.className = 'mobile-header';
            mobileHeader.innerHTML = `
                <button class="menu-toggle" onclick="app.toggleSidebar()">
                    <span class="hamburger"></span>
                    <span class="hamburger"></span>
                    <span class="hamburger"></span>
                </button>
                <div class="mobile-title">
                    <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='45' fill='%232563EB'/%3E%3Ctext x='50' y='60' text-anchor='middle' fill='white' font-size='40' font-weight='bold'%3ESC%3C/text%3E%3C/svg%3E" alt="SC" style="width: 30px; height: 30px; margin-right: 10px;">
                    School Hub
                </div>
            `;
            document.body.insertBefore(mobileHeader, document.body.firstChild);
        }
    }

    removeMobileHeader() {
        const mobileHeader = document.querySelector('.mobile-header');
        if (mobileHeader) mobileHeader.remove();
    }

    toggleSidebar() {
        this.sidebarVisible = !this.sidebarVisible;
        this.updateSidebarVisibility();
    }

    updateSidebarVisibility() {
        const sidebar = document.querySelector('.sidebar');
        const main = document.querySelector('.main');
        const overlay = document.querySelector('.sidebar-overlay');
        
        if (sidebar) {
            if (this.sidebarVisible) {
                sidebar.classList.add('visible');
                if (this.isMobile) {
                    this.createSidebarOverlay();
                }
            } else {
                sidebar.classList.remove('visible');
                if (overlay) overlay.remove();
            }
        }
        
        if (main && !this.isMobile) {
            if (this.sidebarVisible) {
                main.classList.remove('sidebar-collapsed');
                main.style.marginLeft = '320px';
            } else {
                main.classList.add('sidebar-collapsed');
                main.style.marginLeft = '0';
            }
        }
    }

    createSidebarOverlay() {
        let overlay = document.querySelector('.sidebar-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay';
            overlay.onclick = () => this.toggleSidebar();
            document.body.appendChild(overlay);
        }
    }

    // Advanced Features
    sendEmailNotification(to, subject, message) {
        // Simulate email sending
        this.logAuditEvent('email_sent', `Email sent to ${to}: ${subject}`);
        this.showNotification(`Email sent to ${to}!`, 'success');
    }

    backupData() {
        const backup = {
            timestamp: new Date().toISOString(),
            data: this.data,
            users: JSON.parse(localStorage.getItem('registeredUsers') || '[]'),
            audit: JSON.parse(localStorage.getItem('auditLog') || '[]')
        };
        
        const dataStr = JSON.stringify(backup, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `schoolhub_backup_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
        
        this.logAuditEvent('backup_created', 'System backup created');
        this.showNotification('Backup created successfully!', 'success');
    }

    restoreData(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const backup = JSON.parse(e.target.result);
                this.data = backup.data;
                localStorage.setItem('registeredUsers', JSON.stringify(backup.users));
                localStorage.setItem('auditLog', JSON.stringify(backup.audit));
                this.saveData();
                this.logAuditEvent('restore_completed', 'System restored from backup');
                this.showNotification('Data restored successfully!', 'success');
                location.reload();
            } catch (error) {
                this.showNotification('Invalid backup file!', 'error');
            }
        };
        reader.readAsText(file);
    }

    generateAdvancedReport(type) {
        const reportData = this.getReportData(type);
        const chartHTML = this.generateChart(reportData);
        
        this.showModal(`Advanced ${type} Report`, `
            <div style="height: 400px; overflow-y: auto;">
                ${chartHTML}
                <div style="margin-top: 20px;">
                    <h4>Summary Statistics</h4>
                    ${this.generateSummaryStats(reportData)}
                </div>
            </div>
            <div class="btn-group">
                <button class="btn btn-primary" onclick="app.exportReport('${type}')">📊 Export Report</button>
                <button class="btn btn-secondary" onclick="app.closeModal()">Close</button>
            </div>
        `);
    }

    getReportData(type) {
        switch(type) {
            case 'attendance':
                return this.data.students.map(s => ({name: s.name, value: s.attendance}));
            case 'grades':
                return this.data.students.map(s => ({name: s.name, value: parseFloat(s.gpa)}));
            default:
                return [];
        }
    }

    generateChart(data) {
        // Simple ASCII chart for demonstration
        let chart = '<div style="font-family: monospace; background: #f8f9fa; padding: 20px; border-radius: 8px;">';
        data.forEach(item => {
            const barLength = Math.round(item.value / 5);
            chart += `${item.name.padEnd(15)} |${'█'.repeat(barLength)} ${item.value}%<br>`;
        });
        chart += '</div>';
        return chart;
    }

    generateSummaryStats(data) {
        const values = data.map(d => d.value);
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const max = Math.max(...values);
        const min = Math.min(...values);
        
        return `
            <p><strong>Average:</strong> ${avg.toFixed(2)}%</p>
            <p><strong>Highest:</strong> ${max}%</p>
            <p><strong>Lowest:</strong> ${min}%</p>
            <p><strong>Total Records:</strong> ${values.length}</p>
        `;
    }
}

const app = new SchoolHub();