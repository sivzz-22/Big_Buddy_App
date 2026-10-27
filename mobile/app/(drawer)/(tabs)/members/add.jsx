import { View, Text, StyleSheet, TextInput, ScrollView, Pressable, Image, Alert, Modal, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useTheme } from '../../../../constants/ThemeContext';
import { useState, useEffect } from 'react';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import axios from 'axios';
import { API_URL } from '../../../../constants/Config';

export default function AddMember() {
    const { colors } = useTheme();
    const { type, mode, id, action } = useLocalSearchParams(); // type: 'member'|'trainer', mode: 'update', action: 'renew'
    const isUpdate = mode === 'update';
    const isRenew = action === 'renew';

    const styles = getStyles(colors);

    // Dynamic Lists
    const [membershipPlans, setMembershipPlans] = useState([]);
    const [workoutPlans, setWorkoutPlans] = useState([]);
    const [dietPlans, setDietPlans] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fetchingPlans, setFetchingPlans] = useState(true);
    const [carriedBalance, setCarriedBalance] = useState(0);

    // Initial State
    const [formData, setFormData] = useState({
        name: '',
        memberID: '',
        password: '',
        phone: '',
        email: '',
        dob: '',
        gender: '',
        bloodGroup: '',
        address: '',
        height: '',
        weight: '',
        waistSize: '',
        description: '',
        role: type || 'member',
        subscriptionType: '',
        workoutPlan: '',
        dietPlan: '',
        discount: '0',
        workTime: 'Morning', // For trainer
        paymentMode: 'Cash',
        amountPaid: '',
        balance: '0',
    });
    const [isPaymentCompleted, setIsPaymentCompleted] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [recordNewTransaction, setRecordNewTransaction] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState(null);

    useEffect(() => {
        loadInitialData();
    }, []);

    // Auto-generate MemberID for new members
    const generateMemberID = async () => {
        try {
            const now = new Date();
            const year = String(now.getFullYear()).slice(-2); // '26'
            const monthNames = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
            const month = monthNames[now.getMonth()]; // 'MAR'
            const res = await axios.get(`${API_URL}/members/count/monthly`);
            const seq = String((res.data.count || 0) + 1).padStart(3, '0'); // '001'
            return `${year}${month}${seq}`; // '26MAR001'
        } catch (e) {
            return '';
        }
    };


    const loadInitialData = async () => {
        setFetchingPlans(true);
        try {
            const [mRes, wRes, dRes] = await Promise.all([
                axios.get(`${API_URL}/membership-plans`),
                axios.get(`${API_URL}/workout-plans`),
                axios.get(`${API_URL}/diet-plans`)
            ]);
            setMembershipPlans(mRes.data);
            setWorkoutPlans(wRes.data);
            setDietPlans(dRes.data);

            if (isUpdate && id) {
                fetchMemberDetails(id);
            } else if (!isUpdate && type !== 'trainer') {
                // Auto-generate memberID for new members
                const autoId = await generateMemberID();
                if (autoId) setFormData(prev => ({ ...prev, memberID: autoId }));
            }
        } catch (error) {
            console.log("Load initial data error:", error);
        } finally {
            setFetchingPlans(false);
        }
    };

    useEffect(() => {
        if (type === 'trainer') return;
        
        const plan = membershipPlans.find(p => p.name === formData.subscriptionType);
        if (plan) {
            const price = parseInt(plan.price) || 0;
            const extra = Number(carriedBalance) || 0;
            const disc = parseInt(formData.discount) || 0;
            const paid = parseInt(formData.amountPaid) || 0;
            const bal = Math.max(0, (price + extra) - disc - paid);
            setFormData(prev => ({ ...prev, balance: String(bal) }));
        }
    }, [formData.subscriptionType, formData.discount, formData.amountPaid, membershipPlans, carriedBalance]);

    const fetchMemberDetails = async (memberId) => {
        setLoading(true);
        try {
            const response = await axios.get(`${API_URL}/members/${memberId}`);
            const data = response.data;
            setFormData({
                ...data,
                password: data.visiblePassword || '', // Show the original plain text password
                discount: isRenew ? '0' : String(data.discount || 0),
                amountPaid: isRenew ? '' : String(data.amountPaid || 0),
                balance: isRenew ? String(data.balance || 0) : String(data.balance || 0),
            });

            if (isRenew) {
                setCarriedBalance(Number(data.balance) || 0);
                setIsPaymentCompleted(false);
            } else {
                setIsPaymentCompleted(data.isPaymentCompleted);
            }
        } catch (error) {
            console.log("Fetch member details error:", error);
            Alert.alert("Error", "Could not load member details.");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!formData.name || !formData.memberID || (!isUpdate && !formData.password) || !formData.phone) {
            Alert.alert("Error", "Please fill required fields (*): Full Name, Member ID, Phone Number, Password");
            return;
        }

        setLoading(true);
        try {
            let currentMemberId = id;
            if (isUpdate) {
                await axios.put(`${API_URL}/members/${id}`, {
                    ...formData,
                    amountPaid: Number(formData.amountPaid) || 0,
                    discount: Number(formData.discount) || 0,
                    balance: Number(formData.balance) || 0,
                    isPaymentCompleted,
                    forceRenewal: isRenew
                });
            } else {
                const addRes = await axios.post(`${API_URL}/members`, {
                    ...formData,
                    amountPaid: Number(formData.amountPaid) || 0,
                    discount: Number(formData.discount) || 0,
                    balance: Number(formData.balance) || 0,
                    isPaymentCompleted,
                    status: 'Active'
                });
                currentMemberId = addRes.data._id;
            }

            const paidAmount = Number(formData.amountPaid) || 0;
            if (paidAmount > 0 && (!isUpdate || isRenew)) {
                try {
                    await axios.post(`${API_URL}/transactions`, {
                        memberID: currentMemberId,
                        memberName: formData.name,
                        amount: paidAmount,
                        paymentMode: formData.paymentMode,
                        planType: formData.subscriptionType || 'Monthly',
                        skipMemberUpdate: true // Prevent double-counting as financials are already in the member object
                    });
                } catch (txErr) {
                    console.log("Error creating transaction", txErr);
                }
            }

            Alert.alert("Success", isUpdate ? "Profile Updated!" : "New Member Added!");
            router.back();
        } catch (error) {
            console.log("Save member error:", error.response?.data || error.message);
            Alert.alert("Error", error.response?.data?.message || "Could not save member.");
        } finally {
            setLoading(false);
        }
    };


    const renderInput = (label, field, placeholder, keyboardType = 'default', secureTextEntry = false) => (
        <View style={styles.inputGroup}>
            <Text style={styles.label}>{label}</Text>
            <View style={{ position: 'relative' }}>
                <TextInput
                    style={[styles.input, { 
                        textAlignVertical: label.includes('DESCRIPTION') ? 'top' : 'center',
                        paddingRight: field === 'password' ? 50 : 15 
                    }]}
                    value={formData[field]}
                    onChangeText={(t) => setFormData({ ...formData, [field]: t })}
                    placeholder={placeholder}
                    placeholderTextColor={colors.secondary}
                    keyboardType={keyboardType}
                    secureTextEntry={secureTextEntry && !showPassword}
                    multiline={label.includes('DESCRIPTION')}
                    numberOfLines={label.includes('DESCRIPTION') ? 4 : 1}
                />
                {field === 'password' && (
                    <Pressable 
                        style={{ position: 'absolute', right: 15, top: '25%' }}
                        onPress={() => setShowPassword(!showPassword)}
                    >
                        <Ionicons 
                            name={showPassword ? "eye-off-outline" : "eye-outline"} 
                            size={20} 
                            color={colors.secondary} 
                        />
                    </Pressable>
                )}
            </View>
        </View>
    );

    const renderSelect = (label, field, options) => (
        <View style={styles.inputGroup}>
            <Text style={styles.label}>{label}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {options.map((opt, index) => (
                    <Pressable
                        key={`${opt}-${index}`}
                        style={[
                            styles.chip,
                            formData[field] === opt && styles.activeChip
                        ]}
                        onPress={() => setFormData({ ...formData, [field]: opt })}
                    >
                        <Text style={[
                            styles.chipText,
                            formData[field] === opt && styles.activeChipText
                        ]}>{opt}</Text>
                    </Pressable>
                ))}
            </ScrollView>
        </View>
    );

    const renderDropdown = (label, field, options, type = 'membership') => {
        const isOpen = activeDropdown === field;
        return (
            <View style={styles.inputGroup}>
                <Text style={styles.label}>{label}</Text>
                <Pressable
                    style={[styles.dropdown, isOpen && styles.dropdownActive]}
                    onPress={() => setActiveDropdown(isOpen ? null : field)}
                >
                    <Text style={styles.dropdownValue}>{formData[field] || 'Select an option'}</Text>
                    <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={20} color={colors.secondary} />
                </Pressable>

                {isOpen && (
                    <View style={styles.dropdownMenu}>
                        {options.map((option, index) => (
                            <Pressable
                                key={option._id || option.id || `opt-${index}`}
                                style={styles.dropdownOption}
                                onPress={() => {
                                    setFormData({ ...formData, [field]: option.name || option.title });
                                    setActiveDropdown(null);
                                }}
                            >
                                <Text style={[
                                    styles.dropdownOptionText,
                                    formData[field] === (option.name || option.title) && styles.dropdownOptionTextActive
                                ]}>
                                    {option.name || option.title}
                                </Text>
                                {formData[field] === (option.name || option.title) && (
                                    <Ionicons name="checkmark" size={16} color={colors.primary} />
                                )}
                            </Pressable>
                        ))}
                    </View>
                )}

                {/* Plan Details Display */}
                {!isOpen && renderPlanDetails(field, type)}
            </View>
        );
    };

    const renderPlanDetails = (field, type) => {
        const value = formData[field];
        let details = null;
        if (type === 'membership') {
            details = membershipPlans.find(p => p.name === value);
            if (!details) return null;
            const originalPrice = parseInt(details.price) || 0;
            const extra = isRenew ? Number(carriedBalance) : 0;
            const discountAmount = parseInt(formData.discount) || 0;
            const finalPrice = Math.max(0, originalPrice + extra - discountAmount);

            return (
                <View style={styles.planCard}>
                    <View style={styles.planDetailRow}>
                        <Text style={styles.planDetailLabel}>Plan Price: </Text>
                        <Text style={styles.planDetailValue}>₹{originalPrice}</Text>
                    </View>
                    
                    {extra > 0 && (
                        <View style={styles.planDetailRow}>
                            <Text style={styles.planDetailLabel}>Previous Balance: </Text>
                            <Text style={[styles.planDetailValue, { color: colors.error }]}>+₹{extra}</Text>
                        </View>
                    )}

                    {discountAmount > 0 && (
                        <View style={styles.planDetailRow}>
                            <Text style={styles.planDetailLabel}>Discount: </Text>
                            <Text style={[styles.planDetailValue, { color: colors.success }]}>-₹{discountAmount}</Text>
                        </View>
                    )}

                    <View style={[styles.planDetailRow, { marginTop: 5, paddingTop: 5, borderTopWidth: 1, borderTopColor: colors.border }]}>
                        <Text style={[styles.planDetailLabel, { fontWeight: 'bold' }]}>Total to Pay: </Text>
                        <Text style={[styles.planDetailValue, { color: colors.primary, fontSize: 18, fontWeight: 'bold' }]}>₹{finalPrice}</Text>
                    </View>

                    <View style={[styles.planDetailRow, { marginTop: 10 }]}>
                        <Text style={styles.planDetailLabel}>Duration: </Text>
                        <Text style={styles.planDetailValue}>{details.duration}</Text>
                    </View>
                    <Text style={styles.planDetailDesc}>{details.description}</Text>
                </View>
            );
        } else if (type === 'workout') {
            details = workoutPlans.find(p => (p.name || p.title) === value);
            if (!details) return null;
            return (
                <View style={styles.planCard}>
                    <Text style={styles.planDetailLabel}>Level: {details.level}</Text>
                    <Text style={styles.planDetailDesc}>{details.routine}</Text>
                </View>
            );
        } else if (type === 'diet') {
            details = dietPlans.find(p => p.name === value);
            if (!details) return null;
            return (
                <View style={styles.planCard}>
                    <Text style={styles.planDetailLabel}>Cals: {details.cals}</Text>
                    <Text style={styles.planDetailDesc}>{details.plan}</Text>
                </View>
            );
        }
        return null;
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Text style={styles.headerTitle}>
                {isRenew ? 'Membership Renewal' : (isUpdate ? 'Update Profile' : `Add New ${type === 'trainer' ? 'Trainer' : 'Member'}`)}
            </Text>

            {!isUpdate && (
                <View style={{
                    backgroundColor: colors.primary + '15',
                    borderColor: colors.primary + '40',
                    borderWidth: 1,
                    borderRadius: 10,
                    padding: 12,
                    marginBottom: 15,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10
                }}>
                    <Ionicons name="information-circle-outline" size={22} color={colors.primary} />
                    <Text style={{ color: colors.text, fontSize: 13, flex: 1, lineHeight: 18 }}>
                        Only <Text style={{ fontWeight: 'bold', color: colors.primary }}>Name, Member ID, Phone & Password (*)</Text> are required. Other details can be completed by the member later in their profile.
                    </Text>
                </View>
            )}

            {/* Image Placeholder */}
            <View style={styles.imageSection}>
                <View style={styles.imagePlaceholder}>
                    <Ionicons name="camera" size={30} color={colors.secondary} />
                </View>
                <Text style={styles.imageText}>Upload Photo</Text>
            </View>

            {/* Basic Info */}
            <Text style={styles.sectionHeader}>Personal Details</Text>

            {renderInput('FULL NAME *', 'name', 'e.g. John Doe')}

            <View style={styles.row}>
                <View style={styles.halfWidth}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>MEMBER ID *</Text>
                        <View style={{ position: 'relative' }}>
                            <TextInput
                                style={[styles.input, { paddingRight: 40 }]}
                                value={formData.memberID}
                                onChangeText={(t) => setFormData({ ...formData, memberID: t })}
                                placeholder="Auto-generated"
                                placeholderTextColor={colors.secondary}
                            />
                            <Ionicons
                                name="sparkles"
                                size={16}
                                color={colors.primary}
                                style={{ position: 'absolute', right: 12, top: '30%' }}
                            />
                        </View>
                    </View>
                </View>
                <View style={styles.halfWidth}>
                    {renderInput(isUpdate ? 'PASSWORD (Optional)' : 'PASSWORD *', 'password', isUpdate ? 'Leave blank to keep' : 'Set a password', 'default', true)}
                </View>
            </View>
            {renderInput('PHONE NUMBER *', 'phone', 'e.g. 9876543210', 'phone-pad')}
            {renderInput('EMAIL ADDRESS (Optional)', 'email', 'e.g. john@example.com', 'email-address')}

            <View style={styles.row}>
                <View style={[styles.oneThirdWidth, { flex: 2 }]}>
                    {renderInput('DOB (Optional)', 'dob', 'DD/MM/YYYY')}
                </View>
                <View style={styles.oneThirdWidth}>
                    {renderInput('BLOOD GROUP (Optional)', 'bloodGroup', 'e.g. O+')}
                </View>
            </View>

            {renderSelect('GENDER (Optional)', 'gender', ['Male', 'Female', 'Other'])}

            {renderInput('ADDRESS (Optional)', 'address', 'Full Residential Address')}

            <View style={styles.row}>
                <View style={styles.oneThirdWidth}>
                    {renderInput('HEIGHT (cm) (Optional)', 'height', '175', 'numeric')}
                </View>
                <View style={styles.oneThirdWidth}>
                    {renderInput('WEIGHT (kg) (Optional)', 'weight', '70', 'numeric')}
                </View>
                <View style={styles.oneThirdWidth}>
                    {renderInput('WAIST (in) (Optional)', 'waistSize', '32', 'numeric')}
                </View>
            </View>

            {renderInput('DESCRIPTION / MEDICAL NOTES (Optional)', 'description', 'Any injuries, medications...')}

            {/* Type Specific Fields */}
            {type === 'trainer' ? (
                <>
                    <Text style={styles.sectionHeader}>Work Details</Text>
                    {renderSelect('SHIFT PREFERENCE', 'workTime', ['Morning', 'Evening', 'Both'])}
                </>
            ) : null}

            {/* Plan Setup - Shown for New Members or during Profile Update */}
            {(isUpdate || type !== 'trainer') && (
                <>
                    <Text style={styles.sectionHeader}>{isUpdate ? 'Membership & Plans' : 'Initial Plan Setup'}</Text>
                    {renderDropdown('SUBSCRIPTION PLAN', 'subscriptionType', membershipPlans, 'membership')}
                    {renderInput('DISCOUNT', 'discount', 'e.g. 500', 'numeric')}

                    <Text style={[styles.sectionHeader, { marginTop: 15 }]}>Payment Details</Text>
                    {renderSelect('MODE OF PAYMENT', 'paymentMode', ['Cash', 'GPay'])}
                    <View style={{ flexDirection: 'row', gap: 15 }}>
                        <View style={{ flex: 1 }}>
                            {renderInput('AMOUNT PAID', 'amountPaid', 'e.g. 2000', 'numeric')}
                        </View>
                        <View style={{ flex: 1 }}>
                            {renderInput('BALANCE', 'balance', 'e.g. 500', 'numeric')}
                        </View>
                    </View>

                    <Pressable
                        style={[styles.paymentCompletedBtn, isPaymentCompleted && styles.paymentCompletedBtnActive]}
                        onPress={() => {
                            if (!formData.amountPaid) {
                                Alert.alert("Required", "Please enter the amount paid first.");
                                return;
                            }
                            setIsPaymentCompleted(!isPaymentCompleted);
                            if (!isPaymentCompleted) {
                                setRecordNewTransaction(true);
                                Alert.alert("Success", `₹${formData.amountPaid} payment prepared via ${formData.paymentMode}! This will be added to the transactions page on save.`);
                            } else {
                                setRecordNewTransaction(false);
                            }
                        }}
                    >
                        <Ionicons
                            name={isPaymentCompleted ? "checkmark-circle" : "card-outline"}
                            size={20}
                            color={isPaymentCompleted ? colors.buttonPrimaryText : colors.primary}
                        />
                        <Text style={[styles.paymentCompletedBtnText, isPaymentCompleted && styles.paymentCompletedBtnTextActive]}>
                            {isPaymentCompleted ? "PAYMENT RECORDED" : "PAYMENT COMPLETED"}
                        </Text>
                    </Pressable>

                    <Text style={[styles.sectionHeader, { marginTop: 30 }]}>Fitness Plans</Text>
                    {renderDropdown('WORKOUT PLAN', 'workoutPlan', workoutPlans, 'workout')}
                    {renderDropdown('DIET PLAN', 'dietPlan', dietPlans, 'diet')}
                </>
            )}

            <Pressable style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>{isUpdate ? 'SAVE UPDATES' : `ADD ${type === 'trainer' ? 'TRAINER' : 'MEMBER'}`}</Text>
            </Pressable>

            {loading && (
                <View style={StyleSheet.absoluteFillObject}>
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                </View>
            )}
        </ScrollView>
        </KeyboardAvoidingView>
    );
}

const getStyles = (colors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        padding: 20,
        paddingBottom: 50,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.primary,
        marginBottom: 20,
        textAlign: 'center',
    },
    imageSection: {
        alignItems: 'center',
        marginBottom: 30,
    },
    imagePlaceholder: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    imageText: {
        color: colors.primary,
        fontSize: 14,
    },
    sectionHeader: {
        color: colors.primary,
        fontSize: 18,
        fontWeight: '600',
        marginTop: 15,
        marginBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        paddingBottom: 8,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        color: colors.secondary,
        fontSize: 12,
        marginBottom: 8,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    input: {
        backgroundColor: colors.surface,
        color: colors.text,
        padding: 15,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    row: {
        flexDirection: 'row',
        gap: 15,
    },
    oneThirdWidth: {
        flex: 1,
    },
    halfWidth: {
        flex: 1,
    },

    // Dropdown Styles
    dropdown: {
        backgroundColor: colors.surface,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    dropdownActive: {
        borderColor: colors.primary,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
    },
    dropdownValue: {
        color: colors.text,
        fontSize: 16,
    },
    dropdownMenu: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderTopWidth: 0,
        borderColor: colors.primary,
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12,
        paddingHorizontal: 10,
        paddingBottom: 10,
        zIndex: 1000,
    },
    dropdownOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        borderTopWidth: 1,
        borderTopColor: colors.isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
    },
    dropdownOptionText: {
        color: colors.secondary,
        fontSize: 15,
    },
    dropdownOptionTextActive: {
        color: colors.primary,
        fontWeight: 'bold',
    },

    // Plan Card Styles
    planCard: {
        marginTop: 10,
        backgroundColor: colors.isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
        padding: 15,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.primary + '33',
        borderStyle: 'dashed',
    },
    planDetailRow: {
        flexDirection: 'row',
        marginBottom: 4,
    },
    planDetailLabel: {
        color: colors.secondary,
        fontSize: 13,
        fontWeight: '600',
    },
    planDetailValue: {
        color: colors.primary,
        fontSize: 13,
        fontWeight: 'bold',
    },
    planDetailDesc: {
        color: colors.secondary,
        fontSize: 12,
        lineHeight: 18,
        marginTop: 4,
    },

    chipScroll: {
        flexDirection: 'row',
    },
    chip: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 25,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        marginRight: 10,
    },
    activeChip: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    chipText: {
        color: colors.secondary,
        fontSize: 14,
    },
    activeChipText: {
        color: colors.buttonPrimaryText,
        fontWeight: 'bold',
    },
    saveButton: {
        backgroundColor: colors.primary,
        padding: 18,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 30,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    saveButtonText: {
        color: colors.buttonPrimaryText,
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    paymentCompletedBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary + '1A',
        paddingVertical: 14,
        borderRadius: 12,
        marginTop: 10,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: colors.primary,
        gap: 8,
    },
    paymentCompletedBtnActive: {
        backgroundColor: colors.success,
        borderColor: colors.success,
    },
    paymentCompletedBtnText: {
        color: colors.primary,
        fontSize: 14,
        fontWeight: 'bold',
    },
    paymentCompletedBtnTextActive: {
        color: colors.buttonPrimaryText,
    },
});
