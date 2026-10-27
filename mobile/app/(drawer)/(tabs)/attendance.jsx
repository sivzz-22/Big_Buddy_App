import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useLocalSearchParams, useNavigation, router, useFocusEffect } from 'expo-router';
import { View, Text, StyleSheet, FlatList, Dimensions, ScrollView, Pressable, ActivityIndicator, Alert, Modal, TextInput, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../../../constants/ThemeContext';
import { BarChart } from 'react-native-chart-kit';
import axios from 'axios';
import { API_URL } from '../../../constants/Config';
import QRCode from 'react-native-qrcode-svg';

const { width } = Dimensions.get('window');

const AttendanceInfoModal = ({ visible, onClose, gymData, colors, styles }) => {
    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { alignItems: 'center', padding: 30 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 20 }}>
                        <Text style={styles.modalTitle}>Attendance Code</Text>
                        <Pressable onPress={onClose} style={{ padding: 5 }}>
                            <Ionicons name="close" size={24} color={colors.text} />
                        </Pressable>
                    </View>

                    <View style={{ backgroundColor: colors.surface, padding: 30, borderRadius: 20, alignItems: 'center', marginTop: 20 }}>
                        <Text style={{ color: colors.secondary, fontSize: 14, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>Member Access Code</Text>
                        <Text style={{ color: colors.primary, fontSize: 48, fontWeight: 'bold', letterSpacing: 8 }}>{gymData?.attendanceCode || '----'}</Text>
                    </View>

                    <View style={{ marginTop: 30, alignItems: 'center' }}>
                        <View style={{ backgroundColor: '#FFF', padding: 20, borderRadius: 20 }}>
                            <QRCode
                                value="GYM_ATTENDANCE_CHECK_IN"
                                size={180}
                                color="#000"
                                backgroundColor="#FFF"
                            />
                        </View>
                        <Text style={{ color: colors.secondary, marginTop: 15, textAlign: 'center' }}>
                            Members scan this QR code and enter the daily code to check-in.
                        </Text>
                    </View>

                    <Pressable style={[styles.submitBtn, { width: '100%', marginTop: 30 }]} onPress={onClose}>
                        <Text style={styles.submitBtnText}>CLOSE</Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
};

const AttendancePage = () => {
    const { colors } = useTheme();
    const navigation = useNavigation();
    const { initialSession } = useLocalSearchParams();
    const [date, setDate] = useState(new Date());
    const [showPicker, setShowPicker] = useState(false);
    const selectedDate = date.toISOString().split('T')[0];
    const [selectedSession, setSelectedSession] = useState(initialSession || 'Morning');

    // State for API data
    const [attendance, setAttendance] = useState([]);
    const [summary, setSummary] = useState({ present: 0, absent: 0, total: 0 });
    const [trendData, setTrendData] = useState({ labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], datasets: [{ data: [0, 0, 0, 0, 0, 0] }] });
    const [gymData, setGymData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [markingMode, setMarkingMode] = useState(false);
    const [isInfoModalVisible, setInfoModalVisible] = useState(false);
    const [memberSearch, setMemberSearch] = useState('');
    const [allMembers, setAllMembers] = useState([]);
    const datesListRef = React.useRef(null);

    const styles = getStyles(colors);

    useEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 15 }}>
                    <Pressable style={{ marginRight: 15 }} onPress={() => router.push('/notifications')}>
                        <Ionicons name="notifications-outline" size={24} color={colors.primary} />
                    </Pressable>
                    <Pressable onPress={() => router.push('/chats')}>
                        <Ionicons name="chatbubble-ellipses-outline" size={24} color={colors.primary} />
                    </Pressable>
                </View>
            ),
        });
    }, [navigation, colors]);

    useFocusEffect(
        useCallback(() => {
            fetchInitialData();
        }, [selectedDate, selectedSession])
    );

    useEffect(() => {
        if (datesListRef.current && dates.length > 15) {
            setTimeout(() => {
                datesListRef.current?.scrollToIndex({ index: 15, animated: true });
            }, 500);
        }
    }, [date]);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const [attRes, sumRes, trendRes, gymRes] = await Promise.all([
                axios.get(`${API_URL}/attendance?date=${selectedDate}&session=${selectedSession}`),
                axios.get(`${API_URL}/attendance/summary?date=${selectedDate}`),
                axios.get(`${API_URL}/attendance/trend`),
                axios.get(`${API_URL}/gym`)
            ]);
            setAttendance(attRes.data);
            setSummary(sumRes.data);
            setGymData(gymRes.data);

            if (trendRes.data && trendRes.data.length > 0) {
                setTrendData({
                    labels: trendRes.data.map(d => d.day),
                    datasets: [{ data: trendRes.data.map(d => d.count) }]
                });
            } else {
                setTrendData(null);
            }
        } catch (error) {
            console.log("Attendance fetch error:", error);
            Alert.alert("Error", "Could not load attendance data.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchInitialData();
    };

    const fetchAllMembers = async () => {
        try {
            const res = await axios.get(`${API_URL}/members?role=member`);
            setAllMembers(res.data);
        } catch (error) {
            console.log("Fetch members error:", error);
        }
    };

    const handleMarkAttendance = async (memberId) => {
        try {
            await axios.post(`${API_URL}/attendance`, {
                memberId,
                session: selectedSession
            });
            Alert.alert("Success", "Attendance marked!");
            setMarkingMode(false);
            fetchInitialData();
        } catch (error) {
            Alert.alert("Error", error.response?.data?.message || "Could not mark attendance.");
        }
    };

    const openMarkingMode = () => {
        setMarkingMode(true);
        fetchAllMembers();
    };

    const dates = useMemo(() => {
        const result = [];
        // Center around the selected date instead of hardcoded today
        const pivotDate = new Date(date);
        for (let i = -15; i <= 15; i++) {
            const d = new Date(pivotDate);
            d.setDate(pivotDate.getDate() + i);
            result.push({
                full: d.toISOString().split('T')[0],
                day: d.toLocaleDateString('en-US', { weekday: 'short' }),
                date: d.getDate(),
                month: d.toLocaleDateString('en-US', { month: 'short' }),
            });
        }
        return result;
    }, [date]);

    const filteredMembers = allMembers.filter(m =>
        m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
        m.memberID.toLowerCase().includes(memberSearch.toLowerCase())
    );

    const renderDateItem = ({ item }) => {
        const isSelected = item.full === selectedDate;
        return (
            <Pressable
                onPress={() => setDate(new Date(item.full))}
                style={[styles.dateCard, isSelected && styles.dateCardActive]}
            >
                <Text style={[styles.dateMonth, isSelected && styles.textWhite]}>{item.month}</Text>
                <Text style={[styles.dateNumber, isSelected && styles.textWhite]}>{item.date}</Text>
                <Text style={[styles.dateDay, isSelected && styles.textWhite]}>{item.day}</Text>
            </Pressable>
        );
    };

    const renderMemberItem = ({ item }) => (
        <View style={styles.memberCard}>
            <View style={styles.memberAvatar}>
                <Text style={styles.avatarText}>{item.memberName.charAt(0)}</Text>
            </View>
            <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{item.memberName}</Text>
                <Text style={styles.memberTime}>{item.time}</Text>
            </View>
            <View style={styles.statusBadge}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <Text style={styles.statusText}>Present</Text>
            </View>
        </View>
    );

    if (loading && attendance.length === 0) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <View style={{ flex: 1 }}>
            <ScrollView 
                style={styles.container} 
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
                }
            >
                <View style={styles.calendarContainer}>
                    <View style={styles.calendarHeader}>
                        <Text style={styles.sectionTitle}>Calendar</Text>
                        <Pressable style={styles.filterBtn} onPress={() => setShowPicker(true)}>
                            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                            <Text style={styles.filterBtnText}>Select Date</Text>
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
                    <FlatList
                        ref={datesListRef}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        data={dates}
                        keyExtractor={(item, index) => item.full + index}
                        renderItem={renderDateItem}
                        contentContainerStyle={styles.datesList}
                        initialScrollIndex={15}
                        getItemLayout={(data, index) => ({
                            length: 70, offset: 70 * index, index
                        })}
                        onScrollToIndexFailed={info => {
                            const wait = new Promise(resolve => setTimeout(resolve, 500));
                            wait.then(() => {
                                datesListRef.current?.scrollToIndex({ index: info.index, animated: true });
                            });
                        }}
                    />
                </View>

                <View style={styles.sessionSelectorContainer}>
                    <Pressable
                        onPress={() => setSelectedSession('Morning')}
                        style={[styles.sessionTabHalf, selectedSession === 'Morning' && styles.sessionTabActive]}
                    >
                        <Ionicons name="sunny" size={20} color={selectedSession === 'Morning' ? colors.buttonPrimaryText : colors.secondary} />
                        <Text style={[styles.sessionTabText, selectedSession === 'Morning' && styles.sessionTabTextActive]}>Morning</Text>
                    </Pressable>
                    <Pressable
                        onPress={() => setSelectedSession('Evening')}
                        style={[styles.sessionTabHalf, selectedSession === 'Evening' && styles.sessionTabActive]}
                    >
                        <Ionicons name="moon" size={20} color={selectedSession === 'Evening' ? colors.buttonPrimaryText : colors.secondary} />
                        <Text style={[styles.sessionTabText, selectedSession === 'Evening' && styles.sessionTabTextActive]}>Evening</Text>
                    </Pressable>
                </View>

                {/* Primary Actions Row */}
                <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
                    <Pressable 
                        style={[styles.submitBtn, { marginBottom: 10 }]} 
                        onPress={openMarkingMode}
                    >
                        <Ionicons name="hand-right-outline" size={20} color={colors.buttonPrimaryText} style={{ marginRight: 10 }} />
                        <Text style={styles.submitBtnText}>MARK MANUAL ATTENDANCE</Text>
                    </Pressable>
                    
                    <Pressable 
                        style={[styles.filterBtn, { justifyContent: 'center', paddingVertical: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]} 
                        onPress={() => setInfoModalVisible(true)}
                    >
                        <Ionicons name="qr-code-outline" size={18} color={colors.primary} style={{ marginRight: 8 }} />
                        <Text style={[styles.filterBtnText, { fontSize: 13 }]}>GET ATTENDANCE CODE / QR</Text>
                    </Pressable>
                </View>

                <View style={styles.summaryCard}>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryValue}>{summary.present}</Text>
                        <Text style={styles.summaryLabel}>Present</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryValue}>{summary.absent}</Text>
                        <Text style={styles.summaryLabel}>Absent</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryValue}>{summary.total}</Text>
                        <Text style={styles.summaryLabel}>Total</Text>
                    </View>
                </View>

                <View style={styles.chartSection}>
                    <Text style={styles.chartTitle}>Weekly Attendance Trend</Text>
                    <BarChart
                        data={trendData}
                        width={width - 40}
                        height={200}
                        yAxisLabel=""
                        chartConfig={{
                            backgroundColor: colors.surface,
                            backgroundGradientFrom: colors.surface,
                            backgroundGradientTo: colors.surface,
                            decimalPlaces: 0,
                            color: (opacity = 1) => `rgba(57, 255, 20, ${opacity})`,
                            labelColor: (opacity = 1) => colors.secondary,
                            style: { borderRadius: 16 },
                            propsForDots: {
                                r: "6",
                                strokeWidth: "2",
                                stroke: colors.primary
                            }
                        }}
                        style={{
                            marginVertical: 10,
                            borderRadius: 16
                        }}
                    />
                </View>

                <View style={styles.listSection}>
                    <Text style={styles.listTitle}>{selectedSession} Attendees</Text>
                    {attendance.length > 0 ? (
                        attendance.map((item, index) => (
                            <View key={item._id || `att-${index}`}>
                                {renderMemberItem({ item })}
                            </View>
                        ))
                    ) : (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="people-outline" size={50} color={colors.secondary} />
                            <Text style={styles.emptyText}>No attendance records for this session.</Text>
                        </View>
                    )}
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>



            <Modal visible={markingMode} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Mark Attendance</Text>
                            <Pressable onPress={() => setMarkingMode(false)}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </Pressable>
                        </View>

                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search Name or ID..."
                            placeholderTextColor={colors.secondary}
                            value={memberSearch}
                            onChangeText={setMemberSearch}
                        />

                        <FlatList
                            data={filteredMembers}
                            keyExtractor={m => m._id}
                            renderItem={({ item }) => (
                                <Pressable
                                    style={styles.memberListItem}
                                    onPress={() => handleMarkAttendance(item._id)}
                                >
                                    <View>
                                        <Text style={styles.memberName}>{item.name}</Text>
                                        <Text style={styles.memberSub}>{item.memberID} • {item.status}</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={18} color={colors.secondary} />
                                </Pressable>
                            )}
                            ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20 }}>No members found</Text>}
                        />
                    </View>
                </View>
            </Modal>

            <AttendanceInfoModal
                visible={isInfoModalVisible}
                onClose={() => setInfoModalVisible(false)}
                gymData={gymData}
                colors={colors}
                styles={styles}
            />
        </View>
    );
};

const getStyles = (colors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    calendarContainer: {
        paddingVertical: 20,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    calendarHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 15,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.primary,
    },
    filterBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: colors.primary + '1A',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
    },
    filterBtnText: {
        color: colors.primary,
        fontSize: 12,
        fontWeight: 'bold',
    },
    datesList: {
        paddingHorizontal: 15,
        paddingVertical: 10,
    },
    dateCard: {
        width: 60,
        height: 75,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
        borderRadius: 12,
        marginHorizontal: 5,
        borderWidth: 1,
        borderColor: colors.border,
    },
    dateCardActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
        elevation: 5,
    },
    dateMonth: {
        fontSize: 10,
        color: colors.secondary,
        textTransform: 'uppercase',
    },
    dateNumber: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
        marginVertical: 2,
    },
    dateDay: {
        fontSize: 10,
        color: colors.secondary,
    },
    textWhite: {
        color: colors.buttonPrimaryText,
    },
    sessionSelectorContainer: {
        flexDirection: 'row',
        margin: 20,
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 4,
        borderWidth: 1,
        borderColor: colors.border,
    },
    sessionTabHalf: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 8,
        gap: 8,
    },
    sessionTabActive: {
        backgroundColor: colors.primary,
    },
    sessionTabText: {
        color: colors.secondary,
        fontWeight: 'bold',
        fontSize: 14,
    },
    sessionTabTextActive: {
        color: colors.buttonPrimaryText,
    },
    summaryCard: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        backgroundColor: colors.surface,
        marginHorizontal: 20,
        paddingVertical: 20,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        elevation: 2,
    },
    summaryItem: {
        alignItems: 'center',
    },
    summaryValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.primary,
    },
    summaryLabel: {
        fontSize: 12,
        color: colors.secondary,
        marginTop: 4,
    },
    divider: {
        width: 1,
        height: 40,
        backgroundColor: colors.border,
    },
    chartSection: {
        marginTop: 25,
        paddingHorizontal: 20,
    },
    chartTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 10,
    },
    listSection: {
        marginTop: 25,
        paddingHorizontal: 20,
    },
    listTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 15,
    },
    memberCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        padding: 15,
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: colors.border,
    },
    memberAvatar: {
        width: 45,
        height: 45,
        borderRadius: 22.5,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    avatarText: {
        color: colors.primary,
        fontWeight: 'bold',
        fontSize: 18,
    },
    memberInfo: {
        flex: 1,
        marginLeft: 15,
    },
    memberName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.text,
    },
    memberTime: {
        fontSize: 13,
        color: colors.secondary,
        marginTop: 2,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: colors.success + '1A',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 12,
    },
    statusText: {
        color: colors.success,
        fontSize: 12,
        fontWeight: 'bold',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: colors.border,
    },
    emptyText: {
        color: colors.secondary,
        marginTop: 10,
        fontSize: 14,
    },
    fab: {
        position: 'absolute',
        bottom: 30,
        right: 30,
        backgroundColor: colors.primary,
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.background,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: 24,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.text,
    },
    searchInput: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 12,
        color: colors.text,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: colors.border,
    },
    memberListItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    memberSub: {
        fontSize: 12,
        color: colors.secondary,
        marginTop: 2,
    },
    submitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
        padding: 18,
        borderRadius: 12,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    submitBtnText: {
        color: colors.buttonPrimaryText,
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: 1,
    }
});

export default AttendancePage;
