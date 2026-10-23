import { useState } from 'react';
import {
  FlatList,
  Linking,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import BottomDrawer from '@/components/ui/BottomDrawer';
import { Announcement } from '@/lib/types/Announcement';
import AnnouncementBody from './AnnouncementBody';
import {
  formatAnnouncementDate,
  isSafeAnnouncementLink,
  POPUP_PRIORITY,
} from '@/lib/announcements';

type Props = {
  visible: boolean;
  onClose: () => void;
  announcements: Announcement[];
  refreshing: boolean;
  onRefresh: () => void;
  onRead: (id: string) => void;
};

export default function AnnouncementsDrawer({
  visible,
  onClose,
  announcements,
  refreshing,
  onRefresh,
  onRead,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggle = (announcement: Announcement) => {
    setExpandedId((current) =>
      current === announcement.id ? null : announcement.id,
    );
    if (!announcement.read) onRead(announcement.id);
  };

  const renderItem = ({ item }: { item: Announcement }) => {
    const expanded = expandedId === item.id;
    const important = item.priority >= POPUP_PRIORITY;

    return (
      <TouchableOpacity
        onPress={() => toggle(item)}
        activeOpacity={0.8}
        accessibilityRole='button'
        accessibilityState={{ expanded }}
        className={`mb-3 rounded-xl border p-4 ${
          item.read ? 'border-gray-200 bg-white' : 'border-primary-400 bg-primary-200'
        }`}
      >
        <View className='flex-row items-start'>
          <Ionicons
            name={important ? 'alert-circle-outline' : 'notifications-outline'}
            size={22}
            color={important ? '#f75555' : '#2368fd'}
            style={{ marginRight: 10, marginTop: 1 }}
          />
          <View className='flex-1'>
            <Text
              className={`text-base text-black-300 ${
                item.read ? 'font-rubik-medium' : 'font-rubik-bold'
              }`}
            >
              {item.title}
            </Text>
            <Text className='mt-1 text-xs font-rubik text-black-100'>
              {formatAnnouncementDate(item.validFrom)}
            </Text>
            <AnnouncementBody
              body={item.body}
              className='mt-2 text-sm font-rubik text-black-200'
              numberOfLines={expanded ? undefined : 2}
            />
            {expanded && isSafeAnnouncementLink(item.link) && (
              <TouchableOpacity
                onPress={() => Linking.openURL(item.link!.trim())}
                className='mt-3 self-start flex-row items-center'
                accessibilityRole='link'
              >
                <Ionicons name='open-outline' size={16} color='#2368fd' />
                <Text className='ml-1 text-sm font-rubik-medium text-primary-500'>
                  Otvori link
                </Text>
              </TouchableOpacity>
            )}
          </View>
          {!item.read && (
            <View
              className='ml-2 mt-1 rounded-full bg-primary-500'
              style={{ width: 8, height: 8 }}
              accessibilityLabel='Nepročitano'
            />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <BottomDrawer visible={visible} onClose={onClose} heightRatio={0.7}>
      <Text className='mb-4 text-xl font-rubik-bold text-black-300'>
        Obaveštenja
      </Text>
      <FlatList
        data={announcements}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <Text className='mt-10 text-center text-base font-rubik text-black-100'>
            Nema novih obaveštenja
          </Text>
        }
      />
    </BottomDrawer>
  );
}
