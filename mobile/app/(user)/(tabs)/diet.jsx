import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Modal, Dimensions, RefreshControl } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { darkTheme } from '../../../constants/ThemeContext';
import axios from 'axios';
import { API_URL } from '../../../constants/Config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { Calendar } from 'react-native-calendars';
import { router, useFocusEffect } from 'expo-router';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 70;

const MEAL_TIME_COLORS = {
    'Morning': '#FF9800',
    'Mid-Morning': '#4CAF50',
    'Noon': '#2196F3',
    'Evening': '#9C27B0',
    'Night': '#607D8B',
};

const MEAL_TIME_ICONS = {
    'Morning': 'weather-sunny',
    'Mid-Morning': 'coffee',
    'Noon': 'white-balance-sunny',
    'Evening': 'weather-sunset',
    'Night': 'weather-night',
};

// Helper outside component to avoid hoisting issues
const getMealListFromPlan = (p) => {
    if (!p) return [];
    if (p.mealSchedule && p.mealSchedule.length > 0) return p.mealSchedule;
    if (p.plan) {
        return p.plan.split('\n').filter(l => l.trim() && l.trim().length > 3).map((l, i) => {
            const parts = l.split(':');
            return parts.length > 1
                ? { mealTime: parts[0].trim(), items: parts.slice(1).join(':').trim() }
                : { mealTime: `Meal ${i + 1}`, items: l.trim() };
        });
    }
    return [];
};

const UserDiet = () => {
    const colors = darkTheme;
    const [loading, setLoading] = useState(true);
    const [plan, setPlan] = useState(null);
    const [memberData, setMemberData] = useState(null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [dietLogs, setDietLogs] = useState([]);
    const [historyLogs, setHistoryLogs] = useState([]);
    const [dietStreak, setDietStreak] = useState(0);
    const [showCalendar, setShowCalendar] = useState(false);
    const [cachedPlan, setCachedPlan] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    };

    const today = new Date().toISOString().split('T')[0];
    const styles = getStyles(colors);

    const calcStreak = (logsArr) => {
        const dietDays = logsArr
            .filter(l => {
                const total = l.dietLogs?.length || 0;
                const done = l.dietLogs?.filter(d => d.isCompleted).length || 0;
                return total > 0 && done === total;
            })
            .map(l => l.date)
            .sort((a, b) => new Date(b) - new Date(a));

        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        let streak = 0;
        if (dietDays.length > 0 && (dietDays[0] === today || dietDays[0] === yesterday)) {
            streak = 1;
            for (let i = 1; i < dietDays.length; i++) {
                const curr = new Date(dietDays[i - 1]);
                const prev = new Date(dietDays[i]);
                if ((curr - prev) / 86400000 === 1) streak++;
                else break;
            }
        }
        return streak;
    };

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

            const histRes = await axios.get(`${API_URL}/daily-logs/history/${member._id}?limit=30`);
            const sorted = [...histRes.data].sort((a, b) => new Date(a.date) - new Date(b.date));
            setHistoryLogs(sorted);
            setDietStreak(calcStreak(histRes.data));

            if (member.dietPlan) {
                const plansRes = await axios.get(`${API_URL}/diet-plans`);
                const matchedPlan = plansRes.data.find(
                    p => p.name?.toLowerCase() === member.dietPlan?.toLowerCase()
                );

                if (matchedPlan) {
                    setPlan(matchedPlan);
                    setCachedPlan(matchedPlan);
                    await fetchLogsForDate(member._id, selectedDate, matchedPlan);
                }
            }
        } catch (error) {
            console.error("Fetch diet error:", error.response?.data || error.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchLogsForDate = async (memberId, date, currentPlan) => {
        try {
            const logsRes = await axios.get(`${API_URL}/daily-logs?memberId=${memberId}&date=${date}`);
            if (logsRes.data && logsRes.data.dietLogs?.length > 0) {
                setDietLogs(logsRes.data.dietLogs);
            } else {
                const p = currentPlan || cachedPlan || plan;
                if (p) {
                    const meals = getMealListFromPlan(p);
                    setDietLogs(meals.map(m => ({
                        mealTime: m.mealTime,
                        mealName: `${m.mealTime} - ${m.items}`,
                        items: m.items,
                        isCompleted: false
                    })));
                }
            }
        } catch (e) {
            console.error("Error fetching diet logs:", e);
        }
    };

    const toggleMeal = async (index) => {
        const newLogs = [...dietLogs];
        newLogs[index].isCompleted = !newLogs[index].isCompleted;
        setDietLogs(newLogs);

        try {
            await axios.post(`${API_URL}/daily-logs`, {
                memberId: memberData._id,
                date: selectedDate,
                dietLogs: newLogs
            });

            const histRes = await axios.get(`${API_URL}/daily-logs/history/${memberData._id}?limit=30`);
            const sorted = [...histRes.data].sort((a, b) => new Date(a.date) - new Date(b.date));
            setHistoryLogs(sorted);
            setDietStreak(calcStreak(histRes.data));
        } catch (e) {
            console.error("Save diet log error:", e);
        }
    };

    const handleDateSelect = async (date) => {
        setSelectedDate(date);
        setShowCalendar(false);
        if (memberData && (cachedPlan || plan)) {
            await fetchLogsForDate(memberData._id, date, cachedPlan || plan);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const completedCount = dietLogs.filter(d => d.isCompleted).length;
    const totalCount = dietLogs.length || 1;
    const progressPct = Math.round((completedCount / totalCount) * 100);

    // Chart data
    const last7 = historyLogs.slice(-7);
    const chartLabels = last7.length > 0
        ? last7.map(l => l.date?.slice(5) || '')
        : ['Day1', 'Day2', 'Day3', 'Day4', 'Day5', 'Day6', 'Day7'];

    const dietCompletionData = last7.map(l => {
        const total = l.dietLogs?.length || 0;
        const done = l.dietLogs?.filter(d => d.isCompleted).length || 0;
        return total > 0 ? Math.round((done / total) * 100) : 0;
    });

    const mealsCompletedData = last7.map(l =>
        l.dietLogs?.filter(d => d.isCompleted).length || 0
    );

    const dietLineData = {
        labels: chartLabels,
        datasets: [{ data: last7.length > 0 ? dietCompletionData : [60, 80, 50, 100, 70, 90, 80], strokeWidth: 2 }]
    };

    const mealsBarData = {
        labels: chartLabels,
        datasets: [{ data: last7.length > 0 ? mealsCompletedData : [2, 3, 2, 4, 3, 5, 4] }]
    };

    const chartConfig = {
        backgroundGradientFrom: colors.surface,
        backgroundGradientTo: colors.surface,
        decimalPlaces: 0,
        color: (opacity = 1) => `#4CAF50${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
        labelColor: () => colors.secondary,
        style: { borderRadius: 16 },
        propsForDots: { r: '4', strokeWidth: '2', stroke: '#4CAF50' }
    };

    const markedDates = {};
    historyLogs.forEach(l => {
        const total = l.dietLogs?.length || 0;
        const done = l.dietLogs?.filter(d => d.isCompleted).length || 0;
        const hasData = total > 0;
        const allDone = total > 0 && done === total;
        markedDates[l.date] = {
            marked: hasData,
            dotColor: allDone ? '#4CAF50' : '#FF9800',
        };
    });
    markedDates[selectedDate] = {
        ...(markedDates[selectedDate] || {}),
        selected: true,
        selectedColor: '#4CAF50',
    };

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [])
    );

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
                    Your admin created your basic account. Please complete your essential profile details (Email, DOB, Gender, Blood Group, Address) to unlock your diet plan.
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
                <MaterialCommunityIcons name="food-apple-outline" size={80} color={colors.secondary} />
                <Text style={styles.noPlanTitle}>No Diet Plan Assigned</Text>
                <Text style={styles.noPlanSub}>Please contact your nutritionist to assign a diet plan.</Text>
                <Pressable style={styles.retryBtn} onPress={fetchData}>
                    <Text style={styles.retryText}>REFRESH</Text>
                </Pressable>
            </View>
        );
    }

    const planMeals = getMealListFromPlan(plan);
    const isToday = selectedDate === today;

    return (
        <ScrollView
            style={styles.container}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        >
            {/* Header Card */}
            <View style={styles.headerCard}>
                <View style={styles.headerInfo}>
                    <Text style={styles.headerSubtitle}>CURRENT PLAN</Text>
                    <Text style={styles.planTitle}>{plan.name}</Text>
                    <View style={styles.statsRow}>
                        <View style={styles.statContainer}>
                            <Ionicons name="flame" size={16} color="#FF5722" />
                            <Text style={styles.statText}>{plan.cals}</Text>
                        </View>
                        <View style={styles.statContainer}>
                            <Ionicons name="restaurant" size={16} color={colors.primary} />
                            <Text style={styles.statText}>{plan.meals} Meals</Text>
                        </View>
                    </View>
                </View>
                <View style={styles.iconCircle}>
                    <MaterialCommunityIcons name={plan.icon || "food-apple"} size={45} color={colors.primary} />
                </View>
            </View>

            {/* Diet Streak Card */}
            <View style={styles.streakCard}>
                <View style={styles.streakItem}>
                    <MaterialCommunityIcons name="fire" size={26} color="#FF9800" />
                    <Text style={styles.streakVal}>{dietStreak}</Text>
                    <Text style={styles.streakLabel}>Diet Streak</Text>
                </View>
                <View style={styles.streakDivider} />
                <View style={styles.streakItem}>
                    <Ionicons name="checkmark-circle" size={26} color="#4CAF50" />
                    <Text style={styles.streakVal}>{completedCount}/{totalCount}</Text>
                    <Text style={styles.streakLabel}>Today Meals</Text>
                </View>
                <View style={styles.streakDivider} />
                <View style={styles.streakItem}>
                    <Ionicons name="calendar" size={26} color={colors.primary} />
                    <Text style={styles.streakVal}>
                        {historyLogs.filter(l => l.dietLogs?.some(d => d.isCompleted)).length}
                    </Text>
                    <Text style={styles.streakLabel}>Days Tracked</Text>
                </View>
            </View>

            {/* Progress Card */}
            <View style={styles.progressCard}>
                <View style={styles.progressHeader}>
                    <Text style={styles.sectionTitleInternal}>Daily Progress ({selectedDate})</Text>
                    <Text style={[styles.percentageText, { color: progressPct === 100 ? '#4CAF50' : colors.primary }]}>{progressPct}%</Text>
                </View>
                <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, {
                        width: `${progressPct}%`,
                        backgroundColor: progressPct === 100 ? '#4CAF50' : colors.primary
                    }]} />
                </View>
                {progressPct === 100 && (
                    <Text style={{ color: '#4CAF50', fontSize: 13, fontWeight: 'bold', marginTop: 8, textAlign: 'center' }}>
                        All meals completed! Great job!
                    </Text>
                )}
            </View>

            {/* Date Filter Header */}
            <View style={styles.filterRow}>
                <Text style={styles.sectionTitle}>DAILY MEAL CHECKLIST</Text>
                <Pressable style={styles.dateSelector} onPress={() => setShowCalendar(true)}>
                    <Ionicons name="calendar-outline" size={15} color="#4CAF50" />
                    <Text style={styles.dateText}>{selectedDate}</Text>
                    <Ionicons name="chevron-down" size={13} color="#4CAF50" />
                </Pressable>
            </View>

            {/* Meal Checklist */}
            {dietLogs.map((item, index) => {
                const mealTime = item.mealTime || '';
                const accentColor = MEAL_TIME_COLORS[mealTime] || colors.primary;
                const icon = MEAL_TIME_ICONS[mealTime] || 'food-outline';
                return (
                    <Pressable
                        key={index}
                        style={[styles.mealCard, { borderLeftColor: accentColor }, item.isCompleted && styles.mealCardDone]}
                        onPress={isToday ? () => toggleMeal(index) : null}
                    >
                        <View style={[styles.mealIconWrap, { backgroundColor: accentColor + '20' }]}>
                            <MaterialCommunityIcons name={icon} size={22} color={accentColor} />
                        </View>
                        <View style={styles.mealContent}>
                            <Text style={[styles.mealTimeText, { color: accentColor }]}>{mealTime}</Text>
                            <Text style={[styles.mealItemsText, item.isCompleted && styles.mealItemsDone]}>
                                {item.items}
                            </Text>
                            {!isToday && (
                                <Text style={{ fontSize: 10, color: colors.secondary, marginTop: 2 }}>Past date - view only</Text>
                            )}
                        </View>
                        <View style={[styles.checkbox, item.isCompleted && { backgroundColor: accentColor, borderColor: accentColor }]}>
                            {item.isCompleted && <Ionicons name="checkmark" size={16} color="#FFF" />}
                        </View>
                    </Pressable>
                );
            })}
            {dietLogs.length === 0 && (
                <Text style={{ textAlign: 'center', color: colors.secondary, padding: 20 }}>No meal data for {selectedDate}.</Text>
            )}

            {/* Full Diet Details */}
            {planMeals.length > 0 && (
                <>
                    <Text style={[styles.sectionTitle, { marginTop: 10 }]}>FULL DIET DETAILS</Text>
                    <View style={styles.detailsCard}>
                        {planMeals.map((m, i) => {
                            const color = MEAL_TIME_COLORS[m.mealTime] || colors.primary;
                            return (
                                <View key={i} style={styles.detailRow}>
                                    <View style={[styles.mealTimePill, { backgroundColor: color + '20' }]}>
                                        <Text style={[styles.mealTimePillText, { color }]}>{m.mealTime}</Text>
                                    </View>
                                    <Text style={styles.detailItems}>{m.items}</Text>
                                </View>
                            );
                        })}
                    </View>
                </>
            )}

            {/* Diet Charts */}
            <Text style={styles.chartSectionTitle}>DIET ADHERENCE (LAST 7 DAYS)</Text>

            <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Meal Completion % Per Day</Text>
                <LineChart
                    data={dietLineData}
                    width={CHART_WIDTH}
                    height={160}
                    chartConfig={chartConfig}
                    bezier
                    style={styles.chart}
                    withInnerLines={false}
                    withOuterLines={false}
                    yAxisSuffix="%"
                />
            </View>

            <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Meals Completed Per Day</Text>
                <BarChart
                    data={mealsBarData}
                    width={CHART_WIDTH}
                    height={160}
                    chartConfig={{ ...chartConfig, color: (opacity = 1) => `#FF9800${Math.round(opacity * 255).toString(16).padStart(2, '0')}` }}
                    style={styles.chart}
                    withInnerLines={false}
                    showValuesOnTopOfBars
                />
            </View>

            {/* Diet History */}
            <Text style={styles.chartSectionTitle}>DIET HISTORY</Text>
            <View style={styles.historyContainer}>
                {historyLogs
                    .filter(l => l.dietLogs?.length > 0)
                    .slice(-10)
                    .reverse()
                    .map((log, i) => {
                        const total = log.dietLogs.length;
                        const done = log.dietLogs.filter(d => d.isCompleted).length;
                        const pct = Math.round((done / total) * 100);
                        const isComplete = done === total;
                        return (
                            <Pressable
                                key={i}
                                style={[styles.historyRow, log.date === selectedDate && { borderLeftColor: '#4CAF50', borderLeftWidth: 3 }]}
                                onPress={() => handleDateSelect(log.date)}
                            >
                                <View>
                                    <Text style={styles.historyDate}>{log.date}</Text>
                                    <Text style={styles.historySub}>{done}/{total} meals completed</Text>
                                </View>
                                <View style={[styles.historyBadge, { backgroundColor: isComplete ? '#4CAF5020' : '#FF980020' }]}>
                                    <Text style={[styles.historyBadgeText, { color: isComplete ? '#4CAF50' : '#FF9800' }]}>{pct}%</Text>
                                </View>
                            </Pressable>
                        );
                    })}
                {historyLogs.filter(l => l.dietLogs?.length > 0).length === 0 && (
                    <Text style={{ color: colors.secondary, textAlign: 'center', padding: 20 }}>No diet history yet. Start tracking!</Text>
                )}
            </View>

            {/* Nutrition Tips */}
            <Text style={styles.sectionTitle}>NUTRITION TIPS</Text>
            <View style={styles.tipCard}>
                <Ionicons name="water" size={24} color="#2196F3" />
                <View style={styles.tipContent}>
                    <Text style={styles.tipTitle}>Hydration Target</Text>
                    <Text style={styles.tipSub}>Aim for 3-4 liters of water daily.</Text>
                </View>
            </View>
            <View style={styles.tipCard}>
                <Ionicons name="time" size={24} color="#4CAF50" />
                <View style={styles.tipContent}>
                    <Text style={styles.tipTitle}>Meal Timing</Text>
                    <Text style={styles.tipSub}>Keep 3 hours gap between meals.</Text>
                </View>
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
                                selectedDayBackgroundColor: '#4CAF50',
                                selectedDayTextColor: '#FFF',
                                todayTextColor: '#4CAF50',
                                dayTextColor: colors.text,
                                textDisabledColor: colors.border,
                                monthTextColor: colors.text,
                                arrowColor: '#4CAF50',
                                dotColor: '#4CAF50',
                                selectedDotColor: '#FFF',
                            }}
                            maxDate={today}
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
    statsRow: { flexDirection: 'row', gap: 15 },
    statContainer: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    statText: { fontSize: 14, color: colors.secondary, fontWeight: '500' },
    iconCircle: {
        width: 75, height: 75, borderRadius: 38,
        backgroundColor: colors.background,
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 1, borderColor: colors.border,
    },
    headerSubtitle: { fontSize: 10, color: colors.secondary, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 5 },

    streakCard: {
        flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 16,
        padding: 16, marginBottom: 15, borderWidth: 1, borderColor: colors.border, alignItems: 'center',
    },
    streakItem: { flex: 1, alignItems: 'center', gap: 4 },
    streakDivider: { width: 1, height: 40, backgroundColor: colors.border },
    streakVal: { fontSize: 20, fontWeight: 'bold', color: colors.text },
    streakLabel: { fontSize: 10, color: colors.secondary, textAlign: 'center', textTransform: 'uppercase' },

    progressCard: {
        backgroundColor: colors.surface, borderRadius: 20, padding: 20,
        borderWidth: 1, borderColor: colors.border, marginBottom: 20,
    },
    progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sectionTitleInternal: { fontSize: 13, fontWeight: 'bold', color: colors.text, flex: 1 },
    percentageText: { fontSize: 18, fontWeight: 'bold' },
    progressBarBg: { height: 10, backgroundColor: colors.background, borderRadius: 5, overflow: 'hidden', marginBottom: 5 },
    progressBarFill: { height: '100%', borderRadius: 5 },

    filterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sectionTitle: {
        fontSize: 14, fontWeight: 'bold', color: colors.secondary,
        letterSpacing: 1, marginBottom: 15, marginLeft: 5, marginTop: 10,
    },
    dateSelector: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: colors.surface, paddingHorizontal: 12,
        paddingVertical: 7, borderRadius: 12, borderWidth: 1, borderColor: '#4CAF50',
    },
    dateText: { fontSize: 12, color: '#4CAF50', fontWeight: 'bold' },

    mealCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.surface, borderRadius: 14, padding: 15,
        marginBottom: 12, borderWidth: 1, borderColor: colors.border,
        borderLeftWidth: 4, gap: 12,
    },
    mealCardDone: { opacity: 0.65 },
    mealIconWrap: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
    mealContent: { flex: 1 },
    mealTimeText: { fontSize: 12, fontWeight: 'bold', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
    mealItemsText: { fontSize: 14, color: colors.text, lineHeight: 20 },
    mealItemsDone: { textDecorationLine: 'line-through', color: colors.secondary },
    checkbox: {
        width: 26, height: 26, borderRadius: 7, borderWidth: 2,
        borderColor: colors.border, justifyContent: 'center', alignItems: 'center',
    },

    detailsCard: {
        backgroundColor: colors.surface, borderRadius: 20, padding: 16,
        borderWidth: 1, borderColor: colors.border, marginBottom: 20, gap: 12,
    },
    detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    mealTimePill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, minWidth: 80, alignItems: 'center' },
    mealTimePillText: { fontSize: 11, fontWeight: 'bold' },
    detailItems: { flex: 1, fontSize: 14, color: colors.text, lineHeight: 20 },

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
        borderLeftWidth: 3, borderLeftColor: 'transparent',
    },
    historyDate: { fontSize: 14, fontWeight: 'bold', color: colors.text },
    historySub: { fontSize: 12, color: colors.secondary, marginTop: 2 },
    historyBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    historyBadgeText: { fontSize: 13, fontWeight: 'bold' },

    tipCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.surface, padding: 15, borderRadius: 15,
        marginBottom: 12, borderWidth: 1, borderColor: colors.border,
    },
    tipContent: { marginLeft: 15 },
    tipTitle: { fontSize: 14, fontWeight: 'bold', color: colors.text },
    tipSub: { fontSize: 12, color: colors.secondary },

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

export default UserDiet;
