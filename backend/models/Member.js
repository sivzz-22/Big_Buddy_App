import mongoose from "mongoose";

const memberSchema = new mongoose.Schema({
    name: { type: String, required: true },
    memberID: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    visiblePassword: { type: String }, // Plain text for admin reference
    phone: { type: String, required: true },
    email: { type: String, lowercase: true },
    dob: { type: String },
    gender: { type: String },
    bloodGroup: { type: String },
    address: { type: String },
    isProfileComplete: { type: Boolean, default: false },
    height: { type: String },
    weight: { type: String },
    waistSize: { type: String },
    description: { type: String },
    role: { type: String, enum: ['member', 'trainer'], default: 'member' },
    subscriptionType: { type: String },
    workoutPlan: { type: String },
    dietPlan: { type: String },
    discount: { type: Number, default: 0 },
    paymentMode: { type: String, default: 'Cash' },
    amountPaid: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    isPaymentCompleted: { type: Boolean, default: false },
    workTime: { type: String }, // For trainers: Morning, Evening, Both
    status: { type: String, enum: ['Active', 'Expired'], default: 'Active' },
    expiryDate: { type: Date },
    joinDate: { type: Date, default: Date.now },
    photo: { type: String }, // URL to photo
}, {
    timestamps: true
});

// Auto-update status based on expiryDate
memberSchema.pre("save", async function () {
    if (this.expiryDate) {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const expiry = new Date(this.expiryDate);
            expiry.setHours(0, 0, 0, 0);

            if (expiry < today) {
                this.status = 'Expired';
            } else {
                this.status = 'Active';
            }
        } catch (e) {
            console.error("Error in Member pre-save:", e);
        }
    }
});

const Member = mongoose.model("Member", memberSchema);

export default Member;
