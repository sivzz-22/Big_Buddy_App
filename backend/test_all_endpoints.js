const BASE_URL = 'http://localhost:5050/api';

async function req(url, options = {}) {
    const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        ...options,
        body: options.body ? JSON.stringify(options.body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const error = new Error(data.message || `HTTP ${res.status}`);
        error.status = res.status;
        error.data = data;
        throw error;
    }
    return data;
}

async function runTests() {
    console.log("==================================================");
    console.log("       BIGBUDDY FULL ENDPOINTS TEST SUITE         ");
    console.log("==================================================");
    let passed = 0;
    let failed = 0;

    const test = async (name, fn) => {
        try {
            await fn();
            console.log(`[PASS] ${name}`);
            passed++;
        } catch (err) {
            console.error(`[FAIL] ${name}:`, err.data?.message || err.message);
            failed++;
        }
    };

    // 1. Root API Health
    await test("API Health Check: GET /", async () => {
        const res = await fetch('http://localhost:5050/');
        const text = await res.text();
        if (!text.includes("Gym Management API is working")) throw new Error("Unexpected health response");
    });

    // 2. Admin Login
    let adminToken = "";
    await test("Admin Login: POST /api/auth/login", async () => {
        const data = await req(`${BASE_URL}/auth/login`, {
            method: 'POST',
            body: { email: "admin@bigbuddy.com", password: "admin123" }
        });
        if (!data.token || data.role !== 'admin') throw new Error("Admin login failed");
        adminToken = data.token;
    });

    // 3. Admin Signup
    await test("Admin Signup: POST /api/auth/signup", async () => {
        const testEmail = `testowner_${Date.now()}@bigbuddy.com`;
        const data = await req(`${BASE_URL}/auth/signup`, {
            method: 'POST',
            body: { name: "Test Owner", email: testEmail, password: "password123" }
        });
        if (!data._id) throw new Error("Admin signup failed");
    });

    // 4. Gym Profile Get & Update
    let gymAttendanceCode = "";
    await test("Gym Profile: GET /api/gym and PUT /api/gym", async () => {
        const getData = await req(`${BASE_URL}/gym`);
        if (!getData.attendanceCode) throw new Error("Gym attendanceCode missing");
        gymAttendanceCode = getData.attendanceCode;

        const updateData = await req(`${BASE_URL}/gym`, {
            method: 'PUT',
            body: { name: "BigBuddy Elite Fitness" }
        });
        if (updateData.name !== "BigBuddy Elite Fitness") throw new Error("Gym update failed");
    });

    // 5. Membership Plans
    let planId = "";
    await test("Membership Plans: POST, GET, PUT /api/membership-plans", async () => {
        const createData = await req(`${BASE_URL}/membership-plans`, {
            method: 'POST',
            body: { name: "Gold 1 Year", price: 9999, duration: "1 Year", description: "Full gym and cardio access" }
        });
        planId = createData._id;
        if (!planId) throw new Error("Failed to create plan");

        const getData = await req(`${BASE_URL}/membership-plans`);
        if (!Array.isArray(getData) || getData.length === 0) throw new Error("Failed to fetch plans");

        const putData = await req(`${BASE_URL}/membership-plans/${planId}`, {
            method: 'PUT',
            body: { price: 8999 }
        });
        if (putData.price !== 8999) throw new Error("Failed to update plan");
    });

    // 6. Workout Plans
    let workoutPlanId = "";
    await test("Workout Plans: POST, GET /api/workout-plans", async () => {
        const createData = await req(`${BASE_URL}/workout-plans`, {
            method: 'POST',
            body: { title: "Chest & Triceps", level: "Intermediate", duration: "60 mins", exercises: [{ name: "Bench Press", sets: "4", reps: "10" }] }
        });
        workoutPlanId = createData._id;

        const getData = await req(`${BASE_URL}/workout-plans`);
        if (!Array.isArray(getData) || getData.length === 0) throw new Error("Workout plans fetch failed");
    });

    // 7. Diet Plans
    let dietPlanId = "";
    await test("Diet Plans: POST, GET /api/diet-plans", async () => {
        const createData = await req(`${BASE_URL}/diet-plans`, {
            method: 'POST',
            body: { name: "High Protein Muscle Gain", meals: 5, cals: 2600, mealSchedule: [{ mealTime: "Morning", items: "Oats, 4 Eggs, Banana" }] }
        });
        dietPlanId = createData._id;

        const getData = await req(`${BASE_URL}/diet-plans`);
        if (!Array.isArray(getData) || getData.length === 0) throw new Error("Diet plans fetch failed");
    });

    // 8. Member Creation (with only mandatory fields)
    const testMemberID = `MB${Math.floor(1000 + Math.random() * 9000)}`;
    const testPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    let createdMemberDbId = "";
    await test("Add Member: POST /api/members (Mandatory Fields Only)", async () => {
        const data = await req(`${BASE_URL}/members`, {
            method: 'POST',
            body: {
                name: "Rahul Sharma",
                memberID: testMemberID,
                phone: testPhone,
                password: "memberpassword123",
                subscriptionType: "1 Month"
            }
        });
        if (!data._id) throw new Error("Member creation failed");
        createdMemberDbId = data._id;
        if (data.isProfileComplete !== false) throw new Error("isProfileComplete should be false initially");
    });

    // 9. Monthly Member Count Check
    await test("Member Monthly Count: GET /api/members/count/monthly", async () => {
        const data = await req(`${BASE_URL}/members/count/monthly`);
        if (typeof data.count !== 'number' || data.count < 1) throw new Error("Monthly count failed");
    });

    // 10. Member Login by Member ID
    await test("Member Login (by Member ID): POST /api/auth/login", async () => {
        const data = await req(`${BASE_URL}/auth/login`, {
            method: 'POST',
            body: { email: testMemberID, password: "memberpassword123" }
        });
        if (data.role !== 'member' || !data.token) throw new Error("Login with MemberID failed");
    });

    // 11. Member Login by Phone
    await test("Member Login (by Phone): POST /api/auth/login", async () => {
        const data = await req(`${BASE_URL}/auth/login`, {
            method: 'POST',
            body: { email: testPhone, password: "memberpassword123" }
        });
        if (data.role !== 'member' || !data.token) throw new Error("Login with Phone failed");
    });

    // 12. User Profile Completion (User fills optional fields)
    await test("Member Complete Profile: PUT /api/members/:id", async () => {
        const data = await req(`${BASE_URL}/members/${createdMemberDbId}`, {
            method: 'PUT',
            body: {
                email: `rahul_${Date.now()}@gmail.com`,
                dob: "1998-05-15",
                gender: "Male",
                bloodGroup: "O+",
                address: "42 Park Avenue, Apartment 3B"
            }
        });
        if (data.isProfileComplete !== true) throw new Error("isProfileComplete should be true after filling details");
    });

    // 13. Attendance Marking with Access Code
    await test("Attendance Check-In: POST /api/attendance", async () => {
        const data = await req(`${BASE_URL}/attendance`, {
            method: 'POST',
            body: {
                memberId: createdMemberDbId,
                session: "Morning",
                accessCode: gymAttendanceCode
            }
        });
        if (!data._id) throw new Error("Attendance mark failed");
    });

    // 14. Attendance Summary & Trend
    await test("Attendance Summary & Trend: GET /api/attendance/summary & /trend", async () => {
        const todayStr = new Date().toISOString().split('T')[0];
        const summaryData = await req(`${BASE_URL}/attendance/summary?date=${todayStr}`);
        if (summaryData.present < 1) throw new Error("Attendance summary count mismatch");

        const trendData = await req(`${BASE_URL}/attendance/trend`);
        if (!Array.isArray(trendData) || trendData.length === 0) throw new Error("Trend fetch failed");
    });

    // 15. Daily Logs (Workouts & Metrics)
    await test("Daily Logs: POST & GET /api/daily-logs", async () => {
        const todayStr = new Date().toISOString().split('T')[0];
        const postData = await req(`${BASE_URL}/daily-logs`, {
            method: 'POST',
            body: {
                memberId: createdMemberDbId,
                date: todayStr,
                workoutLogs: [{ exercise: "Squats", sets: "4", reps: "12", weight: "80kg" }],
                dietLogs: [{ mealTime: "Morning", mealName: "Oats", isCompleted: true }],
                metrics: { weight: 75.5, waterIntake: 3.0, steps: 8500, mood: "Great" }
            }
        });
        if (!postData._id) throw new Error("Daily log save failed");

        const getData = await req(`${BASE_URL}/daily-logs?memberId=${createdMemberDbId}&date=${todayStr}`);
        if (getData.metrics?.weight !== 75.5) throw new Error("Daily log retrieval mismatch");

        const histData = await req(`${BASE_URL}/daily-logs/history/${createdMemberDbId}`);
        if (!Array.isArray(histData) || histData.length === 0) throw new Error("History fetch failed");
    });

    // 16. Transactions (Add & Summary)
    await test("Transactions: POST & GET /api/transactions", async () => {
        const createData = await req(`${BASE_URL}/transactions`, {
            method: 'POST',
            body: {
                memberId: createdMemberDbId,
                memberName: "Rahul Sharma",
                memberID: testMemberID,
                amount: 1500,
                paymentMode: "UPI",
                type: "New Admission",
                subscriptionType: "1 Month"
            }
        });
        if (!createData._id) throw new Error("Transaction create failed");

        const sumData = await req(`${BASE_URL}/transactions/summary`);
        if (sumData.totalRevenue < 1500) throw new Error("Transaction summary mismatch");
    });

    // 17. Messages & Inbox Auto-delete TTL
    let msgId = "";
    await test("Messages: POST, Inbox, Read, Unread-count /api/messages", async () => {
        const sendData = await req(`${BASE_URL}/messages`, {
            method: 'POST',
            body: {
                memberName: "Rahul Sharma",
                memberId: createdMemberDbId,
                message: "Welcome to BigBuddy Gym!",
                channel: "App",
                type: "general"
            }
        });
        msgId = sendData._id;
        if (!msgId) throw new Error("Send message failed");

        const unreadData = await req(`${BASE_URL}/messages/unread-count/${createdMemberDbId}`);
        if (unreadData.count < 1) throw new Error("Unread count should be at least 1");

        const inboxData = await req(`${BASE_URL}/messages/inbox/${createdMemberDbId}`);
        if (!Array.isArray(inboxData) || inboxData.length === 0) throw new Error("Inbox fetch failed");

        const readAllData = await req(`${BASE_URL}/messages/read-all/${createdMemberDbId}`, {
            method: 'PUT'
        });
        if (!readAllData.message) throw new Error("Read all failed");
    });

    // 18. Dashboard Overview Stats
    await test("Admin Dashboard Stats: GET /api/dashboard/stats", async () => {
        const todayStr = new Date().toISOString().split('T')[0];
        const data = await req(`${BASE_URL}/dashboard/stats?date=${todayStr}`);
        if (data.totalMembers === undefined || data.activeMembers === undefined) {
            throw new Error("Dashboard stats missing fields");
        }
    });

    console.log("==================================================");
    console.log(`TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
    console.log("==================================================");
    process.exit(failed > 0 ? 1 : 0);
}

runTests();
