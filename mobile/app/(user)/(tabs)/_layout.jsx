import { Tabs, useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, View, Text, AppState } from 'react-native';
import { DrawerActions } from '@react-navigation/native';
import { useTheme } from '../../../constants/ThemeContext';
import { useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '../../../constants/Config';

export default function UserTabLayout() {
    const navigation = useNavigation();
    const router = useRouter();
    const { colors } = useTheme();
    const [unreadCount, setUnreadCount] = useState(0);
    const memberIdRef = useRef(null); // cache memberId so we don't re-fetch member on every refresh
    const intervalRef = useRef(null);
    const appState = useRef(AppState.currentState);

    const toggleDrawer = () => {
        navigation.dispatch(DrawerActions.openDrawer());
    };

    // Get memberId once and cache it
    const getMemberId = async () => {
        if (memberIdRef.current) return memberIdRef.current;
        try {
            const userJson = await AsyncStorage.getItem('userData');
            const user = JSON.parse(userJson);
            if (!user) return null;
            const memberRes = await axios.get(`${API_URL}/members/${user.email || user._id}`);
            memberIdRef.current = memberRes.data._id;
            return memberIdRef.current;
        } catch (e) {
            return null;
        }
    };

    // Fast unread count fetch — uses cached memberId
    const fetchUnread = useCallback(async () => {
        try {
            const memberId = await getMemberId();
            if (!memberId) return;
            const res = await axios.get(`${API_URL}/messages/unread-count/${memberId}`);
            setUnreadCount(res.data.count || 0);
        } catch (e) {
            // silently fail — don't crash if backend is down
        }
    }, []);

    useEffect(() => {
        // Initial fetch
        fetchUnread();

        // Poll every 15 seconds (faster than 60s)
        intervalRef.current = setInterval(fetchUnread, 15000);

        // Also re-fetch when app comes back to foreground
        const appStateSubscription = AppState.addEventListener('change', (nextState) => {
            if (appState.current.match(/inactive|background/) && nextState === 'active') {
                fetchUnread();
            }
            appState.current = nextState;
        });

        return () => {
            clearInterval(intervalRef.current);
            appStateSubscription.remove();
        };
    }, [fetchUnread]);

    // Expose fetchUnread so tab screens can trigger it (via navigation event)
    const InboxButton = () => (
        <Pressable
            onPress={() => {
                router.push('/(user)/(tabs)/inbox');
            }}
            style={{ marginRight: 15, position: 'relative' }}
        >
            <Ionicons name="mail-outline" size={26} color={colors.primary} />
            {unreadCount > 0 && (
                <View style={{
                    position: 'absolute', top: -5, right: -6,
                    backgroundColor: '#F44336', borderRadius: 10,
                    minWidth: 18, height: 18, justifyContent: 'center',
                    alignItems: 'center', paddingHorizontal: 3,
                }}>
                    <Text style={{ color: '#FFF', fontSize: 10, fontWeight: 'bold' }}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </Text>
                </View>
            )}
        </Pressable>
    );

    return (
        <Tabs
            // Re-fetch unread count every time ANY tab is focused
            screenListeners={{
                focus: () => {
                    fetchUnread();
                },
            }}
            screenOptions={{
                headerShown: true,
                headerStyle: {
                    backgroundColor: colors.background,
                    borderBottomColor: colors.border,
                    borderBottomWidth: 1,
                },
                headerTitleStyle: {
                    color: colors.primary,
                    fontWeight: 'bold',
                    fontSize: 20,
                },
                tabBarStyle: {
                    backgroundColor: colors.background,
                    borderTopColor: colors.border,
                    height: 60,
                    paddingBottom: 5,
                },
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.secondary,
                headerLeft: () => (
                    <Pressable onPress={toggleDrawer} style={{ marginLeft: 15 }}>
                        <Ionicons name="menu" size={28} color={colors.primary} />
                    </Pressable>
                ),
                headerRight: () => <InboxButton />,
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Dashboard',
                    headerTitle: 'BIGBUDDY',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="home" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="attendance"
                options={{
                    title: 'Attendance',
                    headerTitle: 'BIGBUDDY ATTENDANCE',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="calendar" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="workout"
                options={{
                    title: 'Workout',
                    headerTitle: 'BIGBUDDY WORKOUT',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="barbell" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="diet"
                options={{
                    title: 'Diet',
                    headerTitle: 'BIGBUDDY DIET',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="restaurant" size={size} color={color} />
                    ),
                }}
            />
            {/* inbox screen registered but hidden from tab bar */}
            <Tabs.Screen
                name="inbox"
                options={{
                    title: 'Inbox',
                    headerTitle: 'INBOX',
                    tabBarButton: () => null,
                    tabBarItemStyle: { display: 'none' },
                }}
                listeners={{
                    // When inbox screen comes into focus, re-fetch unread after a short delay
                    // (so it picks up changes made while browsing inbox)
                    blur: () => {
                        // User left inbox — refresh badge as they may have read messages
                        setTimeout(fetchUnread, 500);
                    },
                }}
            />
        </Tabs>
    );
}
