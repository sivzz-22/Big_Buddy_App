import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import Member from './models/Member.js';
import WorkoutPlan from './models/WorkoutPlan.js';
import DietPlan from './models/DietPlan.js';
import Attendance from './models/Attendance.js';
import DailyLog from './models/DailyLog.js';
import MessageLog from './models/MessageLog.js';
import Gym from './models/Gym.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/Big_Buddy';

async function seedUserSide() {
    try {
        console.log('Connecting to MongoDB Atlas (Big_Buddy)...');
        await mongoose.connect(MONGO_URI, { dbName: 'Big_Buddy' });
        console.log('Connected successfully!');

        // 1. Ensure Gym attendance code exists
        let gym = await Gym.findOne();
        if (!gym) {
            gym = await Gym.create({
                name: 'BigBuddy Fitness Club',
                address: '100 Fitness Boulevard, Downtown',
                location: 'Main Branch',
                gmail: 'admin@bigbuddy.com',
                contact: '+91 98765 43210',
                attendanceCode: '1234',
                softwareUsageFee: 499,
                subscriptionPlan: 'Enterprise Pro',
                status: 'Active'
            });
            console.log('Created gym with attendance code:', gym.attendanceCode);
        } else {
            if (!gym.attendanceCode) {
                gym.attendanceCode = '1234';
                await gym.save();
            }
            console.log('Existing gym found. Attendance Code is:', gym.attendanceCode);
        }

        // 2. Clean & Create Workout Plan: "Push Pull Legs"
        await WorkoutPlan.deleteMany({ title: 'Push Pull Legs' });
        const workout = await WorkoutPlan.create({
            title: 'Push Pull Legs',
            level: 'Intermediate',
            duration: '60 Mins',
            exercises: [
                { name: 'Barbell Bench Press', sets: '4', reps: '10', kg: '60' },
                { name: 'Incline Dumbbell Press', sets: '3', reps: '12', kg: '22' },
                { name: 'Overhead Shoulder Press', sets: '3', reps: '10', kg: '40' },
                { name: 'Triceps Rope Pushdown', sets: '4', reps: '15', kg: '25' },
                { name: 'Lateral Dumbbell Raises', sets: '4', reps: '15', kg: '10' },
            ],
            routine: 'Push Day: Chest, Shoulders, Triceps'
        });
        console.log('Created clean Workout Plan: Push Pull Legs');

        // 3. Clean & Create Diet Plan: "High Protein Muscle Gain"
        await DietPlan.deleteMany({ name: 'High Protein Muscle Gain' });
        const diet = await DietPlan.create({
            name: 'High Protein Muscle Gain',
            meals: '4',
            cals: '2400 kcal',
            mealSchedule: [
                { mealTime: 'Morning', items: '4 Boiled Eggs, Oatmeal with Banana & Almonds, 1 Scoop Whey Protein' },
                { mealTime: 'Noon', items: '150g Grilled Chicken Breast, 1.5 Cups Brown Rice, Steamed Broccoli' },
                { mealTime: 'Evening', items: 'Greek Yogurt, Apple with Peanut Butter, Handful of Walnuts' },
                { mealTime: 'Night', items: '200g Paneer or Fish Fillet, Quinoa Garden Salad, Warm Almond Milk' },
            ],
            plan: 'Clean High-Protein Bulking Plan'
        });
        console.log('Created clean Diet Plan: High Protein Muscle Gain');

        // 4. Create Active Member (MB101 - Alex Johnson) with 100% COMPLETE profile
        const hashedAlexPassword = await bcrypt.hash('alex123', 10);
        const sixtyDaysFromNow = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

        let memberAlex = await Member.findOne({ memberID: 'MB101' });
        if (!memberAlex) {
            memberAlex = await Member.create({
                name: 'Alex Johnson',
                memberID: 'MB101',
                password: hashedAlexPassword,
                visiblePassword: 'alex123',
                phone: '9876543210',
                email: 'alex.johnson@gmail.com',
                dob: '1998-05-20',
                gender: 'Male',
                bloodGroup: 'O+',
                address: '42 Fitness Boulevard, Downtown Block A',
                isProfileComplete: true,
                height: '178',
                weight: '75',
                waistSize: '32',
                description: 'Goal: Lean muscle gain and strength improvement',
                role: 'member',
                subscriptionType: '3 Months',
                workoutPlan: 'Push Pull Legs',
                dietPlan: 'High Protein Muscle Gain',
                discount: 0,
                paymentMode: 'UPI',
                amountPaid: 4500,
                balance: 0,
                isPaymentCompleted: true,
                status: 'Active',
                expiryDate: sixtyDaysFromNow,
                joinDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            });
            console.log('Created Member MB101 (Alex Johnson - Complete Profile)');
        } else {
            // Update to ensure isProfileComplete and plans are linked
            memberAlex.password = hashedAlexPassword;
            memberAlex.visiblePassword = 'alex123';
            memberAlex.isProfileComplete = true;
            memberAlex.workoutPlan = 'Push Pull Legs';
            memberAlex.dietPlan = 'High Protein Muscle Gain';
            memberAlex.expiryDate = sixtyDaysFromNow;
            memberAlex.status = 'Active';
            await memberAlex.save();
            console.log('Updated Member MB101 (Alex Johnson)');
        }

        // 5. Create Member MB102 (Sarah Miller) with INCOMPLETE profile (to test restriction banner)
        const hashedSarahPassword = await bcrypt.hash('sarah123', 10);
        let memberSarah = await Member.findOne({ memberID: 'MB102' });
        if (!memberSarah) {
            memberSarah = await Member.create({
                name: 'Sarah Miller',
                memberID: 'MB102',
                password: hashedSarahPassword,
                visiblePassword: 'sarah123',
                phone: '9876543211',
                isProfileComplete: false,
                role: 'member',
                subscriptionType: '1 Month',
                status: 'Active',
                expiryDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
                amountPaid: 1500,
                balance: 0,
                isPaymentCompleted: true
            });
            console.log('Created Member MB102 (Sarah Miller - Incomplete Profile)');
        }

        // 6. Create Trainer TR201 (Coach Mike)
        const hashedMikePassword = await bcrypt.hash('mike123', 10);
        let trainerMike = await Member.findOne({ memberID: 'TR201' });
        if (!trainerMike) {
            trainerMike = await Member.create({
                name: 'Coach Mike',
                memberID: 'TR201',
                password: hashedMikePassword,
                visiblePassword: 'mike123',
                phone: '9876543212',
                email: 'coach.mike@bigbuddy.com',
                dob: '1992-08-14',
                gender: 'Male',
                bloodGroup: 'B+',
                address: '10 Trainer Avenue, City Center',
                isProfileComplete: true,
                role: 'trainer',
                workTime: 'Both',
                status: 'Active',
                expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
            });
            console.log('Created Trainer TR201 (Coach Mike)');
        }

        // 7. Seed 7 Days of Attendance for Member Alex (MB101)
        console.log('Seeding last 7 days of attendance for MB101...');
        const pad = (n) => String(n).padStart(2, '0');
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

            const existingAtt = await Attendance.findOne({
                memberId: memberAlex._id,
                date: dateStr,
                session: 'Morning'
            });

            if (!existingAtt) {
                await Attendance.create({
                    memberId: memberAlex._id,
                    memberName: memberAlex.name,
                    date: dateStr,
                    time: '07:15 AM',
                    session: 'Morning',
                    status: 'Present'
                });
            }
        }
        console.log('Attendance seeded: 7 consecutive days present!');

        // 8. Seed 7 Days of DailyLogs (Workouts, Diets, Metrics) for MB101
        console.log('Seeding last 7 days of daily logs (charts & metrics) for MB101...');
        const baseWeight = 74.5;
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

            const existingLog = await DailyLog.findOne({
                memberId: memberAlex._id,
                date: dateStr
            });

            if (!existingLog) {
                await DailyLog.create({
                    memberId: memberAlex._id,
                    date: dateStr,
                    workoutLogs: [
                        { exercise: 'Barbell Bench Press', sets: '4', reps: '10', weight: '60kg', time: '07:30 AM' },
                        { exercise: 'Incline Dumbbell Press', sets: '3', reps: '12', weight: '22kg', time: '07:45 AM' },
                        { exercise: 'Triceps Rope Pushdown', sets: '4', reps: '15', weight: '25kg', time: '08:00 AM' }
                    ],
                    dietLogs: [
                        { mealTime: 'Morning', mealName: 'Morning - 4 Boiled Eggs, Oats', items: '4 Boiled Eggs, Oatmeal, 1 Scoop Whey', isCompleted: true },
                        { mealTime: 'Noon', mealName: 'Noon - Grilled Chicken, Brown Rice', items: '150g Grilled Chicken, Rice, Broccoli', isCompleted: true },
                        { mealTime: 'Evening', mealName: 'Evening - Greek Yogurt, Almonds', items: 'Greek Yogurt, Apple, Walnuts', isCompleted: true },
                        { mealTime: 'Night', mealName: 'Night - Paneer & Salad', items: '200g Paneer, Quinoa Salad, Warm Milk', isCompleted: i > 0 } // today's night meal pending if i === 0
                    ],
                    metrics: {
                        calories: 2350 + (i * 20),
                        waterIntake: 3.5,
                        mood: 'Energetic',
                        weight: +(baseWeight + (6 - i) * 0.1).toFixed(1),
                        steps: 8200 + (i * 350)
                    }
                });
            }
        }
        console.log('DailyLogs seeded: 7 days of workouts, diets, and metrics!');

        // 9. Seed In-App Inbox Messages for MB101
        console.log('Seeding in-app inbox messages for MB101...');
        const messages = [
            {
                memberName: memberAlex.name,
                memberPhone: memberAlex.phone,
                memberEmail: memberAlex.email,
                memberId: memberAlex._id,
                channel: 'App',
                type: 'general',
                senderName: 'BigBuddy Admin',
                message: 'Welcome to BigBuddy Gym, Alex! Your 3-month membership is now active. Explore your daily workouts and diet plans.',
                isRead: false,
                date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
            },
            {
                memberName: memberAlex.name,
                memberPhone: memberAlex.phone,
                memberEmail: memberAlex.email,
                memberId: memberAlex._id,
                channel: 'App',
                type: 'invoice',
                senderName: 'Accounts Team',
                message: 'Payment Receipt: Received ₹4,500 via UPI for 3 Months Gym Membership. Thank you for your payment!',
                isRead: false,
                date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
            },
            {
                memberName: memberAlex.name,
                memberPhone: memberAlex.phone,
                memberEmail: memberAlex.email,
                memberId: memberAlex._id,
                channel: 'App',
                type: 'plans',
                senderName: 'Coach Mike',
                message: 'Your routine has been updated to Push Pull Legs. Let us crush this week goals!',
                isRead: false,
                date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
            },
            {
                memberName: memberAlex.name,
                memberPhone: memberAlex.phone,
                memberEmail: memberAlex.email,
                memberId: memberAlex._id,
                channel: 'App',
                type: 'general',
                senderName: 'Nutrition Team',
                message: 'Daily Tip: Drink at least 3.5 Liters of water today to stay hydrated during intense lifting sessions.',
                isRead: false,
                date: new Date()
            }
        ];

        for (const msg of messages) {
            const exists = await MessageLog.findOne({
                memberId: memberAlex._id,
                message: msg.message
            });
            if (!exists) {
                await MessageLog.create(msg);
            }
        }
        console.log('Inbox messages seeded: 4 in-app messages ready!');

        console.log('\n======================================================');
        console.log('USER-SIDE SEEDING COMPLETED SUCCESSFULLY!');
        console.log('======================================================');
        console.log('Test User 1 (Active, 100% Complete Profile):');
        console.log('  Login ID : MB101 or 9876543210 or alex.johnson@gmail.com');
        console.log('  Password : alex123');
        console.log('  Features : Push Pull Legs workout, 2400kcal diet, 7 days attendance & charts, 4 inbox messages');
        console.log('------------------------------------------------------');
        console.log('Test User 2 (Incomplete Profile - tests restriction banner):');
        console.log('  Login ID : MB102 or 9876543211');
        console.log('  Password : sarah123');
        console.log('  Features : Restricted until profile is filled in Profile tab');
        console.log('------------------------------------------------------');
        console.log('Test User 3 (Trainer):');
        console.log('  Login ID : TR201 or 9876543212');
        console.log('  Password : mike123');
        console.log('------------------------------------------------------');
        console.log('Daily Attendance Access Code:', gym.attendanceCode);
        console.log('======================================================\n');

        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('Seeding error:', err);
        process.exit(1);
    }
}

seedUserSide();
