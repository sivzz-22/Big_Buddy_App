import mongoose from "mongoose";

const messageLogSchema = new mongoose.Schema({
    memberName: { type: String, required: true },
    memberPhone: { type: String },
    memberEmail: { type: String },
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' }, // for in-app inbox
    message: { type: String, required: true },
    channel: { type: String, required: true }, // WhatsApp, SMS, Mail, App
    type: { type: String }, // invoice, expired, absent, birthday, plans, general
    senderName: { type: String, default: 'BigBuddy Admin' },
    isRead: { type: Boolean, default: false },
    date: { type: Date, default: Date.now },
}, {
    timestamps: true
});

// Auto-delete messages older than 30 days (1 month TTL)
messageLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const MessageLog = mongoose.model("MessageLog", messageLogSchema);

export default MessageLog;
