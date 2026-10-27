import express from "express";
import Member from "../models/Member.js";
import bcrypt from "bcryptjs";

const router = express.Router();

// Get all members or trainers
router.get("/", async (req, res) => {
    try {
        const { role } = req.query; // Filter by role (member/trainer)
        const filter = role ? { role } : {};
        const members = await Member.find(filter).sort({ createdAt: -1 });
        res.json(members);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get count of members who joined this month (for auto MemberID generation)
router.get("/count/monthly", async (req, res) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        const count = await Member.countDocuments({
            role: 'member',
            joinDate: { $gte: startOfMonth, $lte: endOfMonth }
        });
        res.json({ count });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});



// Get single member by ID or MemberID or Email
router.get("/:id", async (req, res) => {
    try {
        const identifier = req.params.id;
        
        // Build query conditionally to avoid MongoDB CastError
        // when identifier is an email (not a valid ObjectId)
        const isEmail = identifier.includes('@');
        const isObjectId = /^[a-fA-F0-9]{24}$/.test(identifier);

        let query;
        if (isEmail) {
            query = { $or: [{ email: identifier.toLowerCase() }, { memberID: identifier }] };
        } else if (isObjectId) {
            query = { $or: [{ _id: identifier }, { memberID: identifier }, { email: identifier.toLowerCase() }, { phone: identifier }] };
        } else {
            query = { $or: [{ memberID: identifier }, { phone: identifier }, { memberID: identifier.toUpperCase() }] };
        }

        const member = await Member.findOne(query);
        if (member) {
            res.json(member);
        } else {
            res.status(404).json({ message: "Member not found" });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Helper to calculate expiry date
const calculateExpiry = (planType, startDate = new Date()) => {
    let monthsToAdd = 0;
    const pt = planType.toLowerCase();
    if (pt.includes('month')) monthsToAdd = 1;
    else if (pt.includes('quarter')) monthsToAdd = 3;
    else if (pt.includes('half')) monthsToAdd = 6;
    else if (pt.includes('year')) monthsToAdd = 12;

    if (monthsToAdd > 0) {
        const d = new Date(startDate);
        d.setMonth(d.getMonth() + monthsToAdd);
        return d;
    }
    return null;
};

// Create a new member or trainer
router.post("/", async (req, res) => {
    try {
        const { password, memberID, subscriptionType, discount, amountPaid } = req.body;

        const exists = await Member.findOne({ memberID });
        if (exists) return res.status(400).json({ message: "Member ID already exists" });

        const hashedPassword = await bcrypt.hash(password, 10);
        
        let expiryDate = null;
        if (subscriptionType) {
            expiryDate = calculateExpiry(subscriptionType);
        }

        const isProfileComplete = Boolean(
            req.body.email && req.body.email.trim() !== '' &&
            req.body.dob && req.body.dob.trim() !== '' &&
            req.body.gender && req.body.gender.trim() !== '' &&
            req.body.bloodGroup && req.body.bloodGroup.trim() !== '' &&
            req.body.address && req.body.address.trim() !== ''
        );

        const member = new Member({
            ...req.body,
            password: hashedPassword,
            visiblePassword: password, // Store plain text
            expiryDate: expiryDate || req.body.expiryDate,
            isProfileComplete
        });

        const savedMember = await member.save();
        res.status(201).json(savedMember);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Update a member or trainer
router.put("/:id", async (req, res) => {
    try {
        const identifier = req.params.id;
        const isObjectId = /^[a-fA-F0-9]{24}$/.test(identifier);

        let queryOr = [
            { memberID: identifier },
            { email: identifier.toLowerCase() },
            { phone: identifier }
        ];
        if (isObjectId) {
            queryOr.unshift({ _id: identifier });
        }

        const member = await Member.findOne({ $or: queryOr });

        if (member) {
            const oldSubscription = member.subscriptionType;
            
            Object.keys(req.body).forEach(key => {
                if (key !== 'password' && req.body[key] !== undefined) {
                    member[key] = req.body[key];
                }
            });

            if (req.body.password) {
                member.password = await bcrypt.hash(req.body.password, 10);
                member.visiblePassword = req.body.password; // Sync plain text
            }

            // Membership Renewal Logic
            const isRenewal = req.body.forceRenewal || (req.body.subscriptionType && req.body.subscriptionType !== oldSubscription);
            
            if (isRenewal && req.body.subscriptionType) {
                // Determine starting point for extension
                let startDate = new Date();
                // If member is currently active and expiry is in the future, extend from that date
                if (member.expiryDate && member.expiryDate > new Date()) {
                    startDate = new Date(member.expiryDate);
                }
                
                member.expiryDate = calculateExpiry(req.body.subscriptionType, startDate);
                member.status = 'Active';
            }

            // Update isProfileComplete
            member.isProfileComplete = Boolean(
                member.email && member.email.trim() !== '' &&
                member.dob && member.dob.trim() !== '' &&
                member.gender && member.gender.trim() !== '' &&
                member.bloodGroup && member.bloodGroup.trim() !== '' &&
                member.address && member.address.trim() !== ''
            );

            const updatedMember = await member.save();
            res.json(updatedMember);
        } else {
            res.status(404).json({ message: "Member not found" });
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Delete a member or trainer
router.delete("/:id", async (req, res) => {
    try {
        const member = await Member.findOne({
            $or: [
                { _id: req.params.id },
                { memberID: req.params.id }
            ]
        });

        if (member) {
            await Member.deleteOne({ _id: member._id });
            res.json({ message: "Member removed" });
        } else {
            res.status(404).json({ message: "Member not found" });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

export default router;
