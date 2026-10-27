import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    Pressable,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    RefreshControl
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useTheme } from '../../../../constants/ThemeContext';
import { API_URL } from '../../../../constants/Config';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const GENDERS = ['Male', 'Female', 'Other'];

export default function UserProfile() {
    const { colors } = useTheme();
    const styles = getStyles(colors);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [member, setMember] = useState(null);

    // Form fields
    const [formData, setFormData] = useState({
        email: '',
        dob: '',
        gender: '',
        bloodGroup: '',
        address: '',
        height: '',
        weight: '',
        waistSize: '',
        description: '',
    });

    // Check if mandatory fields are complete
    const isComplete = Boolean(
        formData.email?.trim() &&
        formData.dob?.trim() &&
        formData.gender?.trim() &&
        formData.bloodGroup?.trim() &&
        formData.address?.trim()
    );

    const loadProfile = async () => {
        try {
            const userJson = await AsyncStorage.getItem('userData');
            if (!userJson) return;
            const user = JSON.parse(userJson);

            // Fetch latest member record by memberId, email, or _id
            const identifier = user.memberId || user.email || user._id;
            const res = await axios.get(`${API_URL}/members/${identifier}`);
            const m = res.data;
            setMember(m);

            setFormData({
                email: m.email || '',
                dob: m.dob || '',
                gender: m.gender || '',
                bloodGroup: m.bloodGroup || '',
                address: m.address || '',
                height: m.height ? String(m.height) : '',
                weight: m.weight ? String(m.weight) : '',
                waistSize: m.waistSize ? String(m.waistSize) : '',
                description: m.description || '',
            });
        } catch (error) {
            console.error('Error fetching member profile:', error);
            Alert.alert('Error', 'Could not load your profile details.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadProfile();
        }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadProfile();
    };

    const handleSave = async () => {
        // Validate mandatory fields
        const missing = [];
        if (!formData.email?.trim()) missing.push('Email Address');
        if (!formData.dob?.trim()) missing.push('Date of Birth (DOB)');
        if (!formData.gender?.trim()) missing.push('Gender');
        if (!formData.bloodGroup?.trim()) missing.push('Blood Group');
        if (!formData.address?.trim()) missing.push('Residential Address');

        if (missing.length > 0) {
            Alert.alert(
                'Mandatory Fields Required',
                `Please fill in the following required profile details to continue:\n\n• ${missing.join('\n• ')}`
            );
            return;
        }

        // Email basic format check
        if (!formData.email.includes('@') || !formData.email.includes('.')) {
            Alert.alert('Invalid Email', 'Please enter a valid email address.');
            return;
        }

        setSaving(true);
        try {
            const memberIdentifier = member?._id || member?.memberID;
            const res = await axios.put(`${API_URL}/members/${memberIdentifier}`, {
                email: formData.email.trim(),
                dob: formData.dob.trim(),
                gender: formData.gender.trim(),
                bloodGroup: formData.bloodGroup.trim(),
                address: formData.address.trim(),
                height: formData.height.trim(),
                weight: formData.weight.trim(),
                waistSize: formData.waistSize.trim(),
                description: formData.description.trim(),
            });

            // Update local storage so rest of app knows profile is complete
            const userJson = await AsyncStorage.getItem('userData');
            if (userJson) {
                const user = JSON.parse(userJson);
                user.email = formData.email.trim();
                user.isProfileComplete = true;
                await AsyncStorage.setItem('userData', JSON.stringify(user));
            }

            setMember(res.data);
            Alert.alert(
                'Profile Completed! 🎉',
                'Your profile details have been saved successfully. You now have full access to all features in Big Buddy!',
                [
                    {
                        text: 'Go to Dashboard',
                        onPress: () => router.replace('/(user)/(tabs)'),
                    },
                    { text: 'Stay Here', style: 'cancel' }
                ]
            );
        } catch (error) {
            console.error('Error saving profile:', error);
            Alert.alert('Error', error.response?.data?.message || 'Failed to update profile. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to log out of Big Buddy?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        await AsyncStorage.removeItem('userToken');
                        await AsyncStorage.removeItem('userData');
                        router.replace('/login');
                    }
                }
            ]
        );
    };

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ color: colors.secondary, marginTop: 12 }}>Loading profile...</Text>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                }
            >
                {/* Header Card */}
                <View style={styles.headerCard}>
                    <View style={styles.avatarWrap}>
                        <Text style={styles.avatarText}>
                            {member?.name ? member.name.charAt(0).toUpperCase() : 'U'}
                        </Text>
                    </View>
                    <View style={styles.headerInfo}>
                        <Text style={styles.memberName}>{member?.name || 'Member'}</Text>
                        <Text style={styles.memberIdText}>ID: {member?.memberID}</Text>
                        <View style={styles.planBadge}>
                            <Ionicons name="shield-checkmark" size={14} color={colors.primary} />
                            <Text style={styles.planBadgeText}>
                                {member?.subscriptionType || 'General Member'}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Profile Status Banner */}
                {isComplete ? (
                    <View style={[styles.statusBanner, { backgroundColor: '#4CAF5018', borderColor: '#4CAF5050' }]}>
                        <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.statusBannerTitle, { color: '#4CAF50' }]}>Profile Complete</Text>
                            <Text style={styles.statusBannerSub}>All mandatory details are up to date. Full app access unlocked.</Text>
                        </View>
                    </View>
                ) : (
                    <View style={[styles.statusBanner, { backgroundColor: '#FF980018', borderColor: '#FF980060' }]}>
                        <Ionicons name="alert-circle" size={26} color="#FF9800" />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.statusBannerTitle, { color: '#FF9800' }]}>Profile Incomplete (Required)</Text>
                            <Text style={styles.statusBannerSub}>
                                Please complete the mandatory details marked with (*) below to continue using all features of Big Buddy.
                            </Text>
                        </View>
                    </View>
                )}

                {/* Section 1: Gym Account Info (Admin Managed) */}
                <Text style={styles.sectionTitle}>ACCOUNT DETAILS</Text>
                <View style={styles.card}>
                    <View style={styles.readOnlyRow}>
                        <View style={styles.readOnlyCol}>
                            <Text style={styles.readOnlyLabel}>FULL NAME</Text>
                            <Text style={styles.readOnlyValue}>{member?.name || '--'}</Text>
                        </View>
                        <View style={styles.readOnlyCol}>
                            <Text style={styles.readOnlyLabel}>MEMBER ID</Text>
                            <Text style={styles.readOnlyValue}>{member?.memberID || '--'}</Text>
                        </View>
                    </View>
                    <View style={[styles.readOnlyRow, { marginTop: 12 }]}>
                        <View style={styles.readOnlyCol}>
                            <Text style={styles.readOnlyLabel}>PHONE NUMBER</Text>
                            <Text style={styles.readOnlyValue}>{member?.phone || '--'}</Text>
                        </View>
                        <View style={styles.readOnlyCol}>
                            <Text style={styles.readOnlyLabel}>MEMBERSHIP STATUS</Text>
                            <Text style={[styles.readOnlyValue, { color: member?.status === 'Active' ? '#4CAF50' : colors.error }]}>
                                {member?.status || 'Active'}
                            </Text>
                        </View>
                    </View>
                    <Text style={styles.readOnlyNote}>
                        * Contact gym administration if you need to update name, phone, or membership plan.
                    </Text>
                </View>

                {/* Section 2: Mandatory Details to Fill */}
                <Text style={styles.sectionTitle}>ESSENTIAL DETAILS (*)</Text>
                <View style={styles.card}>
                    {/* Email */}
                    <View style={styles.inputGroup}>
                        <View style={styles.labelRow}>
                            <Text style={styles.label}>EMAIL ADDRESS *</Text>
                            {!formData.email?.trim() && <Text style={styles.missingBadge}>Required</Text>}
                        </View>
                        <TextInput
                            style={[styles.input, !formData.email?.trim() && styles.inputWarning]}
                            value={formData.email}
                            onChangeText={(t) => setFormData(prev => ({ ...prev, email: t }))}
                            placeholder="e.g. john@example.com"
                            placeholderTextColor={colors.secondary}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </View>

                    {/* DOB & Gender */}
                    <View style={styles.inputGroup}>
                        <View style={styles.labelRow}>
                            <Text style={styles.label}>DATE OF BIRTH (DD/MM/YYYY) *</Text>
                            {!formData.dob?.trim() && <Text style={styles.missingBadge}>Required</Text>}
                        </View>
                        <TextInput
                            style={[styles.input, !formData.dob?.trim() && styles.inputWarning]}
                            value={formData.dob}
                            onChangeText={(t) => setFormData(prev => ({ ...prev, dob: t }))}
                            placeholder="DD/MM/YYYY (e.g. 15/08/1998)"
                            placeholderTextColor={colors.secondary}
                        />
                    </View>

                    {/* Gender Chips */}
                    <View style={styles.inputGroup}>
                        <View style={styles.labelRow}>
                            <Text style={styles.label}>GENDER *</Text>
                            {!formData.gender?.trim() && <Text style={styles.missingBadge}>Required</Text>}
                        </View>
                        <View style={styles.chipRow}>
                            {GENDERS.map(g => {
                                const selected = formData.gender === g;
                                return (
                                    <Pressable
                                        key={g}
                                        style={[styles.chip, selected && styles.chipSelected]}
                                        onPress={() => setFormData(prev => ({ ...prev, gender: g }))}
                                    >
                                        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                                            {g}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>

                    {/* Blood Group Chips */}
                    <View style={styles.inputGroup}>
                        <View style={styles.labelRow}>
                            <Text style={styles.label}>BLOOD GROUP *</Text>
                            {!formData.bloodGroup?.trim() && <Text style={styles.missingBadge}>Required</Text>}
                        </View>
                        <View style={styles.chipRow}>
                            {BLOOD_GROUPS.map(bg => {
                                const selected = formData.bloodGroup === bg;
                                return (
                                    <Pressable
                                        key={bg}
                                        style={[styles.bgChip, selected && styles.chipSelected]}
                                        onPress={() => setFormData(prev => ({ ...prev, bloodGroup: bg }))}
                                    >
                                        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                                            {bg}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>

                    {/* Residential Address */}
                    <View style={styles.inputGroup}>
                        <View style={styles.labelRow}>
                            <Text style={styles.label}>RESIDENTIAL ADDRESS *</Text>
                            {!formData.address?.trim() && <Text style={styles.missingBadge}>Required</Text>}
                        </View>
                        <TextInput
                            style={[styles.input, styles.textArea, !formData.address?.trim() && styles.inputWarning]}
                            value={formData.address}
                            onChangeText={(t) => setFormData(prev => ({ ...prev, address: t }))}
                            placeholder="Full residential address..."
                            placeholderTextColor={colors.secondary}
                            multiline
                            numberOfLines={3}
                        />
                    </View>
                </View>

                {/* Section 3: Physical Stats (Optional) */}
                <Text style={styles.sectionTitle}>PHYSICAL STATS & HEALTH NOTES</Text>
                <View style={styles.card}>
                    <View style={styles.row}>
                        <View style={styles.oneThird}>
                            <Text style={styles.label}>HEIGHT (cm)</Text>
                            <TextInput
                                style={styles.input}
                                value={formData.height}
                                onChangeText={(t) => setFormData(prev => ({ ...prev, height: t }))}
                                placeholder="175"
                                placeholderTextColor={colors.secondary}
                                keyboardType="numeric"
                            />
                        </View>
                        <View style={styles.oneThird}>
                            <Text style={styles.label}>WEIGHT (kg)</Text>
                            <TextInput
                                style={styles.input}
                                value={formData.weight}
                                onChangeText={(t) => setFormData(prev => ({ ...prev, weight: t }))}
                                placeholder="70"
                                placeholderTextColor={colors.secondary}
                                keyboardType="numeric"
                            />
                        </View>
                        <View style={styles.oneThird}>
                            <Text style={styles.label}>WAIST (in)</Text>
                            <TextInput
                                style={styles.input}
                                value={formData.waistSize}
                                onChangeText={(t) => setFormData(prev => ({ ...prev, waistSize: t }))}
                                placeholder="32"
                                placeholderTextColor={colors.secondary}
                                keyboardType="numeric"
                            />
                        </View>
                    </View>

                    <View style={[styles.inputGroup, { marginTop: 12 }]}>
                        <Text style={styles.label}>MEDICAL HISTORY / FITNESS GOALS</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            value={formData.description}
                            onChangeText={(t) => setFormData(prev => ({ ...prev, description: t }))}
                            placeholder="Any injuries, allergies, medications, or fitness targets..."
                            placeholderTextColor={colors.secondary}
                            multiline
                            numberOfLines={3}
                        />
                    </View>
                </View>

                {/* Save Button */}
                <Pressable
                    style={[styles.saveButton, saving && { opacity: 0.7 }]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    {saving ? (
                        <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                        <>
                            <Ionicons name="save-outline" size={20} color="#FFF" />
                            <Text style={styles.saveButtonText}>
                                {isComplete ? 'UPDATE PROFILE' : 'SAVE & COMPLETE PROFILE'}
                            </Text>
                        </>
                    )}
                </Pressable>

                {/* Logout Button */}
                <Pressable style={styles.logoutBtn} onPress={handleLogout}>
                    <Ionicons name="log-out-outline" size={20} color={colors.error} />
                    <Text style={styles.logoutBtnText}>Log Out of Big Buddy</Text>
                </Pressable>
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
        padding: 16,
        paddingBottom: 40,
    },
    headerCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 18,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    avatarWrap: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    avatarText: {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    headerInfo: {
        flex: 1,
    },
    memberName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
    },
    memberIdText: {
        fontSize: 13,
        color: colors.secondary,
        marginTop: 2,
    },
    planBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: colors.primary + '18',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        alignSelf: 'flex-start',
        marginTop: 6,
    },
    planBadgeText: {
        fontSize: 12,
        color: colors.primary,
        fontWeight: '600',
    },
    statusBanner: {
        borderRadius: 12,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
        borderWidth: 1,
    },
    statusBannerTitle: {
        fontSize: 15,
        fontWeight: 'bold',
    },
    statusBannerSub: {
        fontSize: 12,
        color: colors.secondary,
        marginTop: 2,
        lineHeight: 16,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.secondary,
        letterSpacing: 1,
        marginBottom: 8,
        marginLeft: 4,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: 14,
        padding: 16,
        marginBottom: 18,
        borderWidth: 1,
        borderColor: colors.border,
    },
    readOnlyRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    readOnlyCol: {
        flex: 1,
    },
    readOnlyLabel: {
        fontSize: 11,
        color: colors.secondary,
        fontWeight: '600',
        marginBottom: 3,
    },
    readOnlyValue: {
        fontSize: 14,
        color: colors.text,
        fontWeight: '600',
    },
    readOnlyNote: {
        fontSize: 11,
        color: colors.secondary,
        fontStyle: 'italic',
        marginTop: 12,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: colors.border + '60',
    },
    inputGroup: {
        marginBottom: 14,
    },
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    label: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.secondary,
        letterSpacing: 0.5,
    },
    missingBadge: {
        fontSize: 11,
        color: '#FF9800',
        fontWeight: '600',
    },
    input: {
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 14,
        color: colors.text,
    },
    inputWarning: {
        borderColor: '#FF980090',
        backgroundColor: '#FF980008',
    },
    textArea: {
        height: 70,
        textAlignVertical: 'top',
        paddingTop: 10,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
    },
    bgChip: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 18,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        minWidth: 46,
        alignItems: 'center',
    },
    chipSelected: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    chipText: {
        fontSize: 13,
        color: colors.text,
        fontWeight: '500',
    },
    chipTextSelected: {
        color: '#FFFFFF',
        fontWeight: 'bold',
    },
    row: {
        flexDirection: 'row',
        gap: 10,
    },
    oneThird: {
        flex: 1,
    },
    saveButton: {
        backgroundColor: colors.primary,
        borderRadius: 12,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 6,
        marginBottom: 14,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.error + '40',
        backgroundColor: colors.error + '10',
    },
    logoutBtnText: {
        color: colors.error,
        fontSize: 14,
        fontWeight: '600',
    },
});
