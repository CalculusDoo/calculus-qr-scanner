import { Linking, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Announcement } from '@/lib/types/Announcement';
import { isSafeAnnouncementLink } from '@/lib/announcements';
import AnnouncementBody from './AnnouncementBody';

type Props = {
  announcement: Announcement | null;
  onClose: (announcement: Announcement) => void;
};

export default function AnnouncementPopup({ announcement, onClose }: Props) {
  if (!announcement) return null;

  const close = () => onClose(announcement);

  return (
    <Modal visible transparent animationType='fade' onRequestClose={close}>
      <View
        className='flex-1 items-center justify-center px-6'
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      >
        <View className='w-full rounded-2xl bg-white p-6' style={{ maxHeight: '75%' }}>
          <View className='mb-3 flex-row items-center'>
            <Ionicons name='alert-circle-outline' size={26} color='#f75555' />
            <Text className='ml-2 flex-1 text-lg font-rubik-bold text-black-300'>
              {announcement.title}
            </Text>
          </View>
          <ScrollView>
            <AnnouncementBody body={announcement.body} className='text-base font-rubik text-black-200' />
          </ScrollView>

          {isSafeAnnouncementLink(announcement.link) && (
            <TouchableOpacity
              onPress={() => {
                Linking.openURL(announcement.link!.trim());
                close();
              }}
              className='mt-5 rounded-full border border-primary-500 py-3'
              accessibilityRole='link'
            >
              <Text className='text-center text-base font-rubik-medium text-primary-500'>
                Otvori link
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={close}
            className='mt-3 rounded-full bg-primary-500 py-3'
            accessibilityRole='button'
          >
            <Text className='text-center text-base font-rubik-medium text-white'>
              U redu
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
