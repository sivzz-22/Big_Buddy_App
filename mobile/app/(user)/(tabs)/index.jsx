import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions, RefreshControl, TextInput, Modal, Alert, ActivityIndicator } from 'react-native';
import React, { useState, useEffect, useCallback } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../../constants/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '../../../constants/Config';
import { router, useFocusEffect } from 'expo-router';
import { LineChart, BarChart } from 'react-native-chart-kit';

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
    const { colors } = useTheme();
    const [userData, setUserData] = useState(null);
    const [memberData, setMemberData] = useState(null);
    const [attendanceStats, setAttendanceStats] = useState({ present: 0, total: 25, streak: 0 });
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [metricsModalVisible, setMetricsModalVisible] = useState(false);
    const [todayMetrics, setTodayMetrics] = useState({ weight: '', waterIntake: '', steps: '', mood: 'Good' });
    const [historyLogs, setHistoryLogs] = useState([]);
    const [savingMetrics, setSavingMetrics] = useState(false);

    const today = new Date().toISOString().split('T')[0];
    const styles = getStyles(colors);

    // Compute profile completeness (essential details filled by member)
    const isProfileComplete = Boolean(
        memberData?.email && memberData.email.trim() !== '' &&
        memberData?.dob && memberData.dob.trim() !== '' &&
        memberData?.gender && memberData.gender.trim() !== '' &&
        memberData?.bloodGroup && memberData.bloodGroup.trim() !== '' &&
        memberData?.address && memberData.address.trim() !== ''
    );

    const fetchData = async () => {
        try {
            const userJson = await AsyncStorage.getItem('userData');
            const user = JSON.parse(userJson);
            setUserData(user);

            const identifier = user.memberId || user.email || user._id;
            const memberRes = await axios.get(`${API_URL}/members/${identifier}`);
            const memberDoc = memberRes.data;
            setMemberData(memberDoc);

            const attRes = await axios.get(`${API_URL}/attendance?memberId=${memberDoc._id}`);
            const logs = attRes.data;
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

            const histRes = await axios.get(`${API_URL}/daily-logs/history/${memberDoc._id}?limit=14`);
            setHistoryLogs([...histRes.data].sort((a, b) => new Date(a.date) - new Date(b.date)));

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

    useEffect(() => { fetchData(); }, []);

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [])
    );

    const onRefresh = () => { setRefreshing(true); fetchData(); };

    const handleCheckIn = () => {
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
        router.push('/(user)/(tabs)/attendance');
    };

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
            Alert.alert("Saved!", "Today's metrics logged successfully.");
            setMetricsModalVisible(false);
            fetchData();
        } catch (e) {
            Alert.alert("Error", "Could not save metrics.");
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

    // Metrics chart — weight + steps
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

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Hello,</Text>
                    <Text style={styles.userName}>{userData?.name || 'Warrior'} 💪</Text>
                </View>
                <View style={[styles.statusBadge, { borderColor: subStatus.color + '50' }]}>
                    <View style={[styles.statusDot, { backgroundColor: subStatus.color }]} />
                    <Text style={[styles.statusText, { color: subStatus.color }]}>{subStatus.label}</Text>
                </View>
            </View>

            {/* Stats Row */}
            <View style={styles.statsContainer}>
                <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Monthly Presence</Text>
                    <Text style={styles.statValue}>{attendanceStats.present}<Text style={styles.statDen}>/{attendanceStats.total}</Text></Text>
                    <Text style={styles.statSub}>Days</Text>
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

            {/* Standalone Today's Metrics Card (No dropdown, no profile details) */}
            <View style={styles.todayMetricsCard}>
                <View style={styles.todayMetricsHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="analytics" size={20} color={colors.primary} />
                        <Text style={styles.todayMetricsTitle}>TODAY'S METRICS</Text>
                    </View>
                    <Text style={styles.todayDateText}>{today}</Text>
                </View>

                <View style={styles.metricsRow}>
                    <View style={styles.metricChip}>
                        <Ionicons name="scale-outline" size={18} color={colors.primary} />
                        <Text style={styles.metricChipVal}>{todayMetrics.weight ? `${todayMetrics.weight} kg` : '--'}</Text>
                        <Text style={styles.metricChipLabel}>Weight</Text>
                    </View>
                    <View style={styles.metricChip}>
                        <Ionicons name="water-outline" size={18} color="#2196F3" />
                        <Text style={styles.metricChipVal}>{todayMetrics.waterIntake ? `${todayMetrics.waterIntake} L` : '--'}</Text>
                        <Text style={styles.metricChipLabel}>Water</Text>
                    </View>
                    <View style={styles.metricChip}>
                        <MaterialCommunityIcons name="shoe-print" size={18} color="#4CAF50" />
                        <Text style={styles.metricChipVal}>{todayMetrics.steps || '--'}</Text>
                        <Text style={styles.metricChipLabel}>Steps</Text>
                    </View>
                    <View style={styles.metricChip}>
                        <Text style={{ fontSize: 18 }}>{moodEmoji[todayMetrics.mood] || '😊'}</Text>
                        <Text style={styles.metricChipVal}>{todayMetrics.mood}</Text>
                        <Text style={styles.metricChipLabel}>Mood</Text>
                    </View>
                </View>

                <Pressable style={styles.logMetricsBtn} onPress={handleOpenMetrics}>
                    <Ionicons name="add-circle-outline" size={18} color={colors.buttonPrimaryText} />
                    <Text style={styles.logMetricsBtnText}>LOG TODAY'S METRICS</Text>
                </Pressable>
            </View>

            {/* Quick Actions — 2 cards only */}
            <View style={styles.quickActions}>
                <Pressable
                    style={[styles.quickBtn, { backgroundColor: colors.primary }]}
                    onPress={handleCheckIn}
                >
                    <Ionicons name="qr-code-outline" size={28} color="#FFF" />
                    <Text style={styles.quickBtnTitle}>Check-In</Text>
                    <Text style={styles.quickBtnSub}>Scan to mark attendance</Text>
                </Pressable>
                <Pressable
                    style={[styles.quickBtn, { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.primary }]}
                    onPress={handleOpenMetrics}
                >
                    <Ionicons name="analytics-outline" size={28} color={colors.primary} />
                    <Text style={[styles.quickBtnTitle, { color: colors.primary }]}>Metrics</Text>
                    <Text style={[styles.quickBtnSub, { color: colors.secondary }]}>Log daily stats</Text>
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

            {/* Metrics Logger Modal */}
            <Modal visible={metricsModalVisible} transparent animationType="slide" statusBarTranslucent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalTop}>
                            <Text style={styles.modalTitle}>Log Today's Metrics</Text>
                            <Pressable onPress={() => setMetricsModalVisible(false)}>
                                <Ionicons name="close" size={26} color={colors.text} />
                            </Pressable>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={styles.metricsDate}>{today}</Text>

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
                                {savingMetrics
                                    ? <ActivityIndicator color={colors.buttonPrimaryText} />
                                    : <>
                                        <Ionicons name="checkmark-circle" size={20} color={colors.buttonPrimaryText} />
                                        <Text style={styles.saveMetricsBtnText}>SAVE METRICS</Text>
                                    </>
                                }
                            </Pressable>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </ScrollView>
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
    statDen: { fontSize: 14, color: colors.secondary },
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

    // Today's Metrics Standalone Card
    todayMetricsCard: {
        backgroundColor: colors.surface,
        borderRadius: 18,
        padding: 18,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: colors.border,
    },
    todayMetricsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    todayMetricsTitle: {
        fontSize: 13,
        fontWeight: 'bold',
        color: colors.primary,
        letterSpacing: 0.5,
    },
    todayDateText: {
        fontSize: 12,
        color: colors.secondary,
        fontWeight: '500',
    },
    metricsRow: { flexDirection: 'row', gap: 10 },
    metricChip: { flex: 1, backgroundColor: colors.background, borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.border, gap: 4 },
    metricChipVal: { fontSize: 13, fontWeight: 'bold', color: colors.text },
    metricChipLabel: { fontSize: 9, color: colors.secondary, textTransform: 'uppercase' },
    logMetricsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: 10, padding: 12, marginTop: 14, gap: 8 },
    logMetricsBtnText: { color: colors.buttonPrimaryText, fontWeight: 'bold', fontSize: 13 },

    // 2 Quick Action Cards
    quickActions: { flexDirection: 'row', gap: 14, marginBottom: 20 },
    quickBtn: {
        flex: 1, alignItems: 'center', justifyContent: 'center',
        padding: 20, borderRadius: 18, gap: 6,
        elevation: 3, shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4,
    },
    quickBtnTitle: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
    quickBtnSub: { color: 'rgba(255,255,255,0.75)', fontSize: 11, textAlign: 'center' },

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

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: colors.background, borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 25, maxHeight: '85%' },
    modalTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: colors.primary },
    metricsDate: { color: colors.secondary, fontSize: 13, marginBottom: 20 },
    inputRow: { flexDirection: 'row', gap: 12 },
    inputGroup: { flex: 1 },
    metLabel: { color: colors.secondary, fontSize: 12, fontWeight: 'bold', marginBottom: 6, marginTop: 12 },
    metInput: { backgroundColor: colors.surface, borderRadius: 12, padding: 13, color: colors.text, borderWidth: 1, borderColor: colors.border, fontSize: 15 },
    moodRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 8 },
    moodBtn: { flex: 1, minWidth: 60, alignItems: 'center', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    moodBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + '15' },
    moodEmoji: { fontSize: 22 },
    moodLabel: { fontSize: 10, color: colors.secondary, marginTop: 4 },
    saveMetricsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, padding: 17, borderRadius: 14, marginTop: 25, gap: 10, marginBottom: 10 },
    saveMetricsBtnText: { color: colors.buttonPrimaryText, fontWeight: 'bold', fontSize: 15 },
});

export default UserDashboard;
