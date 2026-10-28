import express from "express";
import MessageLog from "../models/MessageLog.js";

const router = express.Router();

// Helper to purge messages older than 1 month (30 days)
const purgeExpiredMessages = async () => {
    try {
        const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        await MessageLog.deleteMany({
            $or: [
                { createdAt: { $lt: oneMonthAgo } },
                { date: { $lt: oneMonthAgo } }
            ]
        });
    } catch (e) {
        console.error("Auto-delete message history error:", e);
    }
};

// Get all message logs (admin use)
router.get("/", async (req, res) => {
    try {
        await purgeExpiredMessages();
        const messages = await MessageLog.find().sort({ date: -1 }).limit(100);
        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get inbox messages for a specific member (in-app inbox)
router.get("/inbox/:memberId", async (req, res) => {
    try {
        await purgeExpiredMessages();
        const { memberId } = req.params;
        const messages = await MessageLog.find({
            memberId: memberId,
            channel: 'App'
        }).sort({ date: -1 }).limit(50);
        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Mark a message as read
router.put("/read/:messageId", async (req, res) => {
    try {
        const msg = await MessageLog.findByIdAndUpdate(
            req.params.messageId,
            { isRead: true },
            { new: true }
        );
        if (!msg) return res.status(404).json({ message: "Message not found" });
        res.json(msg);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Mark ALL messages as read for a member
router.put("/read-all/:memberId", async (req, res) => {
    try {
        await MessageLog.updateMany(
            { memberId: req.params.memberId, channel: 'App', isRead: false },
            { isRead: true }
        );
        res.json({ message: "All messages marked as read" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get unread count for a member
router.get("/unread-count/:memberId", async (req, res) => {
    try {
        const count = await MessageLog.countDocuments({
            memberId: req.params.memberId,
            channel: 'App',
            isRead: false
        });
        res.json({ count });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Create a new message log (admin sends)
router.post("/", async (req, res) => {
    try {
        const newLog = new MessageLog({
            memberName: req.body.memberName,
            memberPhone: req.body.memberPhone,
            memberEmail: req.body.memberEmail,
            memberId: req.body.memberId || null,
            message: req.body.message,
            channel: req.body.channel,
            type: req.body.type || 'general',
            senderName: req.body.senderName || 'BigBuddy Admin',
            isRead: false,
        });
        const savedLog = await newLog.save();
        res.status(201).json(savedLog);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

export default router;
