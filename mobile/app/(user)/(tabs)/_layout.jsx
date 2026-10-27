import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, View, Text, AppState } from 'react-native';
import { darkTheme } from '../../../constants/ThemeContext';
import { useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '../../../constants/Config';

export default function UserTabLayout() {
    const router = useRouter();
    // User side is strictly Dark Mode only
    const colors = darkTheme;
    const [unreadCount, setUnreadCount] = useState(0);
    const memberIdRef = useRef(null);
    const intervalRef = useRef(null);
    const appState = useRef(AppState.currentState);

    // Get memberId once and cache it
    const getMemberId = async () => {
        if (memberIdRef.current) return memberIdRef.current;
        try {
            const userJson = await AsyncStorage.getItem('userData');
            const user = JSON.parse(userJson);
            if (!user) return null;
            const identifier = user.memberId || user.email || user._id;
            const memberRes = await axios.get(`${API_URL}/members/${identifier}`);
            memberIdRef.current = memberRes.data._id;
            return memberIdRef.current;
        } catch (e) {
            return null;
        }
    };

    // Fast unread count fetch
    const fetchUnread = useCallback(async () => {
        try {
            const memberId = await getMemberId();
            if (!memberId) return;
            const res = await axios.get(`${API_URL}/messages/unread-count/${memberId}`);
            setUnreadCount(res.data.count || 0);
        } catch (e) {
            // silently fail
        }
    }, []);

    useEffect(() => {
        fetchUnread();
        intervalRef.current = setInterval(fetchUnread, 15000);

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

    const InboxButton = () => (
        <Pressable
            onPress={() => {
                router.push('/(user)/(tabs)/inbox');
            }}
            style={{ marginRight: 16, position: 'relative' }}
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
                    letterSpacing: 0.5,
                },
                tabBarStyle: {
                    backgroundColor: colors.background,
                    borderTopColor: colors.border,
                    height: 60,
                    paddingBottom: 6,
                    paddingTop: 4,
                },
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.secondary,
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
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile',
                    headerTitle: 'MY PROFILE',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="person" size={size} color={color} />
                    ),
                }}
            />
            {/* Inbox screen registered for navigation, hidden from tab bar */}
            <Tabs.Screen
                name="inbox"
                options={{
                    title: 'Inbox',
                    headerTitle: 'INBOX',
                    tabBarButton: () => null,
                    tabBarItemStyle: { display: 'none' },
                }}
                listeners={{
                    blur: () => {
                        setTimeout(fetchUnread, 500);
                    },
                }}
            />
        </Tabs>
    );
}
