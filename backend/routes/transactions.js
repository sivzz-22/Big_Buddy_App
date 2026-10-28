import express from "express";
import Transaction from "../models/Transaction.js";
import Member from "../models/Member.js";

const router = express.Router();

// Get all transactions
router.get("/", async (req, res) => {
    try {
        const { date, paymentMode } = req.query;
        let filter = {};

        if (date) {
            const start = new Date(date);
            start.setHours(0, 0, 0, 0);
            const end = new Date(date);
            end.setHours(23, 59, 59, 999);
            filter.date = { $gte: start, $lte: end };
        }

        if (paymentMode) {
            if (paymentMode === 'UPI' || paymentMode === 'GPay') {
                filter.paymentMode = { $in: ['UPI', 'GPay'] };
            } else {
                filter.paymentMode = paymentMode;
            }
        }

        const transactions = await Transaction.find(filter).sort({ date: -1 });
        res.json(transactions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get transaction summary statistics
router.get("/summary", async (req, res) => {
    try {
        const stats = await Transaction.aggregate([
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: "$amount" },
                    upiRevenue: {
                        $sum: { $cond: [{ $in: ["$paymentMode", ["UPI", "GPay"]] }, "$amount", 0] }
                    },
                    cashRevenue: {
                        $sum: { $cond: [{ $eq: ["$paymentMode", "Cash"] }, "$amount", 0] }
                    }
                }
            }
        ]);

        if (stats.length > 0) {
            res.json(stats[0]);
        } else {
            res.json({ totalRevenue: 0, upiRevenue: 0, cashRevenue: 0 });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Create a new transaction
router.post("/", async (req, res) => {
    try {
        const { memberID, memberName, amount, paymentMode, planType, description, date } = req.body;

        // Verify member exists first if memberID is provided
        const isObjectId = /^[a-fA-F0-9]{24}$/.test(memberID);
        const memberQuery = isObjectId ? { $or: [{ _id: memberID }, { memberID }] } : { memberID };

        let memberExists = null;
        if (memberID) {
            memberExists = await Member.findOne(memberQuery);
            if (!memberExists) {
                return res.status(404).json({ message: "Selected member does not exist." });
            }
        } else {
             return res.status(400).json({ message: "Member ID is required for a transaction." });
        }

        const transaction = new Transaction({
            memberID: memberExists ? memberExists._id : (isObjectId ? memberID : undefined),
            memberName,
            amount: Number(amount),
            paymentMode,
            planType,
            description,
            date: date || new Date()
        });

        const savedTransaction = await transaction.save();

        // Update member balance and membership status if memberID is provided
        // skipMemberUpdate is used when the financials were already handled during member creation/update
        if (memberID && !req.body.skipMemberUpdate) {
            const member = await Member.findOne(memberQuery);
            if (member) {
                // Update basic financials
                member.amountPaid = (member.amountPaid || 0) + Number(amount);
                member.balance = Math.max(0, (member.balance || 0) - Number(amount));
                if (member.balance === 0) member.isPaymentCompleted = true;

                // Membership Extension Logic
                // Only extend if a specific plan type is mentioned and payment is significant
                if (planType && Number(amount) > 0) {
                    let monthsToAdd = 0;
                    const pt = planType.toLowerCase();
                    if (pt.includes('month')) monthsToAdd = 1;
                    else if (pt.includes('quarter')) monthsToAdd = 3;
                    else if (pt.includes('half')) monthsToAdd = 6;
                    else if (pt.includes('year')) monthsToAdd = 12;

                    if (monthsToAdd > 0) {
                        // If member is already active and expiry is in the future, extend from current expiry
                        // Otherwise, extend from today
                        let startDate = new Date();
                        if (member.expiryDate && member.expiryDate > new Date()) {
                            startDate = new Date(member.expiryDate);
                        }
                        
                        const newExpiry = new Date(startDate);
                        newExpiry.setMonth(newExpiry.getMonth() + monthsToAdd);
                        member.expiryDate = newExpiry;
                        member.status = 'Active';
                    }
                }

                await member.save();
            }
        }

        res.status(201).json(savedTransaction);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Mark invoice as sent
router.put("/:id/invoice", async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.id);
        if (!transaction) return res.status(404).json({ message: "Transaction not found" });

        transaction.invoiceSent = true;
        await transaction.save();
        res.json(transaction);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

export default router;
