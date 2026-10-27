import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    Pressable,
    Image,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { useTheme } from '../../../constants/ThemeContext';
import { API_URL } from '../../../constants/Config';

const BLOOD_GROUPS = ['A+', 'B+', 'O+', 'AB+', 'A-', 'B-', 'O-', 'AB-'];
const GENDERS = ['Male', 'Female', 'Other'];

export default function UserProfile() {
    const { colors } = useTheme();
    const styles = getStyles(colors);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [member, setMember] = useState(null);

    // Form fields — matches admin add member fields
    const [formData, setFormData] = useState({
        photo: null,
        name: '',
        memberID: '',
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
    });

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

            const identifier = user.memberId || user.email || user._id;
            const res = await axios.get(`${API_URL}/members/${identifier}`);
            const m = res.data;
            setMember(m);

            setFormData({
                photo: m.photo || null,
                name: m.name || '',
                memberID: m.memberID || '',
                phone: m.phone || '',
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

    const handlePickImage = () => {
        Alert.alert(
            "Profile Photo",
            "Choose a method to update your profile photo",
            [
                {
                    text: "Take Photo",
                    onPress: async () => {
                        const { status } = await ImagePicker.requestCameraPermissionsAsync();
                        if (status !== 'granted') {
                            Alert.alert("Permission needed", "Camera permission is required to take photos.");
                            return;
                        }
                        const result = await ImagePicker.launchCameraAsync({
                            allowsEditing: true,
                            aspect: [1, 1],
                            quality: 0.5,
                            base64: true,
                        });
                        if (!result.canceled) {
                            const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
                            setFormData(prev => ({ ...prev, photo: base64 }));
                        }
                    }
                },
                {
                    text: "Choose from Library",
                    onPress: async () => {
                        const result = await ImagePicker.launchImageLibraryAsync({
                            mediaTypes: ['images'],
                            allowsEditing: true,
                            aspect: [1, 1],
                            quality: 0.5,
                            base64: true,
                        });
                        if (!result.canceled) {
                            const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
                            setFormData(prev => ({ ...prev, photo: base64 }));
                        }
                    }
                },
                ...(formData.photo ? [{
                    text: "Remove Photo",
                    style: "destructive",
                    onPress: () => setFormData(prev => ({ ...prev, photo: null }))
                }] : []),
                { text: "Cancel", style: "cancel" }
            ]
        );
    };

    const handleSave = async () => {
        const missing = [];
        if (!formData.email?.trim()) missing.push('Email Address');
        if (!formData.dob?.trim()) missing.push('Date of Birth (DOB)');
        if (!formData.gender?.trim()) missing.push('Gender');
        if (!formData.bloodGroup?.trim()) missing.push('Blood Group');
        if (!formData.address?.trim()) missing.push('Residential Address');

        if (missing.length > 0) {
            Alert.alert(
                'Required Fields (*)',
                `Please complete the following required profile details:\n\n• ${missing.join('\n• ')}`
            );
            return;
        }

        if (!formData.email.includes('@') || !formData.email.includes('.')) {
            Alert.alert('Invalid Email', 'Please enter a valid email address.');
            return;
        }

        setSaving(true);
        try {
            const memberIdentifier = member?._id || member?.memberID;
            const res = await axios.put(`${API_URL}/members/${memberIdentifier}`, {
                photo: formData.photo,
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

            // Refresh AsyncStorage userData
            const userJson = await AsyncStorage.getItem('userData');
            if (userJson) {
                const user = JSON.parse(userJson);
                user.email = formData.email.trim();
                user.isProfileComplete = true;
                await AsyncStorage.setItem('userData', JSON.stringify(user));
            }

            setMember(res.data);
            Alert.alert(
                'Profile Saved! 🎉',
                'Your profile has been updated successfully. Full app access is unlocked!',
                [
                    { text: 'Go to Dashboard', onPress: () => router.replace('/(user)/(tabs)') },
                    { text: 'OK', style: 'cancel' }
                ]
            );
        } catch (error) {
            console.error('Error saving profile:', error);
            Alert.alert('Error', error.response?.data?.message || 'Failed to update profile.');
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = () => {
        Alert.alert(
            "Logout",
            "Are you sure you want to log out?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Log Out",
                    style: "destructive",
                    onPress: async () => {
                        await AsyncStorage.removeItem('userToken');
                        await AsyncStorage.removeItem('userData');
                        router.replace('/login');
                    }
                }
            ]
        );
    };

    const renderInput = (label, field, placeholder, keyboardType = 'default', multiline = false, numberOfLines = 1) => (
        <View style={styles.inputGroup}>
            <Text style={styles.label}>{label}</Text>
            <TextInput
                style={[
                    styles.input,
                    multiline && {
                        height: numberOfLines > 1 ? 80 : 50,
                        textAlignVertical: 'top',
                        paddingTop: 12
                    }
                ]}
                value={formData[field]}
                onChangeText={(t) => setFormData(prev => ({ ...prev, [field]: t }))}
                placeholder={placeholder}
                placeholderTextColor={colors.secondary}
                keyboardType={keyboardType}
                multiline={multiline}
                numberOfLines={numberOfLines}
            />
        </View>
    );

    const renderSelect = (label, field, options) => (
        <View style={styles.inputGroup}>
            <Text style={styles.label}>{label}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {options.map((opt, index) => {
                    const active = formData[field] === opt;
                    return (
                        <Pressable
                            key={`${opt}-${index}`}
                            style={[styles.chip, active && styles.activeChip]}
                            onPress={() => setFormData(prev => ({ ...prev, [field]: opt }))}
                        >
                            <Text style={[styles.chipText, active && styles.activeChipText]}>
                                {opt}
                            </Text>
                        </Pressable>
                    );
                })}
            </ScrollView>
        </View>
    );

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
                keyboardShouldPersistTaps="handled"
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                }
            >
                {/* Header / Member Info Card — matches admin profile styling */}
                <View style={styles.header}>
                    <View style={styles.avatarContainer}>
                        <Pressable style={styles.avatar} onPress={handlePickImage}>
                            {formData.photo ? (
                                <Image source={{ uri: formData.photo }} style={styles.avatarImage} />
                            ) : (
                                <Text style={styles.avatarText}>
                                    {member?.name ? member.name.charAt(0).toUpperCase() : 'U'}
                                </Text>
                            )}
                        </Pressable>
                        <Pressable style={styles.editBadge} onPress={handlePickImage}>
                            <Ionicons name="camera" size={15} color="#FFF" />
                        </Pressable>
                    </View>

                    <Text style={styles.name}>{member?.name || 'Member'}</Text>
                    <Text style={styles.role}>
                        Member • {member?.status || 'Active'}
                    </Text>

                    <View style={styles.infoChips}>
                        <View style={styles.infoChip}>
                            <Ionicons name="card-outline" size={14} color={colors.secondary} />
                            <Text style={styles.infoChipText}>ID: {member?.memberID}</Text>
                        </View>
                        <View style={styles.infoChip}>
                            <Ionicons name="call-outline" size={14} color={colors.secondary} />
                            <Text style={styles.infoChipText}>{member?.phone || '--'}</Text>
                        </View>
                        <View style={styles.infoChip}>
                            <Ionicons name="shield-checkmark-outline" size={14} color={colors.primary} />
                            <Text style={[styles.infoChipText, { color: colors.primary, fontWeight: 'bold' }]}>
                                {member?.subscriptionType || 'General Member'}
                            </Text>
                        </View>
                    </View>

                    {formData.address ? (
                        <View style={styles.addressBox}>
                            <Ionicons name="location-outline" size={16} color={colors.primary} />
                            <Text style={styles.addressText} numberOfLines={2}>
                                {formData.address}
                            </Text>
                        </View>
                    ) : null}
                </View>

                {/* Quick Stats Grid — matches admin profile statsGrid */}
                <View style={styles.statsGrid}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>
                            {formData.height ? `${formData.height} cm` : '--'}
                        </Text>
                        <Text style={styles.statLabel}>Height</Text>
                    </View>
                    <View style={styles.verticalLine} />
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>
                            {formData.weight ? `${formData.weight} kg` : '--'}
                        </Text>
                        <Text style={styles.statLabel}>Weight</Text>
                    </View>
                    <View style={styles.verticalLine} />
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>
                            {formData.bloodGroup || '--'}
                        </Text>
                        <Text style={styles.statLabel}>Blood</Text>
                    </View>
                    <View style={styles.verticalLine} />
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>
                            {formData.waistSize ? `${formData.waistSize} in` : '--'}
                        </Text>
                        <Text style={styles.statLabel}>Waist</Text>
                    </View>
                </View>

                {/* Profile Status Banner */}
                {isComplete ? (
                    <View style={[styles.statusBanner, { backgroundColor: '#4CAF5015', borderColor: '#4CAF5040' }]}>
                        <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.statusBannerTitle, { color: '#4CAF50' }]}>Profile Complete</Text>
                            <Text style={styles.statusBannerSub}>All required details are filled. Full app access unlocked.</Text>
                        </View>
                    </View>
                ) : (
                    <View style={[styles.statusBanner, { backgroundColor: '#FF980018', borderColor: '#FF980060' }]}>
                        <Ionicons name="alert-circle" size={26} color="#FF9800" />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.statusBannerTitle, { color: '#FF9800' }]}>Profile Incomplete (*)</Text>
                            <Text style={styles.statusBannerSub}>
                                Please complete all fields marked with (*) below to continue using all features of Big Buddy.
                            </Text>
                        </View>
                    </View>
                )}

                {/* Form Section 1: Personal Details (same as admin add member page) */}
                <Text style={styles.sectionHeader}>Personal Details</Text>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>FULL NAME</Text>
                    <TextInput
                        style={[styles.input, styles.readOnlyInput]}
                        value={formData.name}
                        editable={false}
                    />
                </View>

                <View style={styles.row}>
                    <View style={styles.halfWidth}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>MEMBER ID</Text>
                            <TextInput
                                style={[styles.input, styles.readOnlyInput]}
                                value={formData.memberID}
                                editable={false}
                            />
                        </View>
                    </View>
                    <View style={styles.halfWidth}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>PHONE NUMBER</Text>
                            <TextInput
                                style={[styles.input, styles.readOnlyInput]}
                                value={formData.phone}
                                editable={false}
                            />
                        </View>
                    </View>
                </View>

                {renderInput('EMAIL ADDRESS *', 'email', 'e.g. john@example.com', 'email-address')}

                <View style={styles.row}>
                    <View style={[styles.oneThirdWidth, { flex: 2 }]}>
                        {renderInput('DOB *', 'dob', 'DD/MM/YYYY')}
                    </View>
                    <View style={styles.oneThirdWidth}>
                        {renderInput('BLOOD GROUP *', 'bloodGroup', 'e.g. O+')}
                    </View>
                </View>

                {renderSelect('GENDER *', 'gender', GENDERS)}

                {renderInput('ADDRESS *', 'address', 'Full Residential Address', 'default', true, 3)}

                {/* Form Section 2: Physical Details (same as admin add member page) */}
                <Text style={styles.sectionHeader}>Physical Details & Notes</Text>

                <View style={styles.row}>
                    <View style={styles.oneThirdWidth}>
                        {renderInput('HEIGHT (cm)', 'height', '175', 'numeric')}
                    </View>
                    <View style={styles.oneThirdWidth}>
                        {renderInput('WEIGHT (kg)', 'weight', '70', 'numeric')}
                    </View>
                    <View style={styles.oneThirdWidth}>
                        {renderInput('WAIST (in)', 'waistSize', '32', 'numeric')}
                    </View>
                </View>

                {renderInput('DESCRIPTION / MEDICAL NOTES', 'description', 'Any injuries, medications, fitness goals...', 'default', true, 3)}

                {/* Save Button — matches admin add.jsx */}
                <Pressable
                    style={[styles.saveButton, saving && { opacity: 0.7 }]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    {saving ? (
                        <ActivityIndicator color={colors.buttonPrimaryText} />
                    ) : (
                        <Text style={styles.saveButtonText}>
                            {isComplete ? 'UPDATE PROFILE' : 'SAVE & COMPLETE PROFILE'}
                        </Text>
                    )}
                </Pressable>

                {/* Logout Button */}
                <Pressable style={styles.logoutBtn} onPress={handleLogout}>
                    <Ionicons name="log-out-outline" size={20} color={colors.error} />
                    <Text style={styles.logoutText}>Log Out</Text>
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
        padding: 20,
        paddingBottom: 50,
    },

    // Header Card — matching admin profile
    header: {
        alignItems: 'center',
        paddingVertical: 24,
        paddingHorizontal: 16,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 18,
        marginBottom: 16,
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: 12,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: colors.primary,
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    avatarText: {
        fontSize: 38,
        fontWeight: 'bold',
        color: colors.primary,
    },
    editBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: colors.primary,
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: colors.surface,
    },
    name: {
        fontSize: 22,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 4,
    },
    role: {
        fontSize: 14,
        color: colors.primary,
        fontWeight: '600',
        marginBottom: 10,
    },
    infoChips: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 10,
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    infoChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 5,
        borderWidth: 1,
        borderColor: colors.border,
    },
    infoChipText: {
        color: colors.secondary,
        fontSize: 12,
    },
    addressBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 15,
        marginTop: 4,
    },
    addressText: {
        color: colors.secondary,
        fontSize: 13,
        textAlign: 'center',
    },

    // Stats Grid — matching admin profile
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        backgroundColor: colors.surface,
        paddingVertical: 16,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 16,
        marginBottom: 16,
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.text,
    },
    statLabel: {
        fontSize: 11,
        color: colors.secondary,
        marginTop: 2,
        textTransform: 'uppercase',
    },
    verticalLine: {
        width: 1,
        height: '60%',
        backgroundColor: colors.border,
    },

    // Status Banner
    statusBanner: {
        borderRadius: 14,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 20,
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

    // Form Section Headers & Inputs — matching admin add member page
    sectionHeader: {
        color: colors.primary,
        fontSize: 18,
        fontWeight: '600',
        marginTop: 10,
        marginBottom: 18,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        paddingBottom: 8,
    },
    inputGroup: {
        marginBottom: 18,
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
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        fontSize: 15,
    },
    readOnlyInput: {
        opacity: 0.75,
        backgroundColor: colors.background,
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

    // Chips — matching admin add member page
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

    // Save Button — matching admin add.jsx
    saveButton: {
        backgroundColor: colors.primary,
        padding: 17,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 25,
        marginBottom: 16,
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

    // Logout Button — matching admin profile logoutBtn
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: colors.surface,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.error + '40',
        marginBottom: 20,
    },
    logoutText: {
        color: colors.error,
        fontWeight: 'bold',
        fontSize: 15,
    },
});
