import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Member from "../models/Member.js";

const router = express.Router();

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: "30d",
    });
};

// @desc    Register a new user
// @route   POST /api/auth/signup
// @access  Public
router.post("/signup", async (req, res) => {
    const { name, email, password } = req.body;

    try {
        if (!email.toLowerCase().endsWith("@bigbuddy.com")) {
            return res.status(403).json({ message: "Only @bigbuddy.com emails can register as Admin/Gym Owner." });
        }

        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(400).json({ message: "User already exists" });
        }

        const user = await User.create({
            name,
            email,
            password,
        });

        if (user) {
            res.status(201).json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                token: generateToken(user._id),
            });
        } else {
            res.status(400).json({ message: "Invalid user data" });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    try {
        let user = null;
        let role = null;
        let memberDetails = null;

        const identifier = (email || "").trim();

        if (identifier.toLowerCase().endsWith("@bigbuddy.com")) {
            // Check User collection for Admins
            user = await User.findOne({ email: identifier.toLowerCase() });
            if (user && (await user.comparePassword(password))) {
                role = user.role || "admin";
            } else {
                return res.status(401).json({ message: "Invalid admin email or password" });
            }
        } else {
            // Check Member collection for Gym Users (supports Email, Phone, or Member ID)
            const member = await Member.findOne({
                $or: [
                    { email: identifier.toLowerCase() },
                    { phone: identifier },
                    { memberID: identifier.toUpperCase() },
                    { memberID: identifier }
                ]
            });
            if (member && (await bcrypt.compare(password, member.password))) {
                user = member;
                role = "member";
                memberDetails = member;
            } else {
                return res.status(401).json({ message: "Invalid credentials (Member ID, Phone, or Email with Password)" });
            }
        }

        const isProfileComplete = memberDetails
            ? Boolean(
                memberDetails.email && memberDetails.email.trim() !== '' &&
                memberDetails.dob && memberDetails.dob.trim() !== '' &&
                memberDetails.gender && memberDetails.gender.trim() !== '' &&
                memberDetails.bloodGroup && memberDetails.bloodGroup.trim() !== '' &&
                memberDetails.address && memberDetails.address.trim() !== ''
            )
            : true;

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email || "",
            role: role,
            token: generateToken(user._id),
            memberId: memberDetails ? memberDetails.memberID : null,
            phone: memberDetails ? memberDetails.phone : null,
            isProfileComplete: isProfileComplete
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: error.message });
    }
});

// @desc    Auth with google
// @route   POST /api/auth/google
// @access  Public
router.post("/google", async (req, res) => {
    const { name, email, googleId } = req.body;

    try {
        let user = null;
        let role = null;
        let memberDetails = null;

        if (email.toLowerCase().endsWith("@bigbuddy.com")) {
            // Admin flow
            user = await User.findOne({ email });
            
            if (user) {
                if (!user.googleId) {
                    user.googleId = googleId;
                    await user.save();
                }
            } else {
                user = await User.create({ name, email, googleId, role: 'admin' });
            }
            role = user.role || 'admin';
        } else {
            // Member flow
            const member = await Member.findOne({ email });
            
            if (!member) {
                return res.status(403).json({ message: "No active gym membership found for this email. Please contact the admin." });
            }
            
            // Link Google ID if not already (Optional, currently Member model might not have googleId, but it handles login)
            user = member;
            role = 'member';
            memberDetails = member;
        }

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: role,
            token: generateToken(user._id),
            memberId: memberDetails ? memberDetails.memberID : null
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

export default router;
