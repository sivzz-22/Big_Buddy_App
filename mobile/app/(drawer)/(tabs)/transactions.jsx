import { View, Text, FlatList, StyleSheet, Pressable, TextInput, Modal, Alert, ActivityIndicator } from 'react-native';
import { useTheme } from '../../../constants/ThemeContext';
import { useState, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useNavigation, router, useFocusEffect } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../../../constants/Config';
import { Image } from 'react-native';

// --- Components ---

const FilterChip = ({ label, active, onPress, colors, styles }) => (
    <Pressable style={[styles.filterChip, active && styles.filterChipActive]} onPress={onPress}>
        <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </Pressable>
);

const TransactionCard = ({ item, colors, styles, onInvoiceSent }) => {
    // Determine card accent color
    let accentColor = colors.primary;
    if (item.planType?.includes('Year')) accentColor = '#FFD700';
    else if (item.planType?.includes('Quarter')) accentColor = '#AB47BC';
    else accentColor = '#42A5F5';

    const isAdvance = item.amount === 500;
    if (isAdvance) accentColor = '#FFA726';

    const sendInvoice = () => {
        router.push({ pathname: '/chats', params: { filter: 'invoices' } });
    };

    return (
        <View style={[styles.transactionCard, { borderLeftColor: accentColor }]}>
            <View style={styles.cardInfo}>
                <Text style={styles.memberName}>{item.memberName}</Text>
                <Text style={styles.planDetails}>{item.planType || 'Regular'} • {new Date(item.date).toLocaleDateString()}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
                {item.invoiceSent ? (
                    <View style={styles.messageIcon}>
                        <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                    </View>
                ) : (
                    <Pressable onPress={sendInvoice} style={styles.messageIcon}>
                        <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.primary} />
                    </Pressable>
                )}
                <View style={styles.cardAmount}>
                    <Text style={[styles.amount, { color: isAdvance ? '#FFA726' : colors.success }]}>
                        +₹{item.amount.toLocaleString()}
                    </Text>
                    <Text style={styles.mode}>{item.paymentMode}</Text>
                </View>
            </View>
        </View>
    );
};

const AddTransactionModal = ({ visible, onClose, onSave, colors, styles }) => {
    const [memberName, setMemberName] = useState('');
    const [selectedMemberId, setSelectedMemberId] = useState(null);
    const [amount, setAmount] = useState('');
    const [plan, setPlan] = useState('Monthly');
    const [paymentMode, setPaymentMode] = useState('Cash');
    const [loading, setLoading] = useState(false);
    const [allMembers, setAllMembers] = useState([]);
    const [filteredMembers, setFilteredMembers] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    useEffect(() => {
        if (visible) {
            fetchMembers();
        }
    }, [visible]);

    const fetchMembers = async () => {
        try {
            const res = await axios.get(`${API_URL}/members?role=member`);
            setAllMembers(res.data);
        } catch (error) {
            console.log("Fetch members error:", error);
        }
    };

    const handleSearch = (text) => {
        setMemberName(text);
        if (text.length > 0) {
            const matches = allMembers.filter(m =>
                m.name.toLowerCase().includes(text.toLowerCase()) ||
                m.memberID.toLowerCase().includes(text.toLowerCase())
            );
            setFilteredMembers(matches.slice(0, 5)); // Show top 5
            setShowSuggestions(true);
        } else {
            setFilteredMembers([]);
            setShowSuggestions(false);
        }
    };

    const selectMember = (member) => {
        setMemberName(member.name);
        setSelectedMemberId(member._id);
        setShowSuggestions(false);
    };

    const handleSave = async () => {
        if (!memberName || !amount) {
            Alert.alert("Error", "Please enter member name and amount");
            return;
        }

        // Validation: Must be an existing member and selected from suggestions
        const memberExists = allMembers.find(m => m.name.toLowerCase() === memberName.toLowerCase() && (selectedMemberId ? m._id === selectedMemberId : true));
        
        if (!memberExists || !selectedMemberId) {
            Alert.alert("Error", "Please select a member from the dropdown suggestions to ensure they exist in the database.");
            return;
        }

        setLoading(true);
        try {
            await axios.post(`${API_URL}/transactions`, {
                memberID: selectedMemberId,
                memberName,
                amount: Number(amount),
                planType: plan,
                paymentMode
            });
            Alert.alert("Success", `${paymentMode} transaction recorded!`);
            setMemberName(''); setAmount('');
            onSave();
            onClose();
        } catch (error) {
            console.log("Add transaction error:", error);
            Alert.alert("Error", "Could not save transaction.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { maxHeight: '90%' }]}>
                    <View style={styles.modalTop}>
                        <Text style={styles.modalTitle}>Add New Transaction</Text>
                        <Pressable onPress={onClose}>
                            <Ionicons name="close" size={24} color={colors.text} />
                        </Pressable>
                    </View>

                    <View style={{ zIndex: 10 }}>
                        <TextInput
                            style={styles.input}
                            placeholder="Member Name"
                            placeholderTextColor={colors.secondary}
                            value={memberName}
                            onChangeText={handleSearch}
                        />
                        {showSuggestions && filteredMembers.length > 0 && (
                            <View style={{
                                backgroundColor: colors.background,
                                borderRadius: 10,
                                borderWidth: 1,
                                borderColor: colors.border,
                                marginTop: -10,
                                marginBottom: 15,
                                elevation: 3,
                                zIndex: 20
                            }}>
                                {filteredMembers.map(m => (
                                    <Pressable
                                        key={m._id}
                                        onPress={() => selectMember(m)}
                                        style={{
                                            padding: 12,
                                            borderBottomWidth: 1,
                                            borderBottomColor: colors.border,
                                            flexDirection: 'row',
                                            justifyContent: 'space-between'
                                        }}
                                    >
                                        <Text style={{ color: colors.text, fontWeight: '600' }}>{m.name}</Text>
                                        <Text style={{ color: colors.secondary, fontSize: 12 }}>{m.memberID}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        )}
                    </View>

                    <TextInput
                        style={styles.input}
                        placeholder="Amount (₹)"
                        placeholderTextColor={colors.secondary}
                        keyboardType="numeric"
                        value={amount}
                        onChangeText={setAmount}
                    />

                    <Text style={[styles.statLabel, { marginBottom: 10 }]}>Payment Mode</Text>
                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                        {['Cash', 'UPI', 'GPay'].map(m => (
                            <Pressable
                                key={m}
                                onPress={() => setPaymentMode(m)}
                                style={[styles.filterChip, paymentMode === m && styles.filterChipActive]}
                            >
                                <Text style={[styles.filterChipText, paymentMode === m && styles.filterChipTextActive]}>{m}</Text>
                            </Pressable>
                        ))}
                    </View>

                    <Text style={[styles.statLabel, { marginBottom: 10 }]}>Select Plan</Text>
                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                        {['Monthly', 'Quarterly', 'Yearly'].map(p => (
                            <Pressable
                                key={p}
                                onPress={() => setPlan(p)}
                                style={[styles.filterChip, plan === p && styles.filterChipActive]}
                            >
                                <Text style={[styles.filterChipText, plan === p && styles.filterChipTextActive]}>{p}</Text>
                            </Pressable>
                        ))}
                    </View>

                    <Pressable style={styles.btnSaveFull} onPress={handleSave} disabled={loading}>
                        {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnSaveText}>Save Transaction</Text>}
                    </Pressable>
                </View>
            </View>
        </Modal>
    )
}


const QRModal = ({ visible, onClose, qrImage, colors, styles }) => {
    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { alignItems: 'center', padding: 30 }]}>
                    <View style={styles.modalTop}>
                        <Text style={styles.modalTitle}>Bank QR Code</Text>
                        <Pressable onPress={onClose} style={{ padding: 5 }}>
                            <Ionicons name="close" size={24} color={colors.text} />
                        </Pressable>
                    </View>

                    {qrImage ? (
                        <Image
                            source={{ uri: qrImage }}
                            style={{ width: 250, height: 250, borderRadius: 12, marginTop: 20 }}
                            resizeMode="contain"
                        />
                    ) : (
                        <View style={{ width: 250, height: 250, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', borderRadius: 12, marginTop: 20 }}>
                            <Ionicons name="qr-code-outline" size={80} color={colors.secondary} />
                            <Text style={{ color: colors.secondary, marginTop: 10 }}>No QR Uploaded</Text>
                        </View>
                    )}

                    <Text style={{ color: colors.secondary, textAlign: 'center', marginTop: 20, fontSize: 13 }}>
                        Scan this QR code using any UPI app (GPay, PhonePe, etc.) to complete the payment.
                    </Text>

                    <Pressable style={[styles.submitBtn, { width: '100%', marginTop: 30 }]} onPress={onClose}>
                        <Text style={styles.submitBtnText}>CLOSE</Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}

// --- Main Screen ---

export default function Transactions() {
    const { colors } = useTheme();
    const navigation = useNavigation();
    const params = useLocalSearchParams();
    const [transactions, setTransactions] = useState([]);
    const [summary, setSummary] = useState({ totalRevenue: 0, upiRevenue: 0, cashRevenue: 0 });
    const [gymData, setGymData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState('ALL');
    const [isModalVisible, setModalVisible] = useState(false);
    const [isQRModalVisible, setQRModalVisible] = useState(false);

    const styles = getStyles(colors);

    useEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 15 }}>
                    <Pressable style={{ marginRight: 15 }} onPress={() => router.push('/notifications')}>
                        <Ionicons name="notifications-outline" size={24} color={colors.primary} />
                    </Pressable>
                    <Pressable style={{ marginRight: 15 }} onPress={() => router.push('/chats')}>
                        <Ionicons name="chatbubble-ellipses-outline" size={24} color={colors.primary} />
                    </Pressable>
                    <Pressable onPress={() => setQRModalVisible(true)}>
                        <Ionicons name="qr-code" size={24} color={colors.primary} />
                    </Pressable>
                </View>
            ),
        });
    }, [navigation, colors]);

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [activeFilter, params.date])
    );

    useEffect(() => {
        if (params.paymentMethod) {
            const method = params.paymentMethod.toUpperCase();
            if (method === 'ALL') setActiveFilter('ALL');
            else if (method === 'GPAY' || method === 'UPI') setActiveFilter('UPI');
            else if (method === 'CASH') setActiveFilter('CASH');
            else setActiveFilter('ALL');
        }
    }, [params.paymentMethod]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const dateParam = params.date ? `?date=${params.date}` : '';
            const [tRes, sRes, gRes] = await Promise.all([
                axios.get(`${API_URL}/transactions${dateParam}`),
                axios.get(`${API_URL}/transactions/summary`),
                axios.get(`${API_URL}/gym`)
            ]);
            setTransactions(tRes.data);
            setSummary(sRes.data);
            setGymData(gRes.data);
        } catch (error) {
            console.log("Fetch transactions error:", error);
            Alert.alert("Error", "Could not load transactions.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const getFilteredData = () => {
        let data = [...transactions];

        if (search) {
            data = data.filter(t => t.memberName.toLowerCase().includes(search.toLowerCase()));
        }

        switch (activeFilter) {
            case 'UPI':
                data = data.filter(t => t.paymentMode === 'UPI' || t.paymentMode === 'GPay');
                break;
            case 'CASH':
                data = data.filter(t => t.paymentMode === 'Cash');
                break;
            case 'New':
                data.sort((a, b) => new Date(b.date) - new Date(a.date));
                break;
            case 'Old':
                data.sort((a, b) => new Date(a.date) - new Date(b.date));
                break;
            case 'ALL':
            default:
                data.sort((a, b) => new Date(b.date) - new Date(a.date));
        }

        return data;
    };

    const filteredData = getFilteredData();

    return (
        <View style={styles.container}>
            <View style={styles.statsContainer}>
                <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Total Revenue</Text>
                    <Text style={styles.statValue}>₹{summary.totalRevenue.toLocaleString()}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statSubRow}>
                    <View style={styles.subStat}>
                        <Text style={styles.subStatLabel}>Via UPI</Text>
                        <Text style={styles.subStatValue}>₹{summary.upiRevenue.toLocaleString()}</Text>
                    </View>
                    <View style={styles.verticalLine} />
                    <View style={styles.subStat}>
                        <Text style={styles.subStatLabel}>Via Cash</Text>
                        <Text style={styles.subStatValue}>₹{summary.cashRevenue.toLocaleString()}</Text>
                    </View>
                </View>
            </View>

            <View style={styles.filterContainer}>
                <View style={styles.searchRow}>
                    <Ionicons name="search" size={20} color={colors.secondary} style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search Member..."
                        placeholderTextColor={colors.secondary}
                        value={search}
                        onChangeText={setSearch}
                    />
                </View>

                <View>
                    <FlatList
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        data={['ALL', 'New', 'Old', 'UPI', 'CASH']}
                        renderItem={({ item }) => (
                            <FilterChip
                                label={item}
                                active={activeFilter === item}
                                onPress={() => setActiveFilter(item)}
                                colors={colors}
                                styles={styles}
                            />
                        )}
                        keyExtractor={i => 'filter-' + i}
                        contentContainerStyle={{ paddingHorizontal: 15 }}
                    />
                </View>
            </View>

            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={filteredData}
                    renderItem={({ item }) => <TransactionCard item={item} colors={colors} styles={styles} />}
                    keyExtractor={item => item._id}
                    contentContainerStyle={styles.list}
                    onRefresh={onRefresh}
                    refreshing={refreshing}
                    ListEmptyComponent={<Text style={{ color: colors.secondary, textAlign: 'center', marginTop: 40 }}>No transactions found</Text>}
                />
            )}

            <Pressable style={styles.fab} onPress={() => setModalVisible(true)}>
                <Ionicons name="add" size={32} color={colors.buttonPrimaryText} />
            </Pressable>

            <AddTransactionModal
                visible={isModalVisible}
                onClose={() => setModalVisible(false)}
                onSave={fetchData}
                colors={colors}
                styles={styles}
            />

            <QRModal
                visible={isQRModalVisible}
                onClose={() => setQRModalVisible(false)}
                qrImage={gymData?.qrCode}
                colors={colors}
                styles={styles}
            />
        </View>
    );
}


const getStyles = (colors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    // Stats Header
    statsContainer: {
        backgroundColor: colors.surface,
        padding: 20,
        margin: 15,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    statRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    statLabel: {
        color: colors.secondary,
        fontSize: 14,
    },
    statValue: {
        color: colors.success,
        fontSize: 24,
        fontWeight: 'bold',
    },
    statDivider: {
        height: 1,
        backgroundColor: colors.border,
        marginVertical: 10,
    },
    statSubRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    subStat: {
        alignItems: 'center',
    },
    subStatLabel: {
        color: colors.secondary,
        fontSize: 12,
        marginBottom: 4,
    },
    subStatValue: {
        color: colors.text,
        fontSize: 16,
        fontWeight: 'bold',
    },
    verticalLine: {
        width: 1,
        height: 30,
        backgroundColor: colors.border,
    },

    // Filters
    filterContainer: {
        marginBottom: 5,
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        marginHorizontal: 15,
        marginBottom: 10,
        paddingHorizontal: 15,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 10,
        color: colors.text,
    },
    filterChip: {
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        marginRight: 8,
    },
    filterChipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    filterChipText: {
        color: colors.secondary,
        fontSize: 12,
    },
    filterChipTextActive: {
        color: colors.buttonPrimaryText,
        fontWeight: 'bold',
    },

    // List
    list: {
        padding: 15,
        paddingBottom: 80,
    },
    transactionCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: colors.surface,
        padding: 15,
        marginBottom: 10,
        borderRadius: 8,
        borderLeftWidth: 4, // Accent color
        borderWidth: 1,     // Other sides
        borderColor: colors.border,
    },
    cardInfo: {
        justifyContent: 'center',
    },
    memberName: {
        color: colors.primary,
        fontSize: 16,
        fontWeight: 'bold',
    },
    planDetails: {
        color: colors.secondary,
        fontSize: 12,
        marginTop: 4,
    },
    cardAmount: {
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    amount: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    mode: {
        color: colors.secondary,
        fontSize: 12,
        marginTop: 4,
    },

    // FAB Styles
    fab: {
        position: 'absolute',
        bottom: 25,
        right: 20,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
    },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: colors.border,
    },
    modalTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.primary,
    },
    input: {
        backgroundColor: colors.background,
        color: colors.text,
        padding: 14,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 15,
        fontSize: 16,
    },
    btnSaveFull: {
        backgroundColor: colors.primary,
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 10,
    },
    btnSaveText: {
        color: colors.buttonPrimaryText,
        fontWeight: 'bold',
        fontSize: 16,
    },
});
