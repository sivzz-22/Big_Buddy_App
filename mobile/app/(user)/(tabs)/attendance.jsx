import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, Dimensions, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../constants/ThemeContext';
import axios from 'axios';
import { API_URL } from '../../../constants/Config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Calendar } from 'react-native-calendars';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { TextInput, Modal } from 'react-native';

import { router, useFocusEffect } from 'expo-router';

const { width } = Dimensions.get('window');

const UserAttendance = () => {
    const { colors, isDarkMode } = useTheme();
    const [loading, setLoading] = useState(true);
    const [marking, setMarking] = useState(false);
    const [attendanceData, setAttendanceData] = useState({});
    const [userData, setUserData] = useState(null);
    const [memberData, setMemberData] = useState(null);
    const [stats, setStats] = useState({ present: 0, streak: 0 });
    const [scanning, setScanning] = useState(false);
    const [showCodeModal, setShowCodeModal] = useState(false);
    const [accessCode, setAccessCode] = useState('');
    const [permission, requestPermission] = useCameraPermissions();
    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    };

    const styles = getStyles(colors);

    const isProfileComplete = Boolean(
        memberData?.email && memberData.email.trim() !== '' &&
        memberData?.dob && memberData.dob.trim() !== '' &&
        memberData?.gender && memberData.gender.trim() !== '' &&
        memberData?.bloodGroup && memberData.bloodGroup.trim() !== '' &&
        memberData?.address && memberData.address.trim() !== ''
    );

    const fetchData = async () => {
        setLoading(true);
        try {
            const userJson = await AsyncStorage.getItem('userData');
            const user = JSON.parse(userJson);
            setUserData(user);

            // Fetch Member by memberId, email, or _id
            const identifier = user.memberId || user.email || user._id;
            const memberRes = await axios.get(`${API_URL}/members/${identifier}`);
            const member = memberRes.data;
            setMemberData(member);

            // Fetch Presence for this month
            const res = await axios.get(`${API_URL}/attendance?memberId=${member._id}`);
            
            const markedDates = {};
            let presentCount = 0;
            res.data.forEach(att => {
                markedDates[att.date] = { 
                    selected: true, 
                    marked: true, 
                    selectedColor: colors.primary,
                    dotColor: 'white'
                };
                presentCount++;
            });
            setAttendanceData(markedDates);
            setStats({ present: presentCount, streak: calculateStreak(res.data) });

        } catch (error) {
            console.error("Fetch attendance error:", error);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [])
    );

    const calculateStreak = (data) => {
        // Simple streak calculation logic could go here
        return 5; // Mock
    };

    useEffect(() => {
        fetchData();
    }, []);

    const startScanning = async () => {
        if (!permission?.granted) {
            const { granted } = await requestPermission();
            if (!granted) {
                Alert.alert("Permission Denied", "Camera permission is required to scan the QR code.");
                return;
            }
        }
        setScanning(true);
    };

    const handleBarCodeScanned = ({ data }) => {
        if (data === 'GYM_ATTENDANCE_CHECK_IN') {
            setScanning(false);
            setShowCodeModal(true);
        } else {
            Alert.alert("Invalid QR", "This is not a valid Gym Check-in QR code.");
            setScanning(false);
        }
    };

    const handleVerifyAndMark = async () => {
        if (!accessCode) {
            Alert.alert("Error", "Please enter the access code.");
            return;
        }

        const today = new Date().toISOString().split('T')[0];
        if (attendanceData[today]) {
            Alert.alert("Already Marked", "You have already marked your attendance for today.");
            setShowCodeModal(false);
            setAccessCode('');
            return;
        }

        setMarking(true);
        try {
            const hours = new Date().getHours();
            const session = hours < 12 ? 'Morning' : 'Evening';
            
            await axios.post(`${API_URL}/attendance`, {
                memberId: memberData._id,
                session: session,
                accessCode: accessCode
            });
            
            Alert.alert("Success", "Attendance marked successfully!");
            setShowCodeModal(false);
            setAccessCode('');
            fetchData();
        } catch (error) {
            Alert.alert("Error", error.response?.data?.message || "Invalid code or connection error.");
        } finally {
            setMarking(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center' }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (!loading && memberData && !isProfileComplete) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 25 }]}>
                <View style={{
                    width: 72, height: 72, borderRadius: 36,
                    backgroundColor: '#FF980020',
                    justifyContent: 'center', alignItems: 'center',
                    marginBottom: 16
                }}>
                    <Ionicons name="lock-closed" size={36} color="#FF9800" />
                </View>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text, textAlign: 'center', marginBottom: 8 }}>
                    Profile Completion Required
                </Text>
                <Text style={{ fontSize: 14, color: colors.secondary, textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>
                    Your admin created your basic account. Please complete your essential profile details (Email, DOB, Gender, Blood Group, Address) to unlock attendance check-in.
                </Text>
                <Pressable
                    style={{
                        backgroundColor: colors.primary,
                        borderRadius: 12,
                        paddingVertical: 14,
                        paddingHorizontal: 24,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8
                    }}
                    onPress={() => router.push('/(user)/(tabs)/profile')}
                >
                    <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 15 }}>Complete Profile Now</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFF" />
                </Pressable>
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        >
            {/* Action Card */}
            <View style={styles.markCard}>
                <Text style={styles.markTitle}>Daily Check-in</Text>
                <Text style={styles.markSub}>Mark your attendance to stay on track</Text>
                
                <Pressable 
                    style={[styles.markButton, marking && { opacity: 0.7 }]} 
                    onPress={startScanning}
                    disabled={marking}
                >
                    {marking ? (
                        <ActivityIndicator color={colors.buttonPrimaryText} />
                    ) : (
                        <>
                            <Ionicons name="qr-code-outline" size={60} color={colors.buttonPrimaryText} />
                            <Text style={styles.markButtonText}>
                                {attendanceData[new Date().toISOString().split('T')[0]] ? 'ALREADY MARKED' : 'SCAN TO CHECK-IN'}
                            </Text>
                        </>
                    )}
                </Pressable>
                
                <Text style={styles.currentTime}>
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date().toDateString()}
                </Text>
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
                <View style={styles.statBox}>
                    <Text style={styles.statValue}>{stats.present}</Text>
                    <Text style={styles.statLabel}>Days Present</Text>
                </View>
                <View style={styles.statBox}>
                    <Text style={[styles.statValue, { color: '#FF9800' }]}>{stats.streak}</Text>
                    <Text style={styles.statLabel}>Current Streak</Text>
                </View>
            </View>

            {/* Calendar */}
            <View style={styles.calendarContainer}>
                <Text style={styles.sectionTitle}>Attendance History</Text>
                <Calendar
                    theme={{
                        backgroundColor: colors.surface,
                        calendarBackground: colors.surface,
                        textSectionTitleColor: colors.secondary,
                        selectedDayBackgroundColor: colors.primary,
                        selectedDayTextColor: colors.buttonPrimaryText,
                        todayTextColor: colors.primary,
                        dayTextColor: colors.text,
                        textDisabledColor: colors.border,
                        monthTextColor: colors.text,
                        indicatorColor: colors.primary,
                        arrowColor: colors.primary,
                    }}
                    markedDates={attendanceData}
                    enableSwipeMonths={true}
                />
            </View>

            <View style={{ height: 40 }} />

            {/* Camera Scanner View */}
            {scanning && (
                <View style={StyleSheet.absoluteFillObject}>
                    <CameraView
                        style={StyleSheet.absoluteFillObject}
                        onBarcodeScanned={handleBarCodeScanned}
                        barcodeScannerSettings={{
                            barcodeTypes: ['qr'],
                        }}
                    />
                    <View style={styles.scannerOverlay}>
                        <View style={styles.scannerFrame} />
                        <Text style={styles.scannerText}>Scan the Gym Wall QR Code</Text>
                        <Pressable style={styles.cancelScan} onPress={() => setScanning(false)}>
                            <Text style={styles.cancelScanText}>Cancel</Text>
                        </Pressable>
                    </View>
                </View>
            )}

            {/* Access Code Modal */}
            <Modal transparent visible={showCodeModal} animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Enter Access Code</Text>
                        <Text style={styles.modalSub}>Please enter the daily code shown in the gym</Text>
                        
                        <TextInput
                            style={styles.codeInput}
                            value={accessCode}
                            onChangeText={setAccessCode}
                            placeholder="e.g. 1234"
                            placeholderTextColor={colors.secondary}
                            keyboardType="number-pad"
                            maxLength={4}
                        />

                        <Pressable 
                            style={[styles.verifyButton, marking && { opacity: 0.7 }]}
                            onPress={handleVerifyAndMark}
                            disabled={marking}
                        >
                            {marking ? <ActivityIndicator color="#FFF" /> : <Text style={styles.verifyButtonText}>VERIFY & CHECK-IN</Text>}
                        </Pressable>

                        <Pressable style={styles.closeModal} onPress={() => setShowCodeModal(false)}>
                            <Text style={styles.closeModalText}>Close</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
};

const getStyles = (colors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        padding: 20,
    },
    markCard: {
        backgroundColor: colors.surface,
        borderRadius: 20,
        padding: 30,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 20,
    },
    markTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 5,
    },
    markSub: {
        fontSize: 14,
        color: colors.secondary,
        marginBottom: 25,
        textAlign: 'center',
    },
    markButton: {
        backgroundColor: colors.primary,
        width: 180,
        height: 180,
        borderRadius: 90,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        marginBottom: 20,
    },
    markButtonText: {
        color: colors.buttonPrimaryText,
        fontSize: 14,
        fontWeight: 'bold',
        marginTop: 10,
        textAlign: 'center',
    },
    currentTime: {
        color: colors.secondary,
        fontSize: 12,
        fontWeight: '500',
    },
    statsRow: {
        flexDirection: 'row',
        gap: 15,
        marginBottom: 20,
    },
    statBox: {
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: 15,
        padding: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.primary,
    },
    statLabel: {
        fontSize: 12,
        color: colors.secondary,
        marginTop: 5,
    },
    calendarContainer: {
        backgroundColor: colors.surface,
        borderRadius: 20,
        padding: 15,
        borderWidth: 1,
        borderColor: colors.border,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 15,
        marginLeft: 5,
    },
    scannerOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    scannerFrame: {
        width: 250,
        height: 250,
        borderWidth: 2,
        borderColor: colors.primary,
        borderRadius: 20,
    },
    scannerText: {
        color: '#FFF',
        marginTop: 20,
        fontSize: 16,
        fontWeight: 'bold',
    },
    cancelScan: {
        marginTop: 40,
        padding: 15,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 10,
    },
    cancelScanText: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: colors.surface,
        width: '100%',
        borderRadius: 20,
        padding: 25,
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 10,
    },
    modalSub: {
        fontSize: 14,
        color: colors.secondary,
        marginBottom: 20,
        textAlign: 'center',
    },
    codeInput: {
        width: '100%',
        height: 55,
        backgroundColor: colors.background,
        borderRadius: 12,
        paddingHorizontal: 20,
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        letterSpacing: 10,
        color: colors.primary,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 20,
    },
    verifyButton: {
        backgroundColor: colors.primary,
        width: '100%',
        padding: 15,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 15,
    },
    verifyButtonText: {
        color: colors.buttonPrimaryText,
        fontWeight: 'bold',
        fontSize: 16,
    },
    closeModal: {
        padding: 10,
    },
    closeModalText: {
        color: colors.secondary,
        fontWeight: '500',
    }
});

export default UserAttendance;
