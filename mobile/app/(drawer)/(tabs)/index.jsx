import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Alert, Pressable, Modal, ActivityIndicator, RefreshControl } from 'react-native';
import { MaterialCommunityIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import DateTimePicker from '../../../components/DateTimePickerWrapper';
import { router } from 'expo-router';
import { useTheme } from '../../../constants/ThemeContext';
import axios from 'axios';
import { API_URL } from '../../../constants/Config';

const { width } = Dimensions.get('window');

// --- Theme Utility ---
function getStyles(colors) {
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        content: {
            padding: 16,
            paddingBottom: 40,
        },
        headerRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 20,
        },
        greeting: {
            color: colors.text,
            fontSize: 28,
            fontWeight: 'bold',
        },
        date: {
            color: colors.secondary,
            fontSize: 14,
        },
        sectionTitle: {
            color: colors.text,
            fontSize: 18,
            fontWeight: '600',
            marginTop: 24,
            marginBottom: 12,
        },
        // Grid Styles
        grid: {
            gap: 12,
        },
        row: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 8,
        },
        card: {
            flex: 1,
            padding: 16,
            borderRadius: 16,
            minHeight: 100,
            height: 110,
            justifyContent: 'space-between',
            elevation: 3,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
        },
        cardHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
        },
        cardTitle: {
            color: 'rgba(255,255,255,0.9)',
            fontSize: 13,
            fontWeight: '600',
            flex: 1,
            marginRight: 4,
        },
        cardValue: {
            color: '#FFFFFF',
            fontSize: 26,
            fontWeight: 'bold',
        },
        cardSubtext: {
            color: 'rgba(255,255,255,0.7)',
            fontSize: 11,
            marginTop: 4,
        },

        // Quick Report Styles
        reportContainer: {
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
        },
        reportHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
        },
        reportDate: {
            fontSize: 14,
            fontWeight: '500',
        },
        filterBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 8,
        },
        filterText: {
            fontSize: 12,
            fontWeight: '600',
        },
        reportGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
        },
        reportItem: {
            width: '50%',
            paddingVertical: 12,
            paddingHorizontal: 5,
            borderBottomWidth: 1,
        },
        reportLabelRow: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 8,
        },
        reportLabel: {
            fontSize: 14,
            marginRight: 4,
        },
        reportValue: {
            fontSize: 20,
            fontWeight: 'bold',
        },

        // Smart Reminder Styles
        reminderCard: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 16,
            borderRadius: 12,
            marginBottom: 10,
            borderWidth: 1,
        },
        iconCircle: {
            width: 44,
            height: 44,
            borderRadius: 22,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 14,
        },
        reminderContent: {
            flex: 1,
        },
        reminderLabel: {
            fontSize: 16,
            fontWeight: '600',
            marginBottom: 2,
        },
        reminderDesc: {
            fontSize: 12,
        },
        countBadge: {
            minWidth: 26,
            height: 26,
            borderRadius: 13,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 8,
        },
        countText: {
            color: '#FFFFFF',
            fontSize: 12,
            fontWeight: 'bold',
        },

        // Chart Styles
        chartCard: {
            padding: 20,
            borderRadius: 16,
            marginBottom: 20,
        },
        chartHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
        },
        chartTitle: {
            fontSize: 14,
            fontWeight: '600',
        },
        filterButton: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        filterButtonText: {
            fontSize: 12,
            marginRight: 4,
        },
        barChartContainer: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            height: 150,
            width: '100%',
            paddingTop: 10,
        },
        barContainer: {
            alignItems: 'center',
            gap: 8,
            flex: 1,
            height: '100%',
            justifyContent: 'flex-end',
        },
        barWrapper: {
            height: '85%',
            width: '100%',
            justifyContent: 'flex-end',
            alignItems: 'center',
        },
        bar: {
            width: 12,
            borderRadius: 6,
        },
        dayLabel: {
            fontSize: 12,
            marginTop: 5,
        },
        modalOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.8)',
            justifyContent: 'center',
            padding: 20,
        },
        calendarModal: {
            borderRadius: 20,
            padding: 25,
            borderWidth: 1,
        },
        calendarPlaceholder: {
            alignItems: 'center',
            paddingVertical: 30,
        },
        modalTop: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
        },
        modalTitle: {
            fontSize: 20,
            fontWeight: 'bold',
        },
        submitBtn: {
            padding: 15,
            borderRadius: 12,
            alignItems: 'center',
            marginTop: 10,
        },
        submitBtnText: {
            fontWeight: 'bold',
            fontSize: 16,
        },
    });
}

// --- Helper Functions ---

function isWithinDays(dateString, days) {
    const today = new Date();
    const targetDate = new Date(dateString);
    const diffTime = targetDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= days;
}

// --- Components ---

function StatCard({ title, value, icon, color, subtext, onPress, colors }) {
    const styles = getStyles(colors);
    return (
        <TouchableOpacity style={[styles.card, { backgroundColor: color }]} onPress={onPress}>
            <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{title}</Text>
                <MaterialCommunityIcons name={icon} size={24} color="rgba(255,255,255,0.8)" />
            </View>
            <Text style={styles.cardValue}>{value}</Text>
            {subtext && <Text style={styles.cardSubtext}>{subtext}</Text>}
        </TouchableOpacity>
    );
}

function QuickReportCard({ selectedDate, revenue, newMembersCount, colors }) {
    const styles = getStyles(colors);
    const { totalRevenue = 0, gpayRevenue = 0, upiRevenue = 0, cashRevenue = 0 } = revenue || {};
    const totalGpay = gpayRevenue + upiRevenue;

    return (
        <View style={[styles.reportContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.reportHeader}>
                <Text style={[styles.reportDate, { color: colors.text }]}>{selectedDate}</Text>
                <View style={[styles.filterBadge, { backgroundColor: colors.primary + '20' }]}>
                    <Ionicons name="calendar" size={12} color={colors.primary} style={{ marginRight: 4 }} />
                    <Text style={[styles.filterText, { color: colors.primary }]}>Daily Report</Text>
                </View>
            </View>

            <View style={styles.reportGrid}>
                {/* Row 1 */}
                <Pressable style={[styles.reportItem, { borderBottomColor: colors.border }]} onPress={() => router.push({ pathname: '/members' })}>
                    <View style={styles.reportLabelRow}>
                        <Text style={[styles.reportLabel, { color: colors.secondary }]}>New Members</Text>
                        <Ionicons name="chevron-forward" size={14} color={colors.secondary} />
                    </View>
                    <Text style={[styles.reportValue, { color: colors.text }]}>{newMembersCount}</Text>
                </Pressable>

                <Pressable style={[styles.reportItem, { borderBottomColor: colors.border }]} onPress={() => router.push({ pathname: '/transactions', params: { date: selectedDate } })}>
                    <View style={styles.reportLabelRow}>
                        <Text style={[styles.reportLabel, { color: colors.secondary }]}>Total Revenue</Text>
                        <Ionicons name="chevron-forward" size={14} color={colors.secondary} />
                    </View>
                    <Text style={[styles.reportValue, { color: colors.text }]}>₹{totalRevenue.toLocaleString()}</Text>
                </Pressable>

                {/* Row 2 */}
                <Pressable style={[styles.reportItem, { borderBottomColor: colors.border }]} onPress={() => router.push({ pathname: '/transactions', params: { date: selectedDate, paymentMethod: 'GPay' } })}>
                    <View style={styles.reportLabelRow}>
                        <Text style={[styles.reportLabel, { color: colors.secondary }]}>Via GPay/UPI</Text>
                        <Ionicons name="logo-google" size={12} color={colors.secondary} />
                    </View>
                    <Text style={[styles.reportValue, { color: colors.text }]}>₹{totalGpay.toLocaleString()}</Text>
                </Pressable>

                <Pressable style={[styles.reportItem, { borderBottomColor: colors.border }]} onPress={() => router.push({ pathname: '/transactions', params: { date: selectedDate, paymentMethod: 'Cash' } })}>
                    <View style={styles.reportLabelRow}>
                        <Text style={[styles.reportLabel, { color: colors.secondary }]}>Via Cash</Text>
                        <Ionicons name="cash-outline" size={14} color={colors.secondary} />
                    </View>
                    <Text style={[styles.reportValue, { color: colors.text }]}>₹{cashRevenue.toLocaleString()}</Text>
                </Pressable>
            </View>
        </View>
    );
}

function SmartReminder({ icon, label, count, color, onPress, description, colors }) {
    const styles = getStyles(colors);
    return (
        <TouchableOpacity style={[styles.reminderCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={onPress}>
            <View style={[styles.iconCircle, { backgroundColor: color + '20' }]}>
                <MaterialCommunityIcons name={icon} size={24} color={color} />
            </View>
            <View style={styles.reminderContent}>
                <Text style={[styles.reminderLabel, { color: colors.text }]}>{label}</Text>
                <Text style={[styles.reminderDesc, { color: colors.secondary }]}>{description}</Text>
            </View>
            {(count > 0 || count === 0) && (
                <View style={[styles.countBadge, { backgroundColor: count > 0 ? color : colors.border }]}>
                    <Text style={styles.countText}>{count}</Text>
                </View>
            )}
        </TouchableOpacity>
    );
}

function AttendanceChart({ colors, data }) {
    const styles = getStyles(colors);
    if (!data || data.length === 0) return null;
    
    const maxValue = Math.max(...data.map(d => d.count), 1); // Avoid division by zero

    return (
        <View style={[styles.chartCard, { backgroundColor: colors.surface }]}>
            <View style={styles.chartHeader}>
                <Text style={[styles.chartTitle, { color: colors.secondary }]}>Attendance Analysis</Text>
                <TouchableOpacity style={styles.filterButton} onPress={() => router.push('/attendance')}>
                    <Text style={[styles.filterButtonText, { color: colors.secondary }]}>Detailed View</Text>
                    <Ionicons name="chevron-forward" size={12} color={colors.secondary} />
                </TouchableOpacity>
            </View>
            <View style={styles.barChartContainer}>
                {data.map((item, index) => (
                    <TouchableOpacity key={index} style={styles.barContainer} onPress={() => router.push('/attendance')}>
                        <View style={styles.barWrapper}>
                            <View
                                style={[
                                    styles.bar,
                                    {
                                        height: `${(item.count / maxValue) * 100}%`,
                                        backgroundColor: index === data.length - 1 ? colors.primary : colors.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                                    }
                                ]}
                            />
                        </View>
                        <Text style={[styles.dayLabel, { color: colors.secondary }]}>{item.day}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
}


export default function Dashboard() {
    const { colors } = useTheme();
    const [date, setDate] = useState(new Date());
    const [showPicker, setShowPicker] = useState(false);
    const [stats, setStats] = useState(null);
    const [trend, setTrend] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const selectedDate = date.toISOString().split('T')[0];

    useEffect(() => {
        fetchData();
    }, [date]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [statsRes, trendRes] = await Promise.all([
                axios.get(`${API_URL}/dashboard/stats`, {
                    params: { date: selectedDate }
                }),
                axios.get(`${API_URL}/attendance/trend`)
            ]);
            setStats(statsRes.data);
            setTrend(trendRes.data);
        } catch (error) {
            console.log("Fetch dashboard stats error:", error);
            Alert.alert("Error", "Could not load dashboard statistics.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    // Helper to format date for display
    const formatDisplayDate = (d) => {
        return d.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const handleReminderNavigation = (filterType) => {
        router.push({ pathname: '/chats', params: { filter: filterType } });
    };

    const navigateToMembers = (filter = 'All') => {
        router.push({ pathname: '/members', params: { initialFilter: filter } });
    };

    const navigateToAttendance = (session = 'All') => {
        router.push({ pathname: '/attendance', params: { initialSession: session, date: selectedDate } });
    };

    const styles = getStyles(colors);

    if (loading && !refreshing) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    const s = stats || {
        totalMembers: 0,
        activeMembers: 0,
        expiringIn10Days: 0,
        attendance: { morning: 0, evening: 0, totalToday: 0 },
        revenue: { totalRevenue: 0, upiRevenue: 0, cashRevenue: 0 },
        newMembersToday: 0,
        expiredCount: 0,
        absentCount: 0,
        birthdayCount: 0,
        pendingInvoices: 0
    };

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
            }
        >
            <View style={styles.headerRow}>
                <View>
                    <Text style={styles.greeting}>Overview</Text>
                </View>
                <Pressable
                    style={[styles.filterBadge, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
                    onPress={() => setShowPicker(true)}
                >
                    <Ionicons name="calendar" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                    <Text style={[styles.filterText, { color: colors.text }]}>{formatDisplayDate(date)}</Text>
                </Pressable>
            </View>

            {showPicker && (
                <DateTimePicker
                    value={date}
                    mode="date"
                    display="default"
                    onChange={(event, selected) => {
                        setShowPicker(false);
                        if (selected) setDate(selected);
                    }}
                />
            )}

            {/* Overview Grid */}
            <View style={styles.grid}>
                {/* Row 1 */}
                <View key="row1" style={styles.row}>
                    <StatCard
                        title="Total Members"
                        value={s.totalMembers}
                        icon="account-group"
                        color="#42A5F5"
                        subtext="registered"
                        onPress={() => router.push('/members')}
                        colors={colors}
                    />
                    <StatCard
                        title="Active"
                        value={s.activeMembers}
                        icon="check-circle"
                        color={colors.success}
                        subtext="currently"
                        onPress={() => router.push({ pathname: '/members', params: { initialFilter: 'Active' } })}
                        colors={colors}
                    />
                </View>
                {/* Row 2 */}
                <View key="row2" style={styles.row}>
                    <StatCard
                        title="Attendance"
                        value={s.attendance.totalToday}
                        icon="calendar"
                        color="#AB47BC"
                        subtext={`${s.attendance.morning}M / ${s.attendance.evening}E`}
                        onPress={() => router.push('/attendance')}
                        colors={colors}
                    />
                    <StatCard
                        title="Expiring Soon"
                        value={s.expiringIn10Days}
                        icon="clock-outline"
                        color="#FFA726"
                        subtext="next 10 days"
                        onPress={() => router.push({ pathname: '/members', params: { initialFilter: 'Expiring in 10 days' } })}
                        colors={colors}
                    />
                </View>
                {/* Row 3 */}
                <View key="row3" style={styles.row}>
                    <StatCard
                        title="UPI Revenue"
                        value={`₹${((s.overallRevenue?.upiRevenue || 0) / 1000).toFixed(1)}k`}
                        icon="cellphone"
                        color="#EF5350"
                        subtext="all time"
                        onPress={() => router.push({ pathname: '/transactions', params: { paymentMethod: 'upi' } })}
                        colors={colors}
                    />
                    <StatCard
                        title="Cash Revenue"
                        value={`₹${((s.overallRevenue?.cashRevenue || 0) / 1000).toFixed(1)}k`}
                        icon="wallet"
                        color="#66BB6A"
                        subtext="all time"
                        onPress={() => router.push({ pathname: '/transactions', params: { paymentMethod: 'cash' } })}
                        colors={colors}
                    />
                </View>
            </View>

            {/* Quick Reports */}
            <Text style={styles.sectionTitle}>Quick Reports</Text>
            <QuickReportCard
                selectedDate={selectedDate}
                revenue={s.revenue}
                newMembersCount={s.newMembersToday}
                colors={colors}
            />

            {/* Smart Reminders */}
            <Text style={styles.sectionTitle}>Smart Reminders</Text>

            <SmartReminder
                icon="account-off-outline"
                label="Expired Memberships"
                description="Past expiry date (unpaid)"
                count={s.expiredCount}
                color="#F44336"
                onPress={() => handleReminderNavigation('expired')}
                colors={colors}
            />
            <SmartReminder
                icon="clock-time-eight-outline"
                label="Absent Members"
                description="Absent for > 2 days"
                count={s.absentCount}
                color="#FF9800"
                onPress={() => handleReminderNavigation('absent')}
                colors={colors}
            />
            <SmartReminder
                icon="cake-variant-outline"
                label="Birthday Wishes"
                description="Today's birthdays"
                count={s.birthdayCount}
                color="#E91E63"
                onPress={() => handleReminderNavigation('birthday')}
                colors={colors}
            />
            <SmartReminder
                icon="receipt"
                label="Pending Invoices"
                description="Unsent payment receipts"
                count={s.pendingInvoices}
                color="#00BCD4"
                onPress={() => handleReminderNavigation('invoices')}
                colors={colors}
            />
            <SmartReminder
                icon="currency-inr"
                label="Pending Balance"
                description="Members with outstanding dues"
                count={s.balanceCount}
                color="#FF5722"
                onPress={() => handleReminderNavigation('balance')}
                colors={colors}
            />

            {/* Attendance Chart */}
            <Text style={styles.sectionTitle}>Attendance Analysis</Text>
            <AttendanceChart colors={colors} data={trend} />
        </ScrollView>
    );
}
