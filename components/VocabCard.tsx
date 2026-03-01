/**
 * VocabCard — flashcard with a smooth 3D flip animation.
 *
 * Front: large Arabic word + transliteration + speaker button.
 * Back:  English meaning, root, frequency, example ayah.
 * Both faces: "Mark as learned" button (inner touch does not trigger the flip).
 *
 * Islamic geometric border: gold corner diamonds + double-border frame.
 * Audio: taps the speaker icon to play the example ayah via everyayah.com CDN.
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useTheme } from '@/context/ThemeContext';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VocabWord {
  arabic:          string;
  transliteration: string;
  english:         string;
  root:            string;
  frequency:       number;
  example_ayah:    string;
  category:        string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const CARD_HEIGHT = 252;

// ─── Audio URL builder ────────────────────────────────────────────────────────
// Builds an everyayah.com CDN URL from a "surah:ayah" string.
// e.g. "2:255" → https://everyayah.com/data/Alafasy_128kbps/002255.mp3

function buildAudioUrl(ref: string): string | null {
  const [s, a] = ref.split(':');
  const surah = parseInt(s, 10);
  const ayah  = parseInt(a, 10);
  if (isNaN(surah) || isNaN(ayah)) return null;
  return (
    `https://everyayah.com/data/Alafasy_128kbps/` +
    `${String(surah).padStart(3, '0')}${String(ayah).padStart(3, '0')}.mp3`
  );
}

// ─── Corner diamond ornament ──────────────────────────────────────────────────

function Diamond({ top, bottom, left, right }: {
  top?: number; bottom?: number; left?: number; right?: number;
}) {
  const { palette } = useTheme();
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top, bottom, left, right,
        width:           8,
        height:          8,
        transform:       [{ rotate: '45deg' }],
        backgroundColor: palette.gold,
        opacity:         0.55,
      }}
    />
  );
}

// ─── Speaker button ───────────────────────────────────────────────────────────
// Plays the example ayah audio. Does NOT bubble to the outer flip touch.

type SpeakerState = 'idle' | 'loading' | 'playing';

function SpeakerBtn({ url }: { url: string | null }) {
  const { palette, colors } = useTheme();
  const [speakerState, setSpeakerState] = useState<SpeakerState>('idle');
  const soundRef = useRef<Audio.Sound | null>(null);

  // Unload sound when card unmounts (e.g. FlatList recycles it)
  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  async function handlePress() {
    if (!url) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (speakerState === 'playing') {
      await soundRef.current?.stopAsync().catch(() => {});
      await soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null;
      setSpeakerState('idle');
      return;
    }

    setSpeakerState('loading');
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true },
      );
      soundRef.current = sound;
      setSpeakerState('playing');
      sound.setOnPlaybackStatusUpdate(status => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
          soundRef.current = null;
          setSpeakerState('idle');
        }
      });
    } catch {
      setSpeakerState('idle');
    }
  }

  if (!url) return null;

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={styles.speakerBtn}
    >
      {speakerState === 'loading' ? (
        <ActivityIndicator size={14} color={palette.gold} />
      ) : (
        <MaterialCommunityIcons
          name={speakerState === 'playing' ? 'volume-high' : 'volume-medium'}
          size={19}
          color={speakerState === 'playing' ? palette.gold : colors.tabInactive}
        />
      )}
    </TouchableOpacity>
  );
}

// ─── Learned button (inner — does NOT bubble to outer flip TouchableOpacity) ─

function LearnedBtn({
  isLearned,
  onToggle,
}: {
  isLearned: boolean;
  onToggle:  () => void;
}) {
  const { colors, palette } = useTheme();

  function handlePress() {
    Haptics.impactAsync(
      isLearned
        ? Haptics.ImpactFeedbackStyle.Light
        : Haptics.ImpactFeedbackStyle.Medium,
    );
    onToggle();
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.75}
      style={[
        styles.learnedBtn,
        {
          backgroundColor: isLearned
            ? 'rgba(200,169,110,0.15)'
            : 'rgba(200,169,110,0.06)',
          borderColor: isLearned
            ? 'rgba(200,169,110,0.55)'
            : 'rgba(200,169,110,0.20)',
        },
      ]}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <MaterialCommunityIcons
        name={isLearned ? 'check-circle' : 'circle-outline'}
        size={14}
        color={isLearned ? palette.gold : colors.tabInactive}
      />
      <Text style={[styles.learnedLabel, { color: isLearned ? palette.gold : colors.tabInactive }]}>
        {isLearned ? 'Learned' : 'Mark learned'}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  word:            VocabWord;
  isLearned:       boolean;
  onToggleLearned: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function VocabCard({ word, isLearned, onToggleLearned }: Props) {
  const { colors, palette } = useTheme();

  // ── Flip animation ─────────────────────────────────────────────────────────

  const [flipped, setFlipped] = useState(false);
  const flipAnim = useRef(new Animated.Value(0)).current;

  function handleFlip() {
    const toVal = flipped ? 0 : 1;
    setFlipped(!flipped);
    Animated.spring(flipAnim, {
      toValue:         toVal,
      useNativeDriver: true,
      tension:         70,
      friction:        10,
    }).start();
  }

  const frontRotate = flipAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  const backRotate = flipAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['180deg', '360deg'],
  });
  // Opacity crossover at midpoint — neither face shows during the turn
  const frontOpacity = flipAnim.interpolate({
    inputRange:  [0, 0.45, 0.55, 1],
    outputRange: [1, 1, 0, 0],
  });
  const backOpacity = flipAnim.interpolate({
    inputRange:  [0, 0.45, 0.55, 1],
    outputRange: [0, 0, 1, 1],
  });

  const audioUrl = buildAudioUrl(word.example_ayah);

  const cardSurface = [
    styles.cardSurface,
    { backgroundColor: colors.card, borderColor: 'rgba(200,169,110,0.30)' },
  ] as const;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <TouchableOpacity
      onPress={handleFlip}
      activeOpacity={1}
      accessibilityRole="button"
      accessibilityLabel={`${word.arabic}, ${word.transliteration}, ${word.english}. Tap to flip.`}
    >
      <View style={[styles.wrapper, Platform.select({
        ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 12 },
        android: { elevation: 4 },
      })]}>

        {/* ── Front face: Arabic + transliteration + speaker ── */}
        <Animated.View
          style={[
            ...cardSurface,
            { opacity: frontOpacity, transform: [{ perspective: 1400 }, { rotateY: frontRotate }] },
          ]}
        >
          <Diamond top={10}    left={10}  />
          <Diamond top={10}    right={10} />
          <Diamond bottom={10} left={10}  />
          <Diamond bottom={10} right={10} />

          {/* Category tag */}
          <View style={[styles.catTag, { backgroundColor: 'rgba(200,169,110,0.10)' }]}>
            <Text style={[styles.catText, { color: palette.gold }]} numberOfLines={1}>
              {word.category}
            </Text>
          </View>

          {/* Center: Arabic word + transliteration row + speaker */}
          <View style={styles.frontCenter}>
            <Text style={[styles.arabicFront, { color: colors.text }]}>
              {word.arabic}
            </Text>
            <View style={styles.translitRow}>
              <Text style={[styles.translitFront, { color: colors.textMuted }]}>
                {word.transliteration}
              </Text>
              <SpeakerBtn url={audioUrl} />
            </View>
          </View>

          {/* Flip hint */}
          <Text style={[styles.flipHint, { color: colors.tabInactive }]}>
            tap to reveal ›
          </Text>

          {/* Footer */}
          <View style={[styles.cardFooter, { borderTopColor: 'rgba(200,169,110,0.15)' }]}>
            <LearnedBtn isLearned={isLearned} onToggle={onToggleLearned} />
          </View>
        </Animated.View>

        {/* ── Back face: English meaning + meta ── */}
        <Animated.View
          style={[
            ...cardSurface,
            styles.cardAbsolute,
            { opacity: backOpacity, transform: [{ perspective: 1400 }, { rotateY: backRotate }] },
          ]}
        >
          <Diamond top={10}    left={10}  />
          <Diamond top={10}    right={10} />
          <Diamond bottom={10} left={10}  />
          <Diamond bottom={10} right={10} />

          {/* English meaning — takes all available vertical space */}
          <Text style={[styles.englishBack, { color: colors.text }]}>
            {word.english}
          </Text>

          {/* Meta row: root · frequency · example ayah */}
          <View style={styles.metaRow}>
            {word.root ? (
              <View style={[styles.metaChip, { backgroundColor: 'rgba(200,169,110,0.10)' }]}>
                <Text style={[styles.metaLabel, { color: colors.textMuted }]}>root </Text>
                <Text style={[styles.metaValue, { color: palette.gold }]}>{word.root}</Text>
              </View>
            ) : null}
            <View style={[styles.metaChip, { backgroundColor: colors.cardAlt }]}>
              <Text style={[styles.metaLabel, { color: colors.textMuted }]}>× </Text>
              <Text style={[styles.metaValue, { color: colors.text }]}>
                {word.frequency.toLocaleString()}
              </Text>
            </View>
            <View style={[styles.metaChip, { backgroundColor: colors.cardAlt }]}>
              <Text style={[styles.metaLabel, { color: colors.textMuted }]}>{word.example_ayah}</Text>
            </View>
          </View>

          {/* Freq description */}
          <Text style={[styles.freqDesc, { color: colors.tabInactive }]}>
            appears {word.frequency.toLocaleString()} times in the Quran
          </Text>

          {/* Footer */}
          <View style={[styles.cardFooter, { borderTopColor: 'rgba(200,169,110,0.15)' }]}>
            <LearnedBtn isLearned={isLearned} onToggle={onToggleLearned} />
          </View>
        </Animated.View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    height:           CARD_HEIGHT,
    marginHorizontal: 16,
    marginBottom:     12,
  },

  // Both faces are absolutely stacked inside wrapper
  cardSurface: {
    ...StyleSheet.absoluteFillObject,
    borderRadius:      16,
    borderWidth:       1,
    overflow:          'hidden',
    paddingTop:        14,
    paddingBottom:     0,
    paddingHorizontal: 18,
    justifyContent:    'flex-start',
  },
  cardAbsolute: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  },

  // ── Front ──────────────────────────────────────────────────────────────────
  catTag: {
    alignSelf:         'center',
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      6,
    marginBottom:      6,
  },
  catText: {
    fontSize:      9,
    fontWeight:    '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  // Flex container that vertically centers the Arabic + transliteration block
  frontCenter: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            8,
  },
  arabicFront: {
    fontFamily: 'Amiri',
    fontSize:   52,
    textAlign:  'center',
    lineHeight: 68,
  },
  // Transliteration + speaker icon sit in a single row
  translitRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  translitFront: {
    fontSize:      16,
    fontStyle:     'italic',
    letterSpacing: 0.5,
    opacity:       0.7,
  },
  speakerBtn: {
    width:          28,
    height:         28,
    alignItems:     'center',
    justifyContent: 'center',
  },
  flipHint: {
    fontSize:      10,
    textAlign:     'center',
    letterSpacing: 0.5,
    marginBottom:  6,
  },

  // ── Back ──────────────────────────────────────────────────────────────────
  englishBack: {
    fontSize:          17,
    fontWeight:        '400',
    letterSpacing:     0.2,
    textAlign:         'center',
    lineHeight:        24,
    flex:              1,
    textAlignVertical: 'center',
  },
  metaRow: {
    flexDirection:  'row',
    justifyContent: 'center',
    flexWrap:       'wrap',
    gap:            6,
    marginBottom:   4,
  },
  metaChip: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      6,
  },
  metaLabel: { fontSize: 10, letterSpacing: 0.2 },
  metaValue: { fontSize: 10, fontWeight: '600', letterSpacing: 0.2 },
  freqDesc: {
    fontSize:      9,
    textAlign:     'center',
    letterSpacing: 0.3,
    marginBottom:  6,
  },

  // ── Shared footer ─────────────────────────────────────────────────────────
  cardFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    alignItems:      'center',
  },
  learnedBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    paddingHorizontal: 12,
    paddingVertical:   5,
    borderRadius:      8,
    borderWidth:       1,
  },
  learnedLabel: {
    fontSize:      11,
    fontWeight:    '500',
    letterSpacing: 0.3,
  },
});
