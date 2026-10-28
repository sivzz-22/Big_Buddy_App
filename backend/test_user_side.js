const BASE_URL = 'http://localhost:5050/api';

async function testUserSideFlows() {
    console.log('========================================================');
    console.log('STARTING USER-SIDE END-TO-END VERIFICATION SUITE');
    console.log('========================================================\n');

    let passed = 0;
    let failed = 0;

    const assert = (condition, testName, detail = '') => {
        if (condition) {
            console.log(`[PASS] ${testName}`);
            passed++;
        } else {
            console.error(`[FAIL] ${testName} - ${detail}`);
            failed++;
        }
    };

    try {
        // 1. Test Login by Member ID
        let loginRes1;
        try {
            const res = await fetch(`${BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'MB101', password: 'alex123' })
            });
            loginRes1 = await res.json();
            assert(loginRes1.token && loginRes1.role === 'member', '1. User login via MemberID (MB101)');
        } catch (e) {
            assert(false, '1. User login via MemberID (MB101)', e.message);
        }

        const memberToken = loginRes1?.token;
        const memberMongoId = loginRes1?._id;
        const memberCode = loginRes1?.memberId;
        console.log(`       Member Code: ${memberCode} | Mongo ID: ${memberMongoId}`);

        // 2. Test Login by Phone Number
        try {
            const res = await fetch(`${BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: '9876543210', password: 'alex123' })
            });
            const data = await res.json();
            assert(data.token && data.name === 'Alex Johnson', '2. User login via Phone Number (9876543210)');
        } catch (e) {
            assert(false, '2. User login via Phone Number', e.message);
        }

        // 3. Test Login by Email
        try {
            const res = await fetch(`${BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'alex.johnson@gmail.com', password: 'alex123' })
            });
            const data = await res.json();
            assert(data.token && data.isProfileComplete === true, '3. User login via Email (alex.johnson@gmail.com)');
        } catch (e) {
            assert(false, '3. User login via Email', e.message);
        }

        // 4. Test Incomplete Profile User Login (MB102)
        try {
            const res = await fetch(`${BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'MB102', password: 'sarah123' })
            });
            const data = await res.json();
            assert(data.token && data.isProfileComplete === false, '4. Incomplete user login flags isProfileComplete: false (MB102)');
        } catch (e) {
            assert(false, '4. Incomplete user login flags isProfileComplete: false', e.message);
        }

        // 5. Fetch Member Details
        try {
            const res = await fetch(`${BASE_URL}/members/${memberMongoId}`, {
                headers: { 'Authorization': `Bearer ${memberToken}` }
            });
            const memberDetails = await res.json();
            assert(memberDetails.memberID === 'MB101' && memberDetails.workoutPlan === 'Push Pull Legs', '5. Fetch member profile details (/api/members/:id)');
        } catch (e) {
            assert(false, '5. Fetch member profile details', e.message);
        }

        // 6. Fetch Gym Details & Attendance Code
        let gymAttendanceCode;
        try {
            const res = await fetch(`${BASE_URL}/gym`);
            const gym = await res.json();
            gymAttendanceCode = gym?.attendanceCode;
            assert(Boolean(gymAttendanceCode), `6. Fetch gym attendance code (${gymAttendanceCode})`);
        } catch (e) {
            assert(false, '6. Fetch gym attendance code', e.message);
        }

        // 7. Test Attendance Code Validation
        try {
            // Test invalid code first
            const invalidRes = await fetch(`${BASE_URL}/attendance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    memberId: memberMongoId,
                    session: 'Evening',
                    accessCode: '999999'
                })
            });
            const invalidData = await invalidRes.json();
            const rejected = invalidRes.status === 403;

            assert(rejected, '7. Attendance endpoint rejects incorrect access code');
        } catch (e) {
            assert(false, '7. Attendance code rejection', e.message);
        }

        // 8. Fetch Member Attendance History & Days Present
        try {
            const res = await fetch(`${BASE_URL}/attendance?memberId=${memberMongoId}`, {
                headers: { 'Authorization': `Bearer ${memberToken}` }
            });
            const attendanceList = await res.json();
            assert(Array.isArray(attendanceList) && attendanceList.length >= 7, `8. Fetch member attendance history (found ${attendanceList?.length} records)`);
        } catch (e) {
            assert(false, '8. Fetch member attendance history', e.message);
        }

        // 9. Fetch Daily Logs (Last 7 Days Progress Charts)
        try {
            const res = await fetch(`${BASE_URL}/daily-logs/history/${memberMongoId}`);
            const logs = await res.json();
            assert(Array.isArray(logs) && logs.length >= 7, `9. Fetch member daily logs for progress charts (found ${logs?.length} logs)`);
        } catch (e) {
            assert(false, '9. Fetch member daily logs', e.message);
        }

        // 10. Update Today's Metrics Log
        try {
            const todayStr = new Date().toISOString().split('T')[0];
            const res = await fetch(`${BASE_URL}/daily-logs/metrics/${memberMongoId}/${todayStr}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    metrics: {
                        calories: 2450,
                        waterIntake: 4.0,
                        mood: 'Great',
                        weight: 75.5,
                        steps: 10000
                    }
                })
            });
            const data = await res.json();
            assert(data?.metrics?.waterIntake === 4.0, '10. Log today metrics (/api/daily-logs/metrics/:memberId/:date)');
        } catch (e) {
            assert(false, '10. Log today metrics', e.message);
        }

        // 11. Fetch Workout Plan for Workout Tab
        try {
            const res = await fetch(`${BASE_URL}/workout-plans`);
            const workouts = await res.json();
            const plan = workouts.find(p => p.title === 'Push Pull Legs');
            assert(plan && plan.exercises.length > 0, `11. Fetch assigned workout plan exercises (${plan?.exercises?.length} exercises)`);
        } catch (e) {
            assert(false, '11. Fetch assigned workout plan', e.message);
        }

        // 12. Fetch Diet Plan for Diet Tab
        try {
            const res = await fetch(`${BASE_URL}/diet-plans`);
            const diets = await res.json();
            const diet = diets.find(d => d.name === 'High Protein Muscle Gain');
            assert(diet && diet.mealSchedule.length > 0, `12. Fetch assigned diet plan meals (${diet?.mealSchedule?.length} meals)`);
        } catch (e) {
            assert(false, '12. Fetch assigned diet plan', e.message);
        }

        // 13. Fetch Member Inbox Unread Count
        let unreadCount = 0;
        try {
            const res = await fetch(`${BASE_URL}/messages/unread-count/${memberMongoId}`);
            const data = await res.json();
            unreadCount = data.count;
            assert(unreadCount > 0, `13. Fetch member inbox unread count (unread: ${unreadCount})`);
        } catch (e) {
            assert(false, '13. Fetch member inbox unread count', e.message);
        }

        // 14. Fetch Member In-App Inbox Messages List
        let firstMsgId;
        try {
            const res = await fetch(`${BASE_URL}/messages/inbox/${memberMongoId}`);
            const messages = await res.json();
            firstMsgId = messages[0]?._id;
            assert(Array.isArray(messages) && messages.length >= 4, `14. Fetch in-app inbox messages list (found ${messages?.length} messages)`);
        } catch (e) {
            assert(false, '14. Fetch in-app inbox messages list', e.message);
        }

        // 15. Mark an Inbox Message as Read
        if (firstMsgId) {
            try {
                const res = await fetch(`${BASE_URL}/messages/read/${firstMsgId}`, {
                    method: 'PUT'
                });
                const data = await res.json();
                assert(data?.isRead === true, '15. Mark inbox message as read (/api/messages/read/:id)');
            } catch (e) {
                assert(false, '15. Mark inbox message as read', e.message);
            }
        }

        // 16. Update Member Profile in Profile Tab
        try {
            const res = await fetch(`${BASE_URL}/members/${memberMongoId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${memberToken}`
                },
                body: JSON.stringify({
                    height: '179',
                    weight: '76',
                    address: '42 Fitness Boulevard, Downtown Block A, Suite 3'
                })
            });
            const data = await res.json();
            assert(data?.member?.height === '179' || data?.height === '179', '16. Update user profile fields (/api/members/:id)');
        } catch (e) {
            assert(false, '16. Update user profile fields', e.message);
        }

    } catch (criticalErr) {
        console.error('Critical test error:', criticalErr);
    }

    console.log('\n========================================================');
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================\n');

    process.exit(failed > 0 ? 1 : 0);
}

testUserSideFlows();
