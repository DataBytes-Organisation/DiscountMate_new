import React from 'react';
import { View, FlatList, Text, StyleSheet, TouchableOpacity} from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import AsyncStorage from '@react-native-async-storage/async-storage';
/*
TODO
add notifications to go to logged in user via fetching a uuid or something
retrieve information from backend about products and wait till a users favourite item has a new deal and send to user
change notif aesthetic as its not the best
*/
export interface BellNotification {
  id: string;
  title: string;
  message: string;
  read: boolean;
}

interface NotifBellProps {
  notifications: BellNotification[];
  setNotifications: React.Dispatch<React.SetStateAction<BellNotification[]>>;
}

const addNotification = (
  setNotifications: React.Dispatch<React.SetStateAction<BellNotification[]>>,
  notification: BellNotification) => {
  setNotifications(prevNotifications => [
    { ...notification}, ...prevNotifications,
  ]);
};
//sending test notif with following information, remove if not needed anymore
export const sendTestNotification = (
  notifications: BellNotification[],
  setNotifications: React.Dispatch<React.SetStateAction<BellNotification[]>>) => {
  const newNotification = {
    id: uuidv4(),
    title: 'Test',
    message: 'This "item" is now on sale',
    read: false,
  };
  addNotification(setNotifications, newNotification);
};

export const loadNotifications = async (
  setNotifications: React.Dispatch<React.SetStateAction<BellNotification[]>>) => {
  try {
    const savedNotifications = await AsyncStorage.getItem('notifications');
    if (savedNotifications) {
      setNotifications(JSON.parse(savedNotifications));
    }
  } catch (e) {
  }
};

const NotifBell: React.FC<NotifBellProps> = ({notifications, setNotifications}) => {
  const markAsRead = (id: string) => {
    const updatedNotifications = notifications.map(notif => notif.id === id ? { ...notif, read: true } : notif
    );
    setNotifications(updatedNotifications);
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id)
    );
  };

  const saveNotifications = async(notifications: BellNotification[]) => {
    try {
      await AsyncStorage.setItem('notifications', JSON.stringify(notifications));
    } catch(e) {
    }
  };

  React.useEffect(() => {
    saveNotifications(notifications);
  }, [notifications]);

  return (
    <View style={styles.container}>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.notification}>
            <View style={styles.notificationContent}>
              <View style={styles.notificationText}>
                <Text style={{ fontWeight: item.read ? 'normal' : 'bold' }}>
                  {item.title}
                </Text>
              <Text>{item.message}</Text>
              </View>
                {!item.read && (
                  <TouchableOpacity
                    style={styles.button}
                    onPress={() => markAsRead(item.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.buttonText}>Read</Text>
                  </TouchableOpacity>
                )}
                  <TouchableOpacity
                    style={styles.button}
                    onPress={() => deleteNotification(item.id)}
                    activeOpacity={0.7}
                  >
                <Text style={styles.buttonText}>Del</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>No new notifications</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    maxHeight: 250,
  },
  notification: {
    flexDirection: 'column',
    padding: 10,
    borderBottomWidth: 1,
  },
  notificationContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  notificationText: {
    flex: 1,
  },
  button: {
    flexDirection: 'row',
    padding: 5,
    alignSelf: 'flex-start',
    justifyContent: 'flex-end',
    borderRadius: 5,
    gap: 5,
    marginTop: 5,
    backgroundColor: '#6595a3',
  },
  buttonText: {
    color: '#fff',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#777',
  },
});

export default NotifBell;