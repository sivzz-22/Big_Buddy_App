import { Tabs, Link, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { DrawerActions } from '@react-navigation/native';
import { useTheme } from '../../../constants/ThemeContext';

export default function TabLayout() {
    const navigation = useNavigation();
    const { colors } = useTheme();

    const toggleDrawer = () => {
        navigation.dispatch(DrawerActions.openDrawer());
    };

    const headerLeftCheck = () => (
        <Pressable onPress={toggleDrawer} style={{ marginLeft: 15 }}>
            <Ionicons name="menu" size={28} color={colors.primary} />
        </Pressable>
    );

    return (
        <Tabs
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
                headerTintColor: colors.primary,
                headerLeft: headerLeftCheck,
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Dashboard',
                    headerTitle: 'BIGBUDDY',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="stats-chart" size={size} color={color} />
                    ),
                    headerRight: () => (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 15 }}>
                            <Link href="/notifications" asChild>
                                <Pressable style={{ marginRight: 15 }}>
                                    <Ionicons name="notifications-outline" size={24} color={colors.primary} />
                                </Pressable>
                            </Link>
                            <Link href="/chats" asChild>
                                <Pressable>
                                    <Ionicons name="chatbubble-ellipses-outline" size={24} color={colors.primary} />
                                </Pressable>
                            </Link>
                        </View>
                    ),
                }}
            />
            <Tabs.Screen
                name="members"
                options={{
                    title: 'Members',
                    headerTitle: 'MEMBERS',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="people" size={size} color={color} />
                    ),
                    headerRight: () => (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 15 }}>
                            <Link href="/notifications" asChild>
                                <Pressable style={{ marginRight: 15 }}>
                                    <Ionicons name="notifications-outline" size={24} color={colors.primary} />
                                </Pressable>
                            </Link>
                            <Link href="/chats" asChild>
                                <Pressable>
                                    <Ionicons name="chatbubble-ellipses-outline" size={24} color={colors.primary} />
                                </Pressable>
                            </Link>
                        </View>
                    ),
                }}
            />
            <Tabs.Screen
                name="transactions"
                options={{
                    title: 'Transactions',
                    headerTitle: 'Transactions',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="card" size={size} color={color} />
                    ),
                }}
            />

            <Tabs.Screen
                name="attendance"
                options={{
                    title: 'Attendance',
                    headerTitle: 'Daily Attendance',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="calendar" size={size} color={color} />
                    ),
                }}
            />

            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile',
                    headerTitle: 'Admin Profile',
                    tabBarButton: () => null,
                    tabBarItemStyle: { display: 'none' },
                }}
            />
        </Tabs>
    );
}
