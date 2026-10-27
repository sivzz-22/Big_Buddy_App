import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, Pressable, TextInput, Modal, Dimensions, RefreshControl } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../../constants/ThemeContext';
import axios from 'axios';
import { API_URL } from '../../../constants/Config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { Calendar } from 'react-native-calendars';
import { router, useFocusEffect } from 'expo-router';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 70;

const UserWorkout = () => {
    const { colors } = useTheme();
    const [loading, setLoading] = useState(true);
    const [plan, setPlan] = useState(null);
    const [memberData, setMemberData] = useState(null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [workoutLogs, setWorkoutLogs] = useState([]);
    const [saving, setSaving] = useState(false);
    const [showCalendar, setShowCalendar] = useState(false);
    const [historyLogs, setHistoryLogs] = useState([]);
    const [workoutStreak, setWorkoutStreak] = useState(0);
    const [refreshing, setRefreshing] = useState(false);

    const today = new Date().toISOString().split('T')[0];
    const isEditable = selectedDate >= today;

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

            const identifier = user.memberId || user.email || user._id;
            const memberRes = await axios.get(`${API_URL}/members/${identifier}`);
            const member = memberRes.data;
            setMemberData(member);

            // Fetch history logs for charts & streak
            const histRes = await axios.get(`${API_URL}/daily-logs/history/${member._id}?limit=30`);
            const sorted = [...histRes.data].sort((a, b) => new Date(a.date) - new Date(b.date));
            setHistoryLogs(sorted);

            // Calculate workout streak
            const today = new Date().toISOString().split('T')[0];
            const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
            const workoutDays = histRes.data
                .filter(l => l.workoutLogs?.some(w => w.reps && parseInt(w.reps) > 0))
                .map(l => l.date)
                .sort((a, b) => new Date(b) - new Date(a));
            let streak = 0;
            if (workoutDays.length > 0 && (workoutDays[0] === today || workoutDays[0] === yesterday)) {
                streak = 1;
                for (let i = 1; i < workoutDays.length; i++) {
                    const curr = new Date(workoutDays[i - 1]);
                    const prev = new Date(workoutDays[i]);
                    if ((curr - prev) / 86400000 === 1) streak++;
                    else break;
                }
            }
            setWorkoutStreak(streak);

            if (member.workoutPlan) {
                const plansRes = await axios.get(`${API_URL}/workout-plans`);
                const matchedPlan = plansRes.data.find(
                    p => p.title?.toLowerCase() === member.workoutPlan?.toLowerCase()
                );

                if (matchedPlan) {
                    setPlan(matchedPlan);
                    await fetchLogsForDate(member._id, selectedDate, matchedPlan);
                }
            }
        } catch (error) {
            console.error("Fetch workout error:", error.response?.data || error.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchLogsForDate = async (memberId, date, currentPlan) => {
        try {
            const logRes = await axios.get(`${API_URL}/daily-logs?memberId=${memberId}&date=${date}`);
            if (logRes.data && logRes.data.workoutLogs?.length > 0) {
                setWorkoutLogs(logRes.data.workoutLogs);
            } else {
                const p = currentPlan || plan;
                if (p) {
                    const exercises = getExercisesList(p);
                    setWorkoutLogs(exercises.map(ex => ({
                        exercise: ex.name,
                        reps: '0',
                        sets: '0',
                        weight: '0'
                    })));
                } else {
                    setWorkoutLogs([]);
                }
            }
        } catch (e) {
            console.error("Error fetching logs for date:", e);
        }
    };

    // Helper: get exercises from plan
    const getExercisesList = (p) => {
        if (p.exercises && p.exercises.length > 0) return p.exercises;
        if (p.routine) {
            return p.routine.split('\n').filter(l => l.trim()).map(l => ({
                name: l.trim(), sets: '', reps: '', kg: ''
            }));
        }
        return [];
    };

    useEffect(() => { fetchData(); }, []);

    // When date changes, reload logs
    const handleDateSelect = async (date) => {
        setSelectedDate(date);
        setShowCalendar(false);
        if (memberData && plan) {
            await fetchLogsForDate(memberData._id, date, plan);
        }
    };

    const handleSaveLogs = async () => {
        setSaving(true);
        try {
            await axios.post(`${API_URL}/daily-logs`, {
                memberId: memberData._id,
                date: selectedDate,
                workoutLogs: workoutLogs
            });
            Alert.alert("Success! 💪", `Workout saved for ${selectedDate}`);
            // Refresh history
            const histRes = await axios.get(`${API_URL}/daily-logs/history/${memberData._id}?limit=30`);
            const sorted = [...histRes.data].sort((a, b) => new Date(a.date) - new Date(b.date));
            setHistoryLogs(sorted);
        } catch (error) {
            Alert.alert("Error", "Could not save logs.");
        } finally {
            setSaving(false);
        }
    };

    const updateLog = (index, field, value) => {
        const newLogs = [...workoutLogs];
        newLogs[index][field] = value;
        setWorkoutLogs(newLogs);
    };

    // ── Chart Data ──────────────────────────────────────────────────────
    const last7 = historyLogs.slice(-7);
    const chartLabels = last7.length > 0
        ? last7.map(l => l.date?.slice(5) || '')
        : ['Day1', 'Day2', 'Day3', 'Day4', 'Day5', 'Day6', 'Day7'];

    const exercisesCompleted = last7.map(l =>
        l.workoutLogs?.filter(w => w.reps && parseInt(w.reps) > 0).length || 0
    );
    const defaultExData = [0, 2, 1, 3, 2, 4, 3];

    const totalSetsData = last7.map(l => {
        const sets = l.workoutLogs?.reduce((sum, w) => sum + (parseInt(w.sets) || 0), 0) || 0;
        return sets;
    });

    const workoutCountData = {
        labels: chartLabels,
        datasets: [{ data: last7.length > 0 ? exercisesCompleted : defaultExData, strokeWidth: 2 }]
    };

    const setsChartData = {
        labels: chartLabels,
        datasets: [{ data: last7.length > 0 ? totalSetsData : [0, 5, 3, 8, 6, 10, 7] }]
    };

    const chartConfig = {
        backgroundGradientFrom: colors.surface,
        backgroundGradientTo: colors.surface,
        decimalPlaces: 0,
        color: (opacity = 1) => `${colors.primary}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
        labelColor: () => colors.secondary,
        style: { borderRadius: 16 },
        propsForDots: { r: '4', strokeWidth: '2', stroke: colors.primary }
    };

    // Marked dates for calendar - show which days have logs
    const markedDates = {};
    historyLogs.forEach(l => {
        const hasData = l.workoutLogs?.some(w => w.reps && parseInt(w.reps) > 0);
        markedDates[l.date] = {
            marked: hasData,
            dotColor: colors.primary,
            selected: l.date === selectedDate,
            selectedColor: colors.primary + '40',
        };
    });
    markedDates[selectedDate] = {
        ...(markedDates[selectedDate] || {}),
        selected: true,
        selectedColor: colors.primary,
    };

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [])
    );

    const completedCount = workoutLogs.filter(l => l.reps && l.reps !== '0').length;

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
                    Your admin created your basic account. Please complete your essential profile details (Email, DOB, Gender, Blood Group, Address) to unlock your workout plan.
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

    if (!plan) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="barbell-outline" size={80} color={colors.secondary} />
                <Text style={styles.noPlanTitle}>No Plan Assigned</Text>
                <Text style={styles.noPlanSub}>Please contact your trainer to assign a workout plan.</Text>
                <Pressable style={styles.retryBtn} onPress={fetchData}>
                    <Text style={styles.retryText}>REFRESH</Text>
                </Pressable>
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        >
            {/* Header Card */}
            <View style={styles.headerCard}>
                <View style={styles.headerInfo}>
                    <Text style={styles.headerSubtitle}>ASSIGNED PLAN</Text>
                    <Text style={styles.planTitle}>{plan.title}</Text>
                    <View style={styles.tagRow}>
                        <View style={[styles.tag, { backgroundColor: '#FF572220' }]}>
                            <Text style={[styles.tagText, { color: '#FF5722' }]}>{plan.level}</Text>
                        </View>
                        <View style={[styles.tag, { backgroundColor: colors.primary + '20' }]}>
                            <Text style={[styles.tagText, { color: colors.primary }]}>{plan.duration}</Text>
                        </View>
                    </View>
                </View>
                <MaterialCommunityIcons name="arm-flex" size={50} color={colors.primary} />
            </View>

            {/* Streak Card */}
            <View style={styles.streakCard}>
                <View style={styles.streakItem}>
                    <Ionicons name="flame" size={24} color="#FF9800" />
                    <Text style={styles.streakVal}>{workoutStreak}</Text>
                    <Text style={styles.streakLabel}>Workout Streak</Text>
                </View>
                <View style={styles.streakDivider} />
                <View style={styles.streakItem}>
                    <Ionicons name="barbell" size={24} color={colors.primary} />
                    <Text style={styles.streakVal}>{historyLogs.filter(l => l.workoutLogs?.some(w => w.reps && parseInt(w.reps) > 0)).length}</Text>
                    <Text style={styles.streakLabel}>Days Worked Out</Text>
                </View>
                <View style={styles.streakDivider} />
                <View style={styles.streakItem}>
                    <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                    <Text style={styles.streakVal}>{completedCount}/{workoutLogs.length}</Text>
                    <Text style={styles.streakLabel}>Today's Done</Text>
                </View>
            </View>

            {/* Date Selector */}
            <View style={styles.logHeader}>
                <Text style={styles.sectionTitle}>WORKOUT TRACKER</Text>
                <Pressable style={styles.dateSelector} onPress={() => setShowCalendar(true)}>
                    <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                    <Text style={styles.dateText}>{selectedDate}</Text>
                    <Ionicons name="chevron-down" size={14} color={colors.primary} />
                </Pressable>
            </View>

            {/* Excel Grid */}
            <View style={styles.excelContainer}>
                <View style={styles.excelHeaderRow}>
                    <Text style={[styles.excelHeaderText, { flex: 3 }]}>EXERCISE</Text>
                    <Text style={[styles.excelHeaderText, { flex: 1 }]}>REPS</Text>
                    <Text style={[styles.excelHeaderText, { flex: 1 }]}>SETS</Text>
                    <Text style={[styles.excelHeaderText, { flex: 1 }]}>KG</Text>
                </View>

                {workoutLogs.map((log, index) => (
                    <View key={index} style={[styles.excelRow, index % 2 === 0 && styles.excelRowAlt]}>
                        <View style={[{ flex: 3 }, styles.exerciseLabelContainer]}>
                            <View style={[styles.exDot, log.reps && log.reps !== '0' && { backgroundColor: '#4CAF50' }]} />
                            <Text style={styles.exerciseTitle} numberOfLines={2}>{log.exercise}</Text>
                        </View>
                        <TextInput
                            style={[styles.excelInput, { flex: 1 }, !isEditable && { color: colors.secondary, backgroundColor: 'transparent' }]}
                            value={log.reps}
                            onChangeText={v => isEditable && updateLog(index, 'reps', v)}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor={colors.secondary}
                            editable={isEditable}
                        />
                        <TextInput
                            style={[styles.excelInput, { flex: 1 }, !isEditable && { color: colors.secondary, backgroundColor: 'transparent' }]}
                            value={log.sets}
                            onChangeText={v => isEditable && updateLog(index, 'sets', v)}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor={colors.secondary}
                            editable={isEditable}
                        />
                        <TextInput
                            style={[styles.excelInput, { flex: 1 }, !isEditable && { color: colors.secondary, backgroundColor: 'transparent' }]}
                            value={log.weight}
                            onChangeText={v => isEditable && updateLog(index, 'weight', v)}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor={colors.secondary}
                            editable={isEditable}
                        />
                    </View>
                ))}

                {workoutLogs.length === 0 && (
                    <View style={{ padding: 20, alignItems: 'center' }}>
                        <Text style={{ color: colors.secondary }}>No exercises in this plan for {selectedDate}.</Text>
                    </View>
                )}
            </View>

            {/* Summary Row */}
            <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                    <Text style={styles.summaryVal}>{workoutLogs.length}</Text>
                    <Text style={styles.summaryLabel}>Exercises</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                    <Text style={styles.summaryVal}>{completedCount}</Text>
                    <Text style={styles.summaryLabel}>Done</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                    <Text style={styles.summaryVal}>{plan.duration}</Text>
                    <Text style={styles.summaryLabel}>Duration</Text>
                </View>
            </View>

            {/* Save Button - only show for today/future */}
            {isEditable && (
            <Pressable
                style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                onPress={handleSaveLogs}
                disabled={saving}
            >
                {saving ? (
                    <ActivityIndicator color="#FFF" />
                ) : (
                    <>
                        <Ionicons name="save-outline" size={20} color="#FFF" />
                        <Text style={styles.saveBtnText}>SAVE PROGRESS FOR {selectedDate}</Text>
                    </>
                )}
            </Pressable>
            )}
            {!isEditable && (
                <View style={[styles.saveBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}>
                    <Ionicons name="lock-closed-outline" size={18} color={colors.secondary} />
                    <Text style={[styles.saveBtnText, { color: colors.secondary }]}>PAST DATE — VIEW ONLY</Text>
                </View>
            )}

            {/* ── PROGRESS CHARTS ── */}
            <Text style={styles.chartSectionTitle}>📊 WORKOUT PROGRESS (LAST 7 DAYS)</Text>

            <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Exercises Completed Per Day</Text>
                <LineChart
                    data={workoutCountData}
                    width={CHART_WIDTH}
                    height={160}
                    chartConfig={chartConfig}
                    bezier
                    style={styles.chart}
                    withInnerLines={false}
                    withOuterLines={false}
                />
            </View>

            <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Total Sets Completed Per Day</Text>
                <BarChart
                    data={setsChartData}
                    width={CHART_WIDTH}
                    height={160}
                    chartConfig={{ ...chartConfig, color: (opacity = 1) => `#FF5722${Math.round(opacity * 255).toString(16).padStart(2, '0')}` }}
                    style={styles.chart}
                    withInnerLines={false}
                    showValuesOnTopOfBars
                />
            </View>

            {/* Workout Day History */}
            <Text style={styles.chartSectionTitle}>📅 WORKOUT HISTORY</Text>
            <View style={styles.historyContainer}>
                {historyLogs
                    .filter(l => l.workoutLogs?.some(w => w.reps && parseInt(w.reps) > 0))
                    .slice(-10)
                    .reverse()
                    .map((log, i) => {
                        const done = log.workoutLogs.filter(w => w.reps && parseInt(w.reps) > 0).length;
                        return (
                            <Pressable
                                key={i}
                                style={[styles.historyRow, log.date === selectedDate && { borderColor: colors.primary }]}
                                onPress={() => handleDateSelect(log.date)}
                            >
                                <View>
                                    <Text style={styles.historyDate}>{log.date}</Text>
                                    <Text style={styles.historySub}>{done} exercises completed</Text>
                                </View>
                                <View style={[styles.historyBadge, { backgroundColor: colors.primary + '20' }]}>
                                    <Text style={[styles.historyBadgeText, { color: colors.primary }]}>{done} ✓</Text>
                                </View>
                            </Pressable>
                        );
                    })}
                {historyLogs.filter(l => l.workoutLogs?.some(w => w.reps && parseInt(w.reps) > 0)).length === 0 && (
                    <Text style={{ color: colors.secondary, textAlign: 'center', padding: 20 }}>No workout history yet. Start logging! 💪</Text>
                )}
            </View>

            <View style={{ height: 60 }} />

            {/* Calendar Date Picker Modal */}
            <Modal
                visible={showCalendar}
                transparent
                animationType="slide"
                statusBarTranslucent
            >
                <Pressable style={styles.calModalOverlay} onPress={() => setShowCalendar(false)}>
                    <View style={styles.calModalContent}>
                        <View style={styles.calModalHeader}>
                            <Text style={styles.calModalTitle}>Select Date</Text>
                            <Pressable onPress={() => setShowCalendar(false)}>
                                <Ionicons name="close" size={26} color={colors.text} />
                            </Pressable>
                        </View>
                        <Calendar
                            onDayPress={(day) => handleDateSelect(day.dateString)}
                            markedDates={markedDates}
                            theme={{
                                backgroundColor: colors.surface,
                                calendarBackground: colors.surface,
                                textSectionTitleColor: colors.secondary,
                                selectedDayBackgroundColor: colors.primary,
                                selectedDayTextColor: '#FFF',
                                todayTextColor: colors.primary,
                                dayTextColor: colors.text,
                                textDisabledColor: colors.border,
                                monthTextColor: colors.text,
                                arrowColor: colors.primary,
                                dotColor: colors.primary,
                                selectedDotColor: '#FFF',
                            }}
                            maxDate={new Date().toISOString().split('T')[0]}
                        />
                    </View>
                </Pressable>
            </Modal>
        </ScrollView>
    );
};

const getStyles = (colors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 20 },
    headerCard: {
        backgroundColor: colors.surface, borderRadius: 20, padding: 25,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        borderWidth: 1, borderColor: colors.border, marginBottom: 15,
    },
    headerInfo: { flex: 1 },
    planTitle: { fontSize: 24, fontWeight: 'bold', color: colors.text, marginBottom: 10 },
    tagRow: { flexDirection: 'row', gap: 10 },
    tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    tagText: { fontSize: 12, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 10, color: colors.secondary, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 5 },

    streakCard: {
        flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 16,
        padding: 16, marginBottom: 20, borderWidth: 1, borderColor: colors.border, alignItems: 'center',
    },
    streakItem: { flex: 1, alignItems: 'center', gap: 4 },
    streakDivider: { width: 1, height: 40, backgroundColor: colors.border },
    streakVal: { fontSize: 20, fontWeight: 'bold', color: colors.text },
    streakLabel: { fontSize: 10, color: colors.secondary, textAlign: 'center', textTransform: 'uppercase' },

    logHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 15, paddingHorizontal: 5,
    },
    sectionTitle: { fontSize: 14, fontWeight: 'bold', color: colors.secondary, letterSpacing: 1 },
    dateSelector: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: colors.surface, paddingHorizontal: 12,
        paddingVertical: 7, borderRadius: 12, borderWidth: 1, borderColor: colors.primary,
    },
    dateText: { fontSize: 13, color: colors.primary, fontWeight: 'bold' },

    excelContainer: {
        backgroundColor: colors.surface, borderRadius: 15,
        overflow: 'hidden', borderWidth: 1, borderColor: colors.border, marginBottom: 20,
    },
    excelHeaderRow: {
        flexDirection: 'row', backgroundColor: colors.primary + '1A',
        padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    excelHeaderText: { fontSize: 11, fontWeight: 'bold', color: colors.primary, textAlign: 'center' },
    excelRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 10, paddingHorizontal: 12,
        borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    excelRowAlt: { backgroundColor: colors.background + '80' },
    exerciseLabelContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    exDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
    exerciseTitle: { fontSize: 13, color: colors.text, fontWeight: '600', flex: 1 },
    excelInput: {
        fontSize: 14, color: colors.primary, fontWeight: 'bold',
        textAlign: 'center', padding: 5,
        backgroundColor: colors.background, borderRadius: 6, marginHorizontal: 3,
    },

    summaryRow: {
        flexDirection: 'row', backgroundColor: colors.surface,
        borderRadius: 15, padding: 20, marginBottom: 20,
        borderWidth: 1, borderColor: colors.border, justifyContent: 'space-around',
    },
    summaryItem: { alignItems: 'center' },
    summaryVal: { fontSize: 22, fontWeight: 'bold', color: colors.primary },
    summaryLabel: { fontSize: 12, color: colors.secondary, marginTop: 4 },
    summaryDivider: { width: 1, backgroundColor: colors.border },

    saveBtn: {
        backgroundColor: colors.primary, flexDirection: 'row',
        alignItems: 'center', justifyContent: 'center',
        padding: 18, borderRadius: 15, gap: 10, marginBottom: 25,
        elevation: 4, shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
    },
    saveBtnText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },

    chartSectionTitle: {
        color: colors.secondary, fontSize: 12, fontWeight: 'bold',
        letterSpacing: 1, marginBottom: 12, marginTop: 5,
    },
    chartCard: {
        backgroundColor: colors.surface, borderRadius: 18, padding: 15,
        marginBottom: 20, borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
    },
    chartTitle: { color: colors.secondary, fontSize: 12, fontWeight: 'bold', marginBottom: 12 },
    chart: { borderRadius: 12, marginLeft: -10 },

    historyContainer: {
        backgroundColor: colors.surface, borderRadius: 16, marginBottom: 20,
        borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
    },
    historyRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 15, borderBottomWidth: 1, borderBottomColor: colors.border,
        borderWidth: 0, borderLeftWidth: 3, borderLeftColor: 'transparent',
    },
    historyDate: { fontSize: 14, fontWeight: 'bold', color: colors.text },
    historySub: { fontSize: 12, color: colors.secondary, marginTop: 2 },
    historyBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    historyBadgeText: { fontSize: 13, fontWeight: 'bold' },

    noPlanTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text, marginTop: 20 },
    noPlanSub: { fontSize: 14, color: colors.secondary, textAlign: 'center', marginTop: 10, paddingHorizontal: 40 },
    retryBtn: { marginTop: 30, paddingHorizontal: 25, paddingVertical: 12, backgroundColor: colors.primary, borderRadius: 10 },
    retryText: { color: colors.buttonPrimaryText, fontWeight: 'bold' },

    calModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    calModalContent: {
        backgroundColor: colors.background, borderTopLeftRadius: 25, borderTopRightRadius: 25,
        padding: 20, paddingBottom: 40,
    },
    calModalHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15,
    },
    calModalTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text },
});

export default UserWorkout;
