/**
 * VocabularyScreen — Quran vocabulary learning module.
 *
 * NOT a route (no default export) — rendered inline inside the Quran tab toggle.
 *
 * Features:
 *  • Category filter chips (horizontally scrollable)
 *  • Search bar (arabic / transliteration / english)
 *  • Flashcard-style VocabCards with 3D flip
 *  • Progress bar: X/100 words learned
 *  • Shuffle button to randomize study order
 *  • Learned words persisted to AsyncStorage
 */

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import VocabCard, { CARD_HEIGHT, type VocabWord } from '@/components/VocabCard';
import { useTheme } from '@/context/ThemeContext';
import rawVocab from '@/data/quranVocab.json';

// ─── Data ─────────────────────────────────────────────────────────────────────

const vocab = rawVocab as VocabWord[];
const TOTAL = vocab.length; // 100

// ─── Constants ────────────────────────────────────────────────────────────────

const LEARNED_KEY    = 'salah_vocab_learned_v1';
const ITEM_HEIGHT    = CARD_HEIGHT + 12; // card + marginBottom

const ALL_CATEGORIES = [
  'All',
  'Allah & worship',
  'faith & belief',
  'guidance & knowledge',
  'people & prophets',
  'actions & deeds',
  'nature & creation',
  'time & place',
];

// ─── Fisher-Yates shuffle ────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Category chip ────────────────────────────────────────────────────────────

function CategoryChip({
  label,
  active,
  onPress,
}: {
  label:   string;
  active:  boolean;
  onPress: () => void;
}) {
  const { colors, palette } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.chip,
        {
          backgroundColor: active ? palette.gold : colors.cardAlt,
          borderColor:     active ? palette.gold : colors.border,
        },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          { color: active ? palette.onGold : colors.textMuted },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ learned, total }: { learned: number; total: number }) {
  const { colors, palette } = useTheme();
  const frac = total > 0 ? learned / total : 0;
  const fillAnim = useRef(new Animated.Value(frac)).current;

  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue:         frac,
      duration:        400,
      useNativeDriver: false,
    }).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frac]);

  return (
    <View style={styles.progressWrap}>
      <View style={[styles.progressTrack, { backgroundColor: colors.cardAlt }]}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              backgroundColor: palette.gold,
              width: fillAnim.interpolate({
                inputRange:  [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
      <Text style={[styles.progressLabel, { color: colors.textMuted }]}>
        {learned} / {total} learned
      </Text>
    </View>
  );
}

// ─── Main exported component ─────────────────────────────────────────────────

export function VocabularyScreen() {
  const { colors, palette } = useTheme();

  // ── State ──────────────────────────────────────────────────────────────────

  const [search,   setSearch]   = useState('');
  const [category, setCategory] = useState('All');
  // Indices into vocab[], representing the current display order
  const [order, setOrder]       = useState<number[]>(() => vocab.map((_, i) => i));
  const [isShuffled, setIsShuffled] = useState(false);
  // Set of arabic strings marking which words are learned
  const [learnedSet, setLearnedSet] = useState<Set<string>>(new Set());

  // ── Load learned set on mount ──────────────────────────────────────────────

  useEffect(() => {
    AsyncStorage.getItem(LEARNED_KEY)
      .then(v => {
        if (v) setLearnedSet(new Set(JSON.parse(v) as string[]));
      })
      .catch(() => {});
  }, []);

  // ── Toggle learned ─────────────────────────────────────────────────────────

  const toggleLearned = useCallback((arabic: string) => {
    setLearnedSet(prev => {
      const next = new Set(prev);
      next.has(arabic) ? next.delete(arabic) : next.add(arabic);
      AsyncStorage.setItem(LEARNED_KEY, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  }, []);

  // ── Shuffle / reset order ─────────────────────────────────────────────────

  function toggleShuffle() {
    if (isShuffled) {
      setOrder(vocab.map((_, i) => i));
      setIsShuffled(false);
    } else {
      setOrder(shuffle(vocab.map((_, i) => i)));
      setIsShuffled(true);
    }
  }

  // ── Filtered + ordered list ────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return order
      .filter(i => {
        const w = vocab[i];
        if (category !== 'All' && w.category !== category) return false;
        if (!q) return true;
        return (
          w.arabic.includes(search) ||
          w.transliteration.toLowerCase().includes(q) ||
          w.english.toLowerCase().includes(q)
        );
      })
      .map(i => ({ word: vocab[i], index: i }));
  }, [order, category, search]);

  // Progress is always based on the full 100-word set (not just visible)
  const learnedCount = learnedSet.size;

  // ── Render item ────────────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item }: { item: { word: VocabWord; index: number } }) => (
      <VocabCard
        word={item.word}
        isLearned={learnedSet.has(item.word.arabic)}
        onToggleLearned={() => toggleLearned(item.word.arabic)}
      />
    ),
    [learnedSet, toggleLearned],
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>

      {/* ── Search bar ── */}
      <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <MaterialCommunityIcons name="magnify" size={17} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search arabic, meaning…"
          placeholderTextColor={colors.tabInactive}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={15} color={colors.tabInactive} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Category chips ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        {ALL_CATEGORIES.map(cat => (
          <CategoryChip
            key={cat}
            label={cat}
            active={category === cat}
            onPress={() => setCategory(cat)}
          />
        ))}
      </ScrollView>

      {/* ── Progress + shuffle ── */}
      <View style={styles.controlRow}>
        <ProgressBar learned={learnedCount} total={TOTAL} />
        <TouchableOpacity
          onPress={toggleShuffle}
          style={[
            styles.shuffleBtn,
            {
              backgroundColor: isShuffled ? 'rgba(200,169,110,0.12)' : colors.cardAlt,
              borderColor:     isShuffled ? 'rgba(200,169,110,0.45)' : colors.border,
            },
          ]}
          activeOpacity={0.75}
        >
          <MaterialCommunityIcons
            name="shuffle-variant"
            size={15}
            color={isShuffled ? palette.gold : colors.textMuted}
          />
          <Text style={[styles.shuffleLabel, { color: isShuffled ? palette.gold : colors.textMuted }]}>
            {isShuffled ? 'Sorted' : 'Shuffle'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Card list ── */}
      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="text-search" size={42} color={colors.tabInactive} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No words found</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.word.arabic}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          getItemLayout={(_d, i) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * i, index: i })}
          initialNumToRender={5}
          maxToRenderPerBatch={4}
          windowSize={7}
          removeClippedSubviews={false} // must stay false for flip animation to work off-screen
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Search
  searchBar: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               9,
    marginHorizontal:  16,
    marginTop:         16,
    marginBottom:      12,
    paddingHorizontal: 12,
    paddingVertical:   9,
    borderRadius:      11,
    borderWidth:       1,
  },
  searchInput: { flex: 1, fontSize: 14, letterSpacing: 0.1 },

  // Category chips
  chipsRow: {
    paddingHorizontal: 16,
    paddingBottom:     12,
    gap:               8,
    flexDirection:     'row',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical:   6,
    borderRadius:      8,
    borderWidth:       1,
  },
  chipText: {
    fontSize:      11,
    fontWeight:    '500',
    letterSpacing: 0.3,
  },

  // Progress + shuffle row
  controlRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    marginTop:         4,
    marginBottom:      14,
    gap:               12,
  },
  progressWrap: { flex: 1, gap: 5 },
  progressTrack: {
    height:       4,
    borderRadius: 2,
    overflow:     'hidden',
  },
  progressFill: {
    height:       '100%',
    borderRadius: 2,
  },
  progressLabel: {
    fontSize:      10,
    letterSpacing: 0.3,
  },
  shuffleBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    paddingHorizontal: 10,
    paddingVertical:   6,
    borderRadius:      8,
    borderWidth:       1,
  },
  shuffleLabel: {
    fontSize:      11,
    fontWeight:    '500',
    letterSpacing: 0.2,
  },

  // List
  list:      { paddingTop: 4, paddingBottom: 40 },

  // Empty state
  empty: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            10,
    paddingBottom:  40,
  },
  emptyText: { fontSize: 13, letterSpacing: 0.2 },
});
