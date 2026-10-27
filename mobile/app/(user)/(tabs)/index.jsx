import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    Dimensions,
    RefreshControl,
    TextInput,
    Modal,
    Alert,
    ActivityIndicator,
    Animated,
    Platform,
    BackHandler
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { darkTheme } from '../../../constants/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '../../../constants/Config';
import { router, useFocusEffect } from 'expo-router';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { Calendar } from 'react-native-calendars';
import { CameraView, useCameraPermissions } from 'expo-camera';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 70;

// Subscription status derived from member expiry date
const getSubStatus = (member) => {
    if (!member) return { label: 'No Plan', color: '#9E9E9E', days: 0 };
    if (!member.expiryDate) return { label: 'No Plan', color: '#9E9E9E', days: 0 };
    const today = new Date();
    const expiry = new Date(member.expiryDate);
    const days = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    if (days < 0) return { label: 'Expired', color: '#F44336', days: 0 };
    if (days <= 7) return { label: 'Expiring Soon', color: '#FF9800', days };
    if (days <= 30) return { label: 'Active', color: '#4CAF50', days };
    return { label: 'Active', color: '#4CAF50', days };
};

const UserDashboard = () => {
    // Force pure dark theme on user side
    const colors = darkTheme;

    const [userData, setUserData] = useState(null);
    const [memberData, setMemberData] = useState(null);
    const [attendanceStats, setAttendanceStats] = useState({ present: 0, total: 25, streak: 0 });
    const [attendanceMarkedDates, setAttendanceMarkedDates] = useState({});
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);

    // Metrics modal
    const [metricsModalVisible, setMetricsModalVisible] = useState(false);
    const [todayMetrics, setTodayMetrics] = useState({ weight: '', waterIntake: '', steps: '', mood: 'Good' });
    const [historyLogs, setHistoryLogs] = useState([]);
    const [savingMetrics, setSavingMetrics] = useState(false);

    // Fullscreen interactive QR scanner & Access Code states
    const [scanning, setScanning] = useState(false);
    const [torchOn, setTorchOn] = useState(false);
    const [showCodeModal, setShowCodeModal] = useState(false);
    const [accessCode, setAccessCode] = useState('');
    const [marking, setMarking] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();
    const scannedRef = useRef(false);

    // Animated scanner laser line
    const scanLineAnim = useRef(new Animated.Value(0)).current;

    const today = new Date().toISOString().split('T')[0];
    const isTodayMarked = Boolean(attendanceMarkedDates[today]);

    // Profile completeness check
    const isProfileComplete = Boolean(
        memberData?.email && memberData.email.trim() !== '' &&
        memberData?.dob && memberData.dob.trim() !== '' &&
        memberData?.gender && memberData.gender.trim() !== '' &&
        memberData?.bloodGroup && memberData.bloodGroup.trim() !== '' &&
        memberData?.address && memberData.address.trim() !== ''
    );

    // Loop scan line animation when camera is open
    useEffect(() => {
        let anim;
        if (scanning) {
            scanLineAnim.setValue(0);
            anim = Animated.loop(
                Animated.sequence([
                    Animated.timing(scanLineAnim, {
                        toValue: 210,
                        duration: 1800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(scanLineAnim, {
                        toValue: 0,
                        duration: 1800,
                        useNativeDriver: true,
                    }),
                ])
            );
            anim.start();
        }
        return () => {
            if (anim) anim.stop();
        };
    }, [scanning]);

    // Hardware back press listener for Android scanner
    useEffect(() => {
        if (!scanning) return;
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            setScanning(false);
            return true;
        });
        return () => sub.remove();
    }, [scanning]);

    const fetchData = async () => {
        try {
            const userJson = await AsyncStorage.getItem('userData');
            if (!userJson) return;
            const user = JSON.parse(userJson);
            setUserData(user);

            const identifier = user.memberId || user.email || user._id;
            const memberRes = await axios.get(`${API_URL}/members/${identifier}`);
            const memberDoc = memberRes.data;
            setMemberData(memberDoc);

            // Fetch Attendance
            const attRes = await axios.get(`${API_URL}/attendance?memberId=${memberDoc._id}`);
            const logs = attRes.data || [];

            // Calculate streak
            let streak = 0;
            const sorted = [...logs].sort((a, b) => new Date(b.date) - new Date(a.date));
            const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
            if (sorted.length > 0 && (sorted[0].date === today || sorted[0].date === yesterday)) {
                streak = 1;
                for (let i = 1; i < sorted.length; i++) {
                    const curr = new Date(sorted[i - 1].date);
                    const prev = new Date(sorted[i].date);
                    if ((curr - prev) / (1000 * 60 * 60 * 24) === 1) streak++;
                    else break;
                }
            }
            setAttendanceStats({ present: logs.length, total: 25, streak });

            // Build marked dates for Calendar
            const marked = {};
            logs.forEach(att => {
                marked[att.date] = {
                    selected: true,
                    marked: true,
                    selectedColor: colors.primary,
                    dotColor: '#000000',
                };
            });
            setAttendanceMarkedDates(marked);

            // Daily logs history
            const histRes = await axios.get(`${API_URL}/daily-logs/history/${memberDoc._id}?limit=14`);
            setHistoryLogs([...histRes.data].sort((a, b) => new Date(a.date) - new Date(b.date)));

            // Today's metrics
            const todayLog = await axios.get(`${API_URL}/daily-logs?memberId=${memberDoc._id}&date=${today}`);
            if (todayLog.data?.metrics) {
                const m = todayLog.data.metrics;
                setTodayMetrics({
                    weight: m.weight ? String(m.weight) : '',
                    waterIntake: m.waterIntake ? String(m.waterIntake) : '',
                    steps: m.steps ? String(m.steps) : '',
                    mood: m.mood || 'Good'
                });
            }
        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    // Check-In button click: opens fullscreen GPay-style camera scanner
    const handleCheckIn = async () => {
        if (!isProfileComplete) {
            Alert.alert(
                "Profile Incomplete",
                "Please complete your essential profile details (Email, DOB, Gender, Blood Group, Address) before accessing attendance.",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Complete Profile", onPress: () => router.push('/(user)/(tabs)/profile') }
                ]
            );
            return;
        }

        if (isTodayMarked) {
            Alert.alert("Already Checked In", "You have already marked your attendance for today! Keep up the great work. 🔥");
            return;
        }

        if (!permission?.granted) {
            const { granted } = await requestPermission();
            if (!granted) {
                Alert.alert(
                    "Camera Permission",
                    "Camera access is required to scan the gym check-in QR code.",
                    [
                        { text: "Cancel", style: "cancel" },
                        { text: "Enter Code Manually", onPress: () => setShowCodeModal(true) }
                    ]
                );
                return;
            }
        }

        scannedRef.current = false;
        setScanning(true);
    };

    // When QR code is scanned: automatically close scanner and return to Enter Access Code modal
    const handleBarCodeScanned = ({ data }) => {
        if (scannedRef.current) return;
        scannedRef.current = true;

        // Auto-close scanner modal like GPay
        setScanning(false);

        // Immediate transition to Access Code popup
        setTimeout(() => {
            setShowCodeModal(true);
            scannedRef.current = false;
        }, 300);
    };

    // Verify Access Code and mark attendance
    const handleVerifyAndMark = async () => {
        if (!accessCode || accessCode.trim().length === 0) {
            Alert.alert("Access Code Required", "Please enter the daily access code displayed at the gym.");
            return;
        }

        if (attendanceMarkedDates[today]) {
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
                accessCode: accessCode.trim()
            });

            Alert.alert("Success! 🎉", "Your attendance has been marked successfully!");
            setShowCodeModal(false);
            setAccessCode('');
            fetchData();
        } catch (error) {
            Alert.alert("Verification Failed", error.response?.data?.message || "Invalid access code. Please check the screen at gym reception.");
        } finally {
            setMarking(false);
        }
    };

    // Open Metrics logging modal
    const handleOpenMetrics = () => {
        if (!isProfileComplete) {
            Alert.alert(
                "Profile Incomplete",
                "Please complete your essential profile details before logging daily metrics.",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Complete Profile", onPress: () => router.push('/(user)/(tabs)/profile') }
                ]
            );
            return;
        }
        setMetricsModalVisible(true);
    };

    const handleSaveMetrics = async () => {
        setSavingMetrics(true);
        try {
            await axios.post(`${API_URL}/daily-logs`, {
                memberId: memberData._id,
                date: today,
                metrics: {
                    weight: parseFloat(todayMetrics.weight) || 0,
                    waterIntake: parseFloat(todayMetrics.waterIntake) || 0,
                    steps: parseInt(todayMetrics.steps) || 0,
                    mood: todayMetrics.mood
                }
            });
            Alert.alert("Saved! 🎯", "Today's metrics logged successfully.");
            setMetricsModalVisible(false);
            fetchData();
        } catch (e) {
            Alert.alert("Error", "Could not save metrics. Please try again.");
        } finally {
            setSavingMetrics(false);
        }
    };

    // Chart data — last 7 days
    const last7 = historyLogs.slice(-7);
    const chartLabels = last7.length > 0
        ? last7.map(l => l.date?.slice(5) || '')
        : ['Day1', 'Day2', 'Day3', 'Day4', 'Day5', 'Day6', 'Day7'];

    const workoutChartData = {
        labels: chartLabels,
        datasets: [{
            data: last7.length > 0
                ? last7.map(l => l.workoutLogs?.filter(w => w.reps && parseInt(w.reps) > 0).length || 0)
                : [0, 2, 1, 3, 2, 4, 3],
            strokeWidth: 2
        }]
    };

    const dietChartData = {
        labels: chartLabels,
        datasets: [{
            data: last7.length > 0
                ? last7.map(l => {
                    const total = l.dietLogs?.length || 0;
                    const done = l.dietLogs?.filter(d => d.isCompleted).length || 0;
                    return total > 0 ? Math.round((done / total) * 100) : 0;
                })
                : [60, 80, 50, 100, 70, 90, 80],
        }]
    };

    const weightData = historyLogs.filter(l => l.metrics?.weight > 0);
    const weightChartData = {
        labels: weightData.slice(-7).map(l => l.date?.slice(5) || ''),
        datasets: [{ data: weightData.slice(-7).map(l => l.metrics.weight), strokeWidth: 2 }]
    };

    const stepsData = historyLogs.filter(l => l.metrics?.steps > 0);
    const stepsChartData = {
        labels: stepsData.slice(-7).map(l => l.date?.slice(5) || ''),
        datasets: [{ data: stepsData.slice(-7).map(l => Math.round(l.metrics.steps / 1000 * 10) / 10) }]
    };

    // Subscription info
    const subStatus = getSubStatus(memberData);
    const totalDays = 30;
    const progressPct = memberData?.expiryDate
        ? Math.min(100, Math.max(0, Math.round((subStatus.days / totalDays) * 100)))
        : 0;

    const chartConfig = {
        backgroundGradientFrom: colors.surface,
        backgroundGradientTo: colors.surface,
        decimalPlaces: 0,
        color: (opacity = 1) => `${colors.primary}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
        labelColor: () => colors.secondary,
        style: { borderRadius: 16 },
        propsForDots: { r: '4', strokeWidth: '2', stroke: colors.primary }
    };

    const MOODS = ['Great', 'Good', 'Okay', 'Tired', 'Bad'];
    const moodEmoji = { 'Great': '🔥', 'Good': '😊', 'Okay': '😐', 'Tired': '😴', 'Bad': '😞' };

    const styles = getStyles(colors);

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <ScrollView
                style={styles.container}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            >
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Welcome back,</Text>
                    <Text style={styles.userName}>{userData?.name || 'Warrior'} 💪</Text>
                </View>
                <View style={[styles.statusBadge, { borderColor: subStatus.color + '50' }]}>
                    <View style={[styles.statusDot, { backgroundColor: subStatus.color }]} />
                    <Text style={[styles.statusText, { color: subStatus.color }]}>{subStatus.label}</Text>
                </View>
            </View>

            {/* Stats Row — with Days Present */}
            <View style={styles.statsContainer}>
                <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Days Present</Text>
                    <Text style={styles.statValue}>{attendanceStats.present}</Text>
                    <Text style={styles.statSub}>Total visits</Text>
                </View>
                <View style={[styles.statBox, styles.statDivider]}>
                    <Text style={styles.statLabel}>Fire Streak</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Ionicons name="flame" size={22} color="#FF9800" />
                        <Text style={[styles.statValue, { color: '#FF9800' }]}>{attendanceStats.streak}</Text>
                    </View>
                    <Text style={styles.statSub}>Continuous days</Text>
                </View>
                <View style={[styles.statBox, styles.statDivider]}>
                    <Text style={styles.statLabel}>Workout Days</Text>
                    <Text style={[styles.statValue, { color: '#2196F3' }]}>
                        {historyLogs.filter(l => l.workoutLogs?.some(w => w.reps && parseInt(w.reps) > 0)).length}
                    </Text>
                    <Text style={styles.statSub}>This month</Text>
                </View>
            </View>

            {/* Profile Incompletion Restriction Alert */}
            {!isProfileComplete && (
                <View style={styles.restrictionCard}>
                    <View style={styles.restrictionHeader}>
                        <Ionicons name="alert-circle" size={24} color="#FF9800" />
                        <Text style={styles.restrictionTitle}>Profile Details Incomplete</Text>
                    </View>
                    <Text style={styles.restrictionText}>
                        Your account was created by the admin. Please fill in your essential details (Email, DOB, Gender, Blood Group, Address) in your profile to continue using all features.
                    </Text>
                    <Pressable
                        style={styles.restrictionBtn}
                        onPress={() => router.push('/(user)/(tabs)/profile')}
                    >
                        <Text style={styles.restrictionBtnText}>Complete Profile Now</Text>
                        <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                    </Pressable>
                </View>
            )}

            {/* Attendance Calendar in place of old Today's Metrics Card */}
            <View style={styles.calendarCard}>
                <View style={styles.calendarHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="calendar" size={20} color={colors.primary} />
                        <Text style={styles.calendarTitle}>ATTENDANCE CALENDAR</Text>
                    </View>
                    <View style={styles.calendarLegend}>
                        <View style={styles.legendDot} />
                        <Text style={styles.legendText}>Present ({attendanceStats.present})</Text>
                    </View>
                </View>
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
                    markedDates={attendanceMarkedDates}
                    enableSwipeMonths={true}
                />
            </View>

            {/* Quick Actions: Check-In QR & Today's Metrics Option */}
            <View style={styles.quickActions}>
                <Pressable
                    style={[
                        styles.quickBtn,
                        { backgroundColor: isTodayMarked ? colors.surface : colors.primary },
                        isTodayMarked && { borderWidth: 1.5, borderColor: colors.primary }
                    ]}
                    onPress={handleCheckIn}
                >
                    <Ionicons
                        name={isTodayMarked ? "checkmark-done-circle" : "qr-code-outline"}
                        size={28}
                        color={isTodayMarked ? colors.primary : colors.buttonPrimaryText}
                    />
                    <Text style={[styles.quickBtnTitle, { color: isTodayMarked ? colors.primary : colors.buttonPrimaryText }]}>
                        {isTodayMarked ? 'Checked In' : 'Check-In'}
                    </Text>
                    <Text style={[styles.quickBtnSub, { color: isTodayMarked ? colors.secondary : 'rgba(0,0,0,0.7)' }]}>
                        {isTodayMarked ? 'Attendance marked for today' : 'Scan gym QR code'}
                    </Text>
                </Pressable>

                <Pressable
                    style={[styles.quickBtn, { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.primary }]}
                    onPress={handleOpenMetrics}
                >
                    <Ionicons name="analytics-outline" size={28} color={colors.primary} />
                    <Text style={[styles.quickBtnTitle, { color: colors.primary }]}>Today's Metrics</Text>
                    <Text style={[styles.quickBtnSub, { color: colors.secondary }]}>Log weight, water & steps</Text>
                </Pressable>
            </View>

            {/* Subscription Status */}
            <View style={[styles.subscriptionCard, { borderLeftColor: subStatus.color, borderLeftWidth: 4 }]}>
                <View style={styles.subHeaderRow}>
                    <View style={[styles.subIconWrap, { backgroundColor: subStatus.color + '20' }]}>
                        <Ionicons name="card" size={20} color={subStatus.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.subTitle}>Subscription Status</Text>
                        <Text style={[styles.subStatusLabel, { color: subStatus.color }]}>{subStatus.label}</Text>
                    </View>
                    {subStatus.days > 0 && (
                        <View style={[styles.daysBadge, { backgroundColor: subStatus.color + '20' }]}>
                            <Text style={[styles.daysBadgeText, { color: subStatus.color }]}>{subStatus.days}d left</Text>
                        </View>
                    )}
                </View>
                <View style={styles.subInfoRow}>
                    <Text style={styles.subLabel}>Plan</Text>
                    <Text style={styles.subValue}>{memberData?.subscriptionType || 'No Plan'}</Text>
                </View>
                <View style={styles.subInfoRow}>
                    <Text style={styles.subLabel}>Expires</Text>
                    <Text style={[styles.subValue, { color: subStatus.color }]}>
                        {memberData?.expiryDate ? new Date(memberData.expiryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                    </Text>
                </View>
                <View style={styles.progressContainer}>
                    <View style={[styles.progressBar, { width: `${progressPct}%`, backgroundColor: subStatus.color }]} />
                </View>
                <View style={styles.subInfoRow}>
                    <Text style={styles.subLabel}>Workout Plan</Text>
                    <Text style={[styles.subValue, { color: colors.primary }]}>{memberData?.workoutPlan || 'Not Assigned'}</Text>
                </View>
                <View style={styles.subInfoRow}>
                    <Text style={styles.subLabel}>Diet Plan</Text>
                    <Text style={[styles.subValue, { color: '#4CAF50' }]}>{memberData?.dietPlan || 'Not Assigned'}</Text>
                </View>
            </View>

            {/* Metrics Chart — Weight Trend */}
            {weightData.length > 1 && (
                <>
                    <Text style={styles.sectionTitle}>METRICS TREND</Text>
                    <View style={styles.chartCard}>
                        <Text style={styles.chartTitle}>Body Weight (kg)</Text>
                        <LineChart
                            data={weightChartData}
                            width={CHART_WIDTH}
                            height={150}
                            chartConfig={{ ...chartConfig, color: (opacity = 1) => `#FF9800${Math.round(opacity * 255).toString(16).padStart(2, '0')}` }}
                            bezier
                            style={styles.chart}
                            withInnerLines={false}
                            withOuterLines={false}
                        />
                    </View>
                </>
            )}
            {stepsData.length > 1 && (
                <View style={styles.chartCard}>
                    <Text style={styles.chartTitle}>Daily Steps (thousands)</Text>
                    <BarChart
                        data={stepsChartData}
                        width={CHART_WIDTH}
                        height={150}
                        chartConfig={{ ...chartConfig, color: (opacity = 1) => `#4CAF50${Math.round(opacity * 255).toString(16).padStart(2, '0')}` }}
                        style={styles.chart}
                        withInnerLines={false}
                        showValuesOnTopOfBars
                    />
                </View>
            )}

            {/* Workout Progress Chart */}
            <Text style={styles.sectionTitle}>WORKOUT PROGRESS (LAST 7 DAYS)</Text>
            <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Exercises Completed Per Day</Text>
                <LineChart
                    data={workoutChartData}
                    width={CHART_WIDTH}
                    height={150}
                    chartConfig={chartConfig}
                    bezier
                    style={styles.chart}
                    withInnerLines={false}
                    withOuterLines={false}
                />
            </View>

            {/* Diet Adherence Chart */}
            <Text style={styles.sectionTitle}>DIET ADHERENCE (LAST 7 DAYS)</Text>
            <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Meal Completion % Per Day</Text>
                <BarChart
                    data={dietChartData}
                    width={CHART_WIDTH}
                    height={150}
                    chartConfig={{ ...chartConfig, color: (opacity = 1) => `#4CAF50${Math.round(opacity * 255).toString(16).padStart(2, '0')}` }}
                    style={styles.chart}
                    withInnerLines={false}
                    showValuesOnTopOfBars
                    yAxisSuffix="%"
                />
            </View>

            <View style={{ height: 40 }} />
        </ScrollView>

        {/* =========================================================================
            GPAY-STYLE FULLSCREEN AUTOMATIC INTERACTIVE QR SCANNER OVERLAY
            (Rendered in main window outside Modal so camera preview is 100% visible)
           ========================================================================= */}
        {scanning && (
            <View style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 9999, backgroundColor: '#000000' }]}>
                {/* Live Camera Feed */}
                <CameraView
                    style={StyleSheet.absoluteFill}
                    facing="back"
                    enableTorch={torchOn}
                    barcodeScannerSettings={{
                        barcodeTypes: ['qr'],
                    }}
                    onBarcodeScanned={scannedRef.current ? undefined : handleBarCodeScanned}
                />

                {/* Translucent overlay with centered viewfinder reticle */}
                <View style={styles.scannerOverlay}>
                    {/* Top Header Bar */}
                    <View style={styles.scannerHeader}>
                        <Pressable style={styles.scannerIconButton} onPress={() => setScanning(false)}>
                            <Ionicons name="close" size={26} color="#FFFFFF" />
                        </Pressable>
                        <Text style={styles.scannerHeaderTitle}>Scan to Check-In</Text>
                        <Pressable style={styles.scannerIconButton} onPress={() => setTorchOn(prev => !prev)}>
                            <Ionicons name={torchOn ? "flash" : "flash-off"} size={22} color={torchOn ? colors.primary : "#FFFFFF"} />
                        </Pressable>
                    </View>

                    {/* Interactive Reticle Viewfinder (Centered!) */}
                    <View style={styles.scannerCenter}>
                        <View style={styles.viewfinder}>
                            {/* Corner Accents */}
                            <View style={[styles.corner, styles.cornerTL]} />
                            <View style={[styles.corner, styles.cornerTR]} />
                            <View style={[styles.corner, styles.cornerBL]} />
                            <View style={[styles.corner, styles.cornerBR]} />

                            {/* Moving Laser Scan Line */}
                            <Animated.View
                                style={[
                                    styles.laserLine,
                                    {
                                        transform: [{ translateY: scanLineAnim }]
                                    }
                                ]}
                            />
                        </View>
                        <Text style={styles.scannerInstruction}>
                            Align gym QR code within the frame
                        </Text>
                    </View>

                    {/* Bottom Actions Overlay */}
                    <View style={styles.scannerBottom}>
                        <Pressable
                            style={styles.manualCodeBtn}
                            onPress={() => {
                                setScanning(false);
                                setTimeout(() => setShowCodeModal(true), 300);
                            }}
                        >
                            <Ionicons name="keypad-outline" size={20} color="#000000" />
                            <Text style={styles.manualCodeBtnText}>Enter Access Code Manually</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        )}

            {/* =========================================================================
                ACCESS CODE MODAL (POPUP ON DASHBOARD)
               ========================================================================= */}
            <Modal
                transparent
                visible={showCodeModal}
                animationType="fade"
                onRequestClose={() => setShowCodeModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.accessCodeCard}>
                        <View style={styles.accessCodeHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <View style={styles.accessIconWrap}>
                                    <Ionicons name="keypad" size={22} color={colors.primary} />
                                </View>
                                <View>
                                    <Text style={styles.accessCodeTitle}>Enter Access Code</Text>
                                    <Text style={styles.accessCodeSub}>Daily Gym Verification</Text>
                                </View>
                            </View>
                            <Pressable
                                onPress={() => {
                                    setShowCodeModal(false);
                                    setAccessCode('');
                                }}
                                style={{ padding: 4 }}
                            >
                                <Ionicons name="close" size={24} color={colors.text} />
                            </Pressable>
                        </View>

                        <Text style={styles.accessInstructions}>
                            Enter the 4-digit daily access code displayed on the gym reception board.
                        </Text>

                        <TextInput
                            style={styles.accessCodeInput}
                            value={accessCode}
                            onChangeText={setAccessCode}
                            placeholder="• • • •"
                            placeholderTextColor={colors.secondary}
                            keyboardType="number-pad"
                            maxLength={6}
                            autoFocus
                            textAlign="center"
                        />

                        <Pressable
                            style={[styles.verifyButton, marking && { opacity: 0.7 }]}
                            onPress={handleVerifyAndMark}
                            disabled={marking}
                        >
                            {marking ? (
                                <ActivityIndicator color={colors.buttonPrimaryText} />
                            ) : (
                                <>
                                    <Ionicons name="checkmark-circle" size={20} color={colors.buttonPrimaryText} />
                                    <Text style={styles.verifyButtonText}>VERIFY & CHECK-IN</Text>
                                </>
                            )}
                        </Pressable>
                    </View>
                </View>
            </Modal>

            {/* =========================================================================
                TODAY'S METRICS LOGGER MODAL
               ========================================================================= */}
            <Modal visible={metricsModalVisible} transparent animationType="slide" statusBarTranslucent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalTop}>
                            <View>
                                <Text style={styles.modalTitle}>Today's Metrics</Text>
                                <Text style={styles.metricsDate}>{today}</Text>
                            </View>
                            <Pressable onPress={() => setMetricsModalVisible(false)} style={{ padding: 4 }}>
                                <Ionicons name="close" size={26} color={colors.text} />
                            </Pressable>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={styles.inputRow}>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.metLabel}>Weight (kg)</Text>
                                    <TextInput
                                        style={styles.metInput}
                                        value={todayMetrics.weight}
                                        onChangeText={v => setTodayMetrics(p => ({ ...p, weight: v }))}
                                        keyboardType="decimal-pad"
                                        placeholder="e.g. 72.5"
                                        placeholderTextColor={colors.secondary}
                                    />
                                </View>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.metLabel}>Water (Litres)</Text>
                                    <TextInput
                                        style={styles.metInput}
                                        value={todayMetrics.waterIntake}
                                        onChangeText={v => setTodayMetrics(p => ({ ...p, waterIntake: v }))}
                                        keyboardType="decimal-pad"
                                        placeholder="e.g. 2.5"
                                        placeholderTextColor={colors.secondary}
                                    />
                                </View>
                            </View>

                            <Text style={styles.metLabel}>Steps Count</Text>
                            <TextInput
                                style={styles.metInput}
                                value={todayMetrics.steps}
                                onChangeText={v => setTodayMetrics(p => ({ ...p, steps: v }))}
                                keyboardType="number-pad"
                                placeholder="e.g. 8000"
                                placeholderTextColor={colors.secondary}
                            />

                            <Text style={styles.metLabel}>Mood</Text>
                            <View style={styles.moodRow}>
                                {MOODS.map(m => (
                                    <Pressable
                                        key={m}
                                        style={[styles.moodBtn, todayMetrics.mood === m && styles.moodBtnActive]}
                                        onPress={() => setTodayMetrics(p => ({ ...p, mood: m }))}
                                    >
                                        <Text style={styles.moodEmoji}>{moodEmoji[m]}</Text>
                                        <Text style={[styles.moodLabel, todayMetrics.mood === m && { color: colors.primary, fontWeight: 'bold' }]}>{m}</Text>
                                    </Pressable>
                                ))}
                            </View>

                            <Pressable
                                style={[styles.saveMetricsBtn, savingMetrics && { opacity: 0.7 }]}
                                onPress={handleSaveMetrics}
                                disabled={savingMetrics}
                            >
                                {savingMetrics ? (
                                    <ActivityIndicator color={colors.buttonPrimaryText} />
                                ) : (
                                    <>
                                        <Ionicons name="checkmark-circle" size={20} color={colors.buttonPrimaryText} />
                                        <Text style={styles.saveMetricsBtnText}>SAVE METRICS</Text>
                                    </>
                                )}
                            </Pressable>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const getStyles = (colors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 10 },
    greeting: { color: colors.secondary, fontSize: 15 },
    userName: { color: colors.text, fontSize: 22, fontWeight: 'bold' },
    statusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
    statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
    statusText: { fontSize: 12, fontWeight: '700' },

    statsContainer: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 18, padding: 18, marginBottom: 20, borderWidth: 1, borderColor: colors.border },
    statBox: { flex: 1, alignItems: 'center' },
    statDivider: { borderLeftWidth: 1, borderLeftColor: colors.border },
    statLabel: { color: colors.secondary, fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', textAlign: 'center', marginBottom: 4 },
    statValue: { color: colors.primary, fontSize: 22, fontWeight: 'bold' },
    statSub: { color: colors.secondary, fontSize: 10, marginTop: 2 },

    // Restriction Banner
    restrictionCard: {
        backgroundColor: '#FF980018',
        borderColor: '#FF980060',
        borderWidth: 1.5,
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
    },
    restrictionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 6,
    },
    restrictionTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#FF9800',
    },
    restrictionText: {
        fontSize: 12,
        color: colors.text,
        lineHeight: 18,
        marginBottom: 12,
    },
    restrictionBtn: {
        backgroundColor: '#FF9800',
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        alignSelf: 'flex-start',
    },
    restrictionBtnText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: 'bold',
    },

    // Attendance Calendar Card (replacing today's metrics card)
    calendarCard: {
        backgroundColor: colors.surface,
        borderRadius: 18,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: colors.border,
    },
    calendarHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    calendarTitle: {
        fontSize: 13,
        fontWeight: 'bold',
        color: colors.primary,
        letterSpacing: 0.5,
    },
    calendarLegend: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.primary,
    },
    legendText: {
        fontSize: 12,
        color: colors.secondary,
        fontWeight: '600',
    },

    // 2 Quick Action Cards
    quickActions: { flexDirection: 'row', gap: 14, marginBottom: 20 },
    quickBtn: {
        flex: 1, alignItems: 'center', justifyContent: 'center',
        padding: 18, borderRadius: 18, gap: 6,
        elevation: 3, shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4,
    },
    quickBtnTitle: { fontSize: 15, fontWeight: 'bold' },
    quickBtnSub: { fontSize: 11, textAlign: 'center' },

    // Subscription Card
    subscriptionCard: {
        backgroundColor: colors.surface, borderRadius: 16,
        padding: 18, borderWidth: 1, borderColor: colors.border,
        marginBottom: 20, gap: 10,
    },
    subHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    subIconWrap: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    subTitle: { fontSize: 15, fontWeight: 'bold', color: colors.text },
    subStatusLabel: { fontSize: 12, fontWeight: '700', marginTop: 2 },
    daysBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
    daysBadgeText: { fontSize: 12, fontWeight: 'bold' },
    subInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    subLabel: { color: colors.secondary, fontSize: 13 },
    subValue: { color: colors.text, fontSize: 13, fontWeight: '600' },
    progressContainer: { height: 6, backgroundColor: colors.background, borderRadius: 3, overflow: 'hidden' },
    progressBar: { height: '100%', borderRadius: 3 },

    sectionTitle: { color: colors.secondary, fontSize: 12, fontWeight: 'bold', letterSpacing: 1, marginBottom: 12, marginTop: 5 },
    chartCard: { backgroundColor: colors.surface, borderRadius: 18, padding: 15, marginBottom: 20, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
    chartTitle: { color: colors.secondary, fontSize: 12, fontWeight: 'bold', marginBottom: 12 },
    chart: { borderRadius: 12, marginLeft: -10 },

    // Modal Overlays
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },

    // Access Code Modal
    accessCodeCard: {
        backgroundColor: colors.surface,
        borderRadius: 24,
        padding: 24,
        width: '100%',
        maxWidth: 380,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
    },
    accessCodeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        marginBottom: 14,
    },
    accessIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.primary + '20',
        justifyContent: 'center',
        alignItems: 'center',
    },
    accessCodeTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
    },
    accessCodeSub: {
        fontSize: 12,
        color: colors.secondary,
    },
    accessInstructions: {
        fontSize: 13,
        color: colors.secondary,
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: 20,
    },
    accessCodeInput: {
        backgroundColor: colors.background,
        borderWidth: 2,
        borderColor: colors.primary,
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 20,
        width: '100%',
        fontSize: 32,
        fontWeight: 'bold',
        color: colors.primary,
        letterSpacing: 10,
        marginBottom: 24,
    },
    verifyButton: {
        backgroundColor: colors.primary,
        width: '100%',
        paddingVertical: 15,
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    verifyButtonText: {
        color: colors.buttonPrimaryText,
        fontWeight: 'bold',
        fontSize: 14,
        letterSpacing: 0.5,
    },

    // Metrics Modal
    modalContent: { backgroundColor: colors.surface, borderRadius: 25, padding: 25, width: '100%', maxHeight: '85%', borderWidth: 1, borderColor: colors.border },
    modalTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: colors.primary },
    metricsDate: { color: colors.secondary, fontSize: 13, marginTop: 2 },
    inputRow: { flexDirection: 'row', gap: 12 },
    inputGroup: { flex: 1 },
    metLabel: { color: colors.secondary, fontSize: 12, fontWeight: 'bold', marginBottom: 6, marginTop: 12 },
    metInput: { backgroundColor: colors.background, borderRadius: 12, padding: 13, color: colors.text, borderWidth: 1, borderColor: colors.border, fontSize: 15 },
    moodRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 8 },
    moodBtn: { flex: 1, minWidth: 60, alignItems: 'center', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
    moodBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + '15' },
    moodEmoji: { fontSize: 22 },
    moodLabel: { fontSize: 10, color: colors.secondary, marginTop: 4 },
    saveMetricsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, padding: 16, borderRadius: 14, marginTop: 25, gap: 10, marginBottom: 10 },
    saveMetricsBtnText: { color: colors.buttonPrimaryText, fontWeight: 'bold', fontSize: 15 },

    // Fullscreen GPay-like Interactive QR Scanner
    scannerFullscreen: {
        flex: 1,
        backgroundColor: '#000000',
    },
    scannerOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? 50 : 60,
        paddingBottom: 40,
        backgroundColor: 'transparent',
    },
    scannerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        paddingHorizontal: 4,
    },
    scannerIconButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.65)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    scannerHeaderTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    scannerCenter: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
    },
    viewfinder: {
        width: 260,
        height: 260,
        position: 'relative',
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: 'transparent',
    },
    corner: {
        position: 'absolute',
        width: 32,
        height: 32,
        borderColor: colors.primary,
    },
    cornerTL: {
        top: 0,
        left: 0,
        borderTopWidth: 4,
        borderLeftWidth: 4,
        borderTopLeftRadius: 16,
    },
    cornerTR: {
        top: 0,
        right: 0,
        borderTopWidth: 4,
        borderRightWidth: 4,
        borderTopRightRadius: 16,
    },
    cornerBL: {
        bottom: 0,
        left: 0,
        borderBottomWidth: 4,
        borderLeftWidth: 4,
        borderBottomLeftRadius: 16,
    },
    cornerBR: {
        bottom: 0,
        right: 0,
        borderBottomWidth: 4,
        borderRightWidth: 4,
        borderBottomRightRadius: 16,
    },
    laserLine: {
        height: 3,
        width: '100%',
        backgroundColor: colors.primary,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 10,
        elevation: 6,
    },
    scannerInstruction: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
        marginTop: 24,
        textAlign: 'center',
        backgroundColor: 'rgba(0,0,0,0.65)',
        paddingHorizontal: 18,
        paddingVertical: 9,
        borderRadius: 20,
        overflow: 'hidden',
    },
    scannerBottom: {
        width: '100%',
        alignItems: 'center',
        paddingBottom: 20,
    },
    manualCodeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: colors.primary,
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 24,
        elevation: 4,
    },
    manualCodeBtnText: {
        color: colors.buttonPrimaryText,
        fontWeight: 'bold',
        fontSize: 14,
    },
});

export default UserDashboard;
