import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import fs from 'fs';

// Route imports
import authRoutes from "./routes/auth.js";
import membershipPlanRoutes from "./routes/membershipPlans.js";
import workoutPlanRoutes from "./routes/workoutPlans.js";
import dietPlanRoutes from "./routes/dietPlans.js";
import memberRoutes from "./routes/members.js";
import transactionRoutes from "./routes/transactions.js";
import dashboardRoutes from "./routes/dashboard.js";
import attendanceRoutes from "./routes/attendance.js";
import gymRoutes from "./routes/gym.js";
import messagesRoutes from "./routes/messages.js";
import dailyLogRoutes from "./routes/dailyLogs.js";

dotenv.config();

const app = express();

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/membership-plans", membershipPlanRoutes);
app.use("/api/workout-plans", workoutPlanRoutes);
app.use("/api/diet-plans", dietPlanRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/gym", gymRoutes);
app.use("/api/messages", messagesRoutes);
app.use("/api/daily-logs", dailyLogRoutes);

app.get("/", (req, res) => {
    res.send("Gym Management API is working");
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error("Global Error Handler:", err);
    const errorLog = `[${new Date().toISOString()}] ${err.message}\n${err.stack}\n\n`;
    try {
        fs.appendFileSync('debug.log', errorLog);
    } catch (fsErr) {
        console.error("Could not write to debug.log", fsErr);
    }
    res.status(500).json({ message: err.message });
});

const PORT = process.env.PORT || 5050;
const MONGO_URI = process.env.MONGO_URI;

import User from "./models/User.js";
import Gym from "./models/Gym.js";

// MongoDB Connection
mongoose.connect(MONGO_URI, { dbName: 'Big_Buddy' })
    .then(async () => {
        console.log("MongoDB connected successfully to Big_Buddy");
        // Ensure default admin & gym profile exists on clean DB
        try {
            const adminCount = await User.countDocuments({ role: "admin" });
            if (adminCount === 0) {
                await User.create({
                    name: "BigBuddy Admin",
                    email: "admin@bigbuddy.com",
                    password: "admin123",
                    role: "admin"
                });
                console.log("Default Admin seeded: admin@bigbuddy.com (Password: admin123)");
            }
            const gym = await Gym.findOne();
            if (!gym) {
                await Gym.create({
                    name: "BigBuddy Fitness",
                    address: "Main Street, Fitness Complex",
                    contact: "+91 9876543210",
                    gmail: "admin@bigbuddy.com"
                });
                console.log("Default Gym profile seeded");
            }
        } catch (seedErr) {
            console.error("Auto-seed error:", seedErr);
        }
    })
    .catch((err) => console.error("MongoDB connection error:", err));

app.listen(PORT, () => {
    console.log("Server is running on PORT:", PORT);
});