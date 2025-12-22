import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Theme } from '../constants/theme';

interface GameRecord {
  id: string;
  timestamp: number;
  gameType: string;
  duration: number;
  players: number;
  scores: {[key: number]: number};
  winner?: number;
}

const STORAGE_KEY = '@neoxalle_game_history';

// Export function to add game records from other screens
export async function saveGameRecord(record: Omit<GameRecord, 'id'>) {
  const gameRecord: GameRecord = {
    ...record,
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
  };
  
  try {
    const existing = await AsyncStorage.getItem(STORAGE_KEY);
    const history: GameRecord[] = existing ? JSON.parse(existing) : [];
    history.unshift(gameRecord); // Add to beginning
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    console.log('Game saved to database:', gameRecord);
  } catch (error) {
    console.error('Error saving game:', error);
  }
}

export default function DatabaseScreen() {
  const [gameHistory, setGameHistory] = useState<GameRecord[]>([]);
  const [stats, setStats] = useState({
    totalGames: 0,
    totalPresses: 0,
    avgResponseTime: 0,
    fastestTime: 0,
  });

  const loadGameHistory = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        const history: GameRecord[] = JSON.parse(data);
        console.log('Loading game history, count:', history.length);
        setGameHistory(history);
        calculateStats(history);
      } else {
        setGameHistory([]);
      }
    } catch (error) {
      console.error('Error loading game history:', error);
    }
  }, []);

  const calculateStats = (history: GameRecord[]) => {
    const totalGames = history.length;
    let totalPresses = 0;
    let totalResponseTime = 0;
    let fastestTime = Infinity;

    history.forEach(game => {
      Object.values(game.scores).forEach(score => {
        totalPresses += score;
      });
    });

    console.log('Calculated stats:', { totalGames, totalPresses });

    setStats({
      totalGames,
      totalPresses,
      avgResponseTime: totalPresses > 0 ? totalResponseTime / totalPresses : 0,
      fastestTime: fastestTime === Infinity ? 0 : fastestTime,
    });
  };

  const clearHistory = () => {
    Alert.alert(
      'Clear History',
      'Are you sure you want to delete all game records?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem(STORAGE_KEY);
              setGameHistory([]);
              setStats({
                totalGames: 0,
                totalPresses: 0,
                avgResponseTime: 0,
                fastestTime: 0,
              });
            } catch (error) {
              console.error('Error clearing history:', error);
            }
          },
        },
      ]
    );
  };

  useFocusEffect(
    useCallback(() => {
      loadGameHistory();
    }, [loadGameHistory])
  );

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  return (
    <LinearGradient colors={[Theme.background.darkPrimary, Theme.background.darkSecondary]} style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="database" size={40} color={Theme.neon.purpleLight} />
        <Text style={styles.title}>Game Database</Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <BlurView intensity={20} tint="dark" style={styles.statCard}>
          <MaterialCommunityIcons name="trophy" size={30} color={Theme.neon.cyan} />
          <Text style={styles.statValue}>{stats.totalGames}</Text>
          <Text style={styles.statLabel}>Total Games</Text>
        </BlurView>

        <BlurView intensity={20} tint="dark" style={styles.statCard}>
          <MaterialCommunityIcons name="gesture-tap" size={30} color={Theme.neon.purpleLight} />
          <Text style={styles.statValue}>{stats.totalPresses}</Text>
          <Text style={styles.statLabel}>Total Taps</Text>
        </BlurView>

        <BlurView intensity={20} tint="dark" style={styles.statCard}>
          <MaterialCommunityIcons name="speedometer" size={30} color={Theme.neon.pink} />
          <Text style={styles.statValue}>
            {stats.fastestTime > 0 ? `${stats.fastestTime}ms` : '-'}
          </Text>
          <Text style={styles.statLabel}>Fastest Time</Text>
        </BlurView>
      </View>

      {/* Clear History Button */}
      <TouchableOpacity style={styles.clearButton} onPress={clearHistory}>
        <MaterialCommunityIcons name="delete-sweep" size={24} color="#ff4444" />
        <Text style={styles.clearButtonText}>Clear History</Text>
      </TouchableOpacity>

      {/* Game History */}
      <ScrollView style={styles.historyContainer} showsVerticalScrollIndicator={false}>
        {gameHistory.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="database-off" size={60} color="#555" />
            <Text style={styles.emptyText}>No games recorded yet</Text>
            <Text style={styles.emptySubtext}>Play some games to see history here</Text>
          </View>
        ) : (
          gameHistory.map((game, index) => (
            <BlurView key={game.id} intensity={15} tint="dark" style={styles.gameCard}>
              <View style={styles.gameHeader}>
                <View style={styles.gameHeaderLeft}>
                  <MaterialCommunityIcons name="gamepad-variant" size={24} color={Theme.neon.purpleLight} />
                  <View style={styles.gameHeaderInfo}>
                    <Text style={styles.gameType}>{game.gameType}</Text>
                    <Text style={styles.gameDate}>{formatDate(game.timestamp)}</Text>
                  </View>
                </View>
                <View style={styles.gameDuration}>
                  <MaterialCommunityIcons name="clock-outline" size={16} color="#999" />
                  <Text style={styles.gameDurationText}>{game.duration}s</Text>
                </View>
              </View>

              <View style={styles.gameScores}>
                {Object.entries(game.scores).map(([slaveId, score]) => (
                  <View key={slaveId} style={styles.scoreRow}>
                    <View style={styles.scorePlayer}>
                      <MaterialCommunityIcons 
                        name={game.winner === parseInt(slaveId) ? "trophy" : "account"} 
                        size={20} 
                        color={game.winner === parseInt(slaveId) ? Theme.neon.cyan : "#888"} 
                      />
                      <Text style={styles.scorePlayerText}>Player {slaveId}</Text>
                    </View>
                    <Text style={[
                      styles.scoreValue,
                      game.winner === parseInt(slaveId) && styles.scoreValueWinner
                    ]}>
                      {score} taps
                    </Text>
                  </View>
                ))}
              </View>
            </BlurView>
          ))
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 10,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 15,
    borderRadius: 15,
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,68,68,0.15)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.3)',
  },
  clearButtonText: {
    color: '#ff4444',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  historyContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#888',
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  gameCard: {
    padding: 20,
    borderRadius: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  gameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  gameHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gameHeaderInfo: {
    marginLeft: 12,
  },
  gameType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  gameDate: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  gameDuration: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  gameDurationText: {
    color: '#999',
    fontSize: 12,
    marginLeft: 4,
  },
  gameScores: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 15,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  scorePlayer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scorePlayerText: {
    color: '#ccc',
    fontSize: 14,
    marginLeft: 8,
  },
  scoreValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scoreValueWinner: {
    color: Theme.neon.cyan,
  },
});
