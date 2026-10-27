import { View, Text, FlatList, StyleSheet, Pressable, TextInput, Modal, ScrollView, Animated, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../../../constants/ThemeContext';
import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../../../../constants/Config';

// --- Components ---

const FilterChip = ({ label, active, onPress, colors, styles }) => (
    <Pressable style={[styles.filterChip, active && styles.filterChipActive]} onPress={onPress}>
        <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </Pressable>
);

const MemberCard = ({ item, colors, styles }) => (
    <View style={styles.memberCard}>
        <View style={styles.cardHeader}>
            <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
            </View>
            <View style={styles.cardContent}>
                <Text style={styles.memberName}>{item.name}</Text>
                <Text style={styles.memberSubtitle}>{item.memberID || item._id} • {item.subscriptionType || 'No Plan'}</Text>
                <Text style={styles.memberBalance}>Balance: ₹{item.balance || 0}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: item.status === 'Active' ? colors.success : colors.error }]}>
                <Text style={styles.statusText}>{item.status || 'Active'}</Text>
            </View>
        </View>

        <View style={styles.cardActions}>
            <Link href={`/(drawer)/(tabs)/members/${item._id}`} asChild>
                <Pressable style={styles.cardBtnOutline}>
                    <Text style={styles.cardBtnTextOutline}>View Profile</Text>
                </Pressable>
            </Link>
            <Link href={{ pathname: "/(drawer)/(tabs)/members/add", params: { mode: 'update', id: item._id, type: item.role } }} asChild>
                <Pressable style={styles.cardBtnFilled}>
                    <Text style={styles.cardBtnTextFilled}>Update</Text>
                </Pressable>
            </Link>
        </View>
    </View>
);

const FAB = ({ onPress, styles, colors }) => (
    <Pressable style={styles.fab} onPress={onPress}>
        <Ionicons name="add" size={30} color={colors.buttonPrimaryText} />
    </Pressable>
);

// --- Main Screen ---

export default function MembersList() {
    const { colors } = useTheme();
    const { initialFilter } = useLocalSearchParams();
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState(initialFilter || 'All');
    const [roleFilter, setRoleFilter] = useState('Members');

    const styles = getStyles(colors);

    useEffect(() => {
        fetchMembers();
    }, [roleFilter]);

    const fetchMembers = async () => {
        setLoading(true);
        try {
            const roleToken = roleFilter === 'Members' ? 'member' : 'trainer';
            const response = await axios.get(`${API_URL}/members?role=${roleToken}`);
            setMembers(response.data);
        } catch (error) {
            console.log("Fetch members error:", error);
            Alert.alert("Error", "Could not load member list.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchMembers();
    };


    const FILTER_OPTIONS = [
        'All', 'Active', 'Expired', 'A-Z', 'Newest',
        'No plan', 'With balance', 'Expiring in 10 days',
        'Expired in last 10 days', 'Expired in last 30 days',
        'Expired in between 30 and 60 days', 'Expired in between 60 and 90 days',
        'Expired in between 90 and 120 days'
    ];

    useEffect(() => {
        if (initialFilter) setActiveFilter(initialFilter);
    }, [initialFilter]);

    // Animation for Bottom Sheet
    const slideAnim = useRef(new Animated.Value(300)).current;
    const [isSheetVisible, setSheetVisible] = useState(false);

    const openSheet = () => {
        setSheetVisible(true);
        Animated.timing(slideAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
        }).start();
    };

    const closeSheet = () => {
        Animated.timing(slideAnim, {
            toValue: 300,
            duration: 300,
            useNativeDriver: true,
        }).start(() => setSheetVisible(false));
    };

    // --- Filtering Logic ---
    const getFilteredData = () => {
        let data = [...members];

        if (search) {
            data = data.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));
        }

        if (roleFilter === 'Trainers') {
            // Role filtering is already handled by API call, but we can double check
            data = data.filter(m => m.role === 'trainer');
        } else {
            data = data.filter(m => m.role === 'member');
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        switch (activeFilter) {
            case 'Active':
                data = data.filter(m => m.status === 'Active');
                break;
            case 'Expired':
                data = data.filter(m => m.status !== 'Active');
                break;
            case 'A-Z':
                data.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'Newest':
                data.sort((a, b) => parseInt(b.id) - parseInt(a.id));
                break;
            case 'No plan':
                data = data.filter(m => !m.subscriptionType || m.subscriptionType === 'None');
                break;
            case 'With balance':
                data = data.filter(m => (m.balance || 0) > 0);
                break;
            case 'Expiring in 10 days':
                data = data.filter(m => {
                    const diff = Math.ceil((new Date(m.expiryDate) - today) / (1000 * 60 * 60 * 24));
                    return diff >= 0 && diff <= 10;
                });
                break;
            case 'Expired in last 10 days':
                data = data.filter(m => {
                    const ago = -Math.ceil((new Date(m.expiryDate) - today) / (1000 * 60 * 60 * 24));
                    return ago > 0 && ago <= 10;
                });
                break;
            case 'Expired in last 30 days':
                data = data.filter(m => {
                    const ago = -Math.ceil((new Date(m.expiryDate) - today) / (1000 * 60 * 60 * 24));
                    return ago > 0 && ago <= 30;
                });
                break;
            case 'Expired in between 30 and 60 days':
                data = data.filter(m => {
                    const ago = -Math.ceil((new Date(m.expiryDate) - today) / (1000 * 60 * 60 * 24));
                    return ago > 30 && ago <= 60;
                });
                break;
            case 'Expired in between 60 and 90 days':
                data = data.filter(m => {
                    const ago = -Math.ceil((new Date(m.expiryDate) - today) / (1000 * 60 * 60 * 24));
                    return ago > 60 && ago <= 90;
                });
                break;
            case 'Expired in between 90 and 120 days':
                data = data.filter(m => {
                    const ago = -Math.ceil((new Date(m.expiryDate) - today) / (1000 * 60 * 60 * 24));
                    return ago > 90 && ago <= 120;
                });
                break;
            default:
                data.sort((a, b) => parseInt(b.id) - parseInt(a.id));
                break;
        }
        return data;
    };

    const filteredMembers = getFilteredData();

    return (
        <View style={styles.container}>
            <View style={styles.bodyRoleSwitcher}>
                <Pressable
                    style={[styles.roleTab, roleFilter === 'Members' && styles.roleTabActive]}
                    onPress={() => setRoleFilter('Members')}>
                    <Ionicons name="people" size={18} color={roleFilter === 'Members' ? colors.background : colors.secondary} />
                    <Text style={[styles.roleTabText, roleFilter === 'Members' && styles.roleTabTextActive]}>Members</Text>
                </Pressable>
                <Pressable
                    style={[styles.roleTab, roleFilter === 'Trainers' && styles.roleTabActive]}
                    onPress={() => setRoleFilter('Trainers')}>
                    <Ionicons name="fitness" size={18} color={roleFilter === 'Trainers' ? colors.background : colors.secondary} />
                    <Text style={[styles.roleTabText, roleFilter === 'Trainers' && styles.roleTabTextActive]}>Trainers</Text>
                </Pressable>
            </View>

            <View style={styles.filterSection}>
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color={colors.secondary} style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder={`Search ${roleFilter}...`}
                        placeholderTextColor={colors.secondary}
                        value={search}
                        onChangeText={setSearch}
                    />
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                    {FILTER_OPTIONS.map(f => (
                        <FilterChip
                            key={f}
                            label={f}
                            active={activeFilter === f}
                            onPress={() => setActiveFilter(f)}
                            colors={colors}
                            styles={styles}
                        />
                    ))}
                </ScrollView>
            </View>

            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={filteredMembers}
                    renderItem={({ item }) => <MemberCard item={item} colors={colors} styles={styles} />}
                    keyExtractor={item => item._id}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={<Text style={styles.emptyText}>No {roleFilter.toLowerCase()} found.</Text>}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
                    }
                />
            )}


            <FAB onPress={openSheet} styles={styles} colors={colors} />

            <Modal
                transparent
                visible={isSheetVisible}
                animationType="fade"
                onRequestClose={closeSheet}
            >
                <Pressable style={styles.modalBackdrop} onPress={closeSheet}>
                    <Pressable style={styles.bottomSheet} onPress={(e) => e.stopPropagation()}>
                        <View style={styles.sheetHandle} />
                        <Text style={styles.sheetTitle}>Add New</Text>

                        <View style={styles.sheetGrid}>
                            <Pressable
                                style={styles.sheetItem}
                                onPress={() => {
                                    closeSheet();
                                    router.push({ pathname: "/members/add", params: { type: 'member' } });
                                }}
                            >
                                <View style={[styles.sheetIconBox, { backgroundColor: colors.isDark ? '#1E88E520' : '#E3F2FD' }]}>
                                    <Ionicons name="person-add" size={24} color="#1E88E5" />
                                </View>
                                <Text style={styles.sheetItemText}>New Member</Text>
                            </Pressable>

                            <Pressable
                                style={styles.sheetItem}
                                onPress={() => {
                                    closeSheet();
                                    router.push({ pathname: "/members/add", params: { type: 'trainer' } });
                                }}
                            >
                                <View style={[styles.sheetIconBox, { backgroundColor: colors.isDark ? '#43A04720' : '#E8F5E9' }]}>
                                    <MaterialIcons name="fitness-center" size={24} color="#43A047" />
                                </View>
                                <Text style={styles.sheetItemText}>New Trainer</Text>
                            </Pressable>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
}

const getStyles = (colors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    bodyRoleSwitcher: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        margin: 15,
        borderRadius: 12,
        padding: 4,
        borderWidth: 1,
        borderColor: colors.border,
    },
    roleTab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 8,
        gap: 8,
    },
    roleTabActive: {
        backgroundColor: colors.primary,
    },
    roleTabText: {
        fontSize: 14,
        color: colors.secondary,
        fontWeight: 'bold',
    },
    roleTabTextActive: {
        color: colors.buttonPrimaryText,
    },

    // Filters
    filterSection: {
        paddingVertical: 15,
        backgroundColor: colors.background,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        marginHorizontal: 15,
        marginBottom: 15,
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
        paddingVertical: 12,
        color: colors.text,
        fontSize: 16,
    },
    chipScroll: {
        paddingHorizontal: 15,
    },
    filterChip: {
        paddingVertical: 6,
        paddingHorizontal: 16,
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
        fontSize: 13,
    },
    filterChipTextActive: {
        color: colors.buttonPrimaryText,
        fontWeight: 'bold',
    },

    // List
    listContent: {
        padding: 15,
        paddingBottom: 100,
    },
    memberCard: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    avatarText: {
        color: colors.primary,
        fontWeight: 'bold',
        fontSize: 18,
    },
    cardContent: {
        flex: 1,
    },
    memberName: {
        color: colors.text,
        fontSize: 16,
        fontWeight: 'bold',
    },
    memberSubtitle: {
        color: colors.secondary,
        fontSize: 12,
        marginTop: 2,
    },
    memberBalance: {
        color: colors.primary,
        fontSize: 13,
        fontWeight: 'bold',
        marginTop: 4,
    },
    statusBadge: {
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 4,
    },
    statusText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    cardActions: {
        flexDirection: 'row',
        gap: 10,
    },
    cardBtnOutline: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
    },
    cardBtnTextOutline: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '500',
    },
    cardBtnFilled: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: colors.primary,
        alignItems: 'center',
    },
    cardBtnTextFilled: {
        color: colors.buttonPrimaryText,
        fontSize: 14,
        fontWeight: 'bold',
    },
    emptyText: {
        color: colors.secondary,
        textAlign: 'center',
        marginTop: 50,
    },

    // FAB
    fab: {
        position: 'absolute',
        bottom: 20,
        right: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
    },

    // Bottom Sheet
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    bottomSheet: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        paddingBottom: 40,
    },
    sheetHandle: {
        width: 40,
        height: 4,
        backgroundColor: colors.border,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 20,
    },
    sheetTitle: {
        color: colors.text,
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    sheetGrid: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    sheetItem: {
        alignItems: 'center',
    },
    sheetIconBox: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    sheetItemText: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '500',
    },
});
