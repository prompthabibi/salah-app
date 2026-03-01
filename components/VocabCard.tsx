/**
 * VocabCard — flashcard with a smooth 3D flip animation.
 *
 * Front: large Arabic word, subtle tap hint.
 * Back:  transliteration, English meaning, root, frequency, example ayah.
 * Both faces: "Mark as learned" button (inner touch does not trigger the flip).
 *
 * Islamic geometric border: gold corner diamonds + double-border frame.
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import {
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
  arabic:         string;
  transliteration: string;
  english:        string;
  root:           string;
  frequency:      number;
  example_ayah:   string;
  category:       string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const CARD_HEIGHT = 232;

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
        width:  8,
        height: 8,
        transform:       [{ rotate: '45deg' }],
        backgroundColor: palette.gold,
        opacity:         0.55,
      }}
    />
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
      <Text
        style={[
          styles.learnedLabel,
          { color: isLearned ? palette.gold : colors.tabInactive },
        ]}
      >
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
  // Opacity crossover at the midpoint so neither face shows during the turn
  const frontOpacity = flipAnim.interpolate({
    inputRange:  [0, 0.45, 0.55, 1],
    outputRange: [1, 1, 0, 0],
  });
  const backOpacity = flipAnim.interpolate({
    inputRange:  [0, 0.45, 0.55, 1],
    outputRange: [0, 0, 1, 1],
  });

  // ── Shared card surface style ──────────────────────────────────────────────

  const cardSurface = [
    styles.cardSurface,
    {
      backgroundColor: colors.card,
      borderColor:     'rgba(200,169,110,0.30)',
    },
  ] as const;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <TouchableOpacity
      onPress={handleFlip}
      activeOpacity={1}
      accessibilityRole="button"
      accessibilityLabel={`${word.arabic}, ${word.english}. Tap to flip.`}
    >
      <View style={[styles.wrapper, Platform.select({
        ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 12 },
        android: { elevation: 4 },
      })]}>

        {/* ── Front face: Arabic word ── */}
        <Animated.View
          style={[
            ...cardSurface,
            { opacity: frontOpacity, transform: [{ perspective: 1400 }, { rotateY: frontRotate }] },
          ]}
        >
          {/* Islamic corner diamonds */}
          <Diamond top={10}  left={10}  />
          <Diamond top={10}  right={10} />
          <Diamond bottom={10} left={10}  />
          <Diamond bottom={10} right={10} />

          {/* Category tag */}
          <View style={[styles.catTag, { backgroundColor: 'rgba(200,169,110,0.10)' }]}>
            <Text style={[styles.catText, { color: palette.gold }]} numberOfLines={1}>
              {word.category}
            </Text>
          </View>

          {/* Large Arabic word */}
          <Text style={[styles.arabicFront, { color: colors.text }]}>
            {word.arabic}
          </Text>

          {/* Flip hint */}
          <Text style={[styles.flipHint, { color: colors.tabInactive }]}>
            tap to reveal ›
          </Text>

          {/* Bottom divider + learned button */}
          <View style={[styles.cardFooter, { borderTopColor: 'rgba(200,169,110,0.15)' }]}>
            <LearnedBtn isLearned={isLearned} onToggle={onToggleLearned} />
          </View>
        </Animated.View>

        {/* ── Back face: full details ── */}
        <Animated.View
          style={[
            ...cardSurface,
            styles.cardAbsolute,
            { opacity: backOpacity, transform: [{ perspective: 1400 }, { rotateY: backRotate }] },
          ]}
        >
          <Diamond top={10}  left={10}  />
          <Diamond top={10}  right={10} />
          <Diamond bottom={10} left={10}  />
          <Diamond bottom={10} right={10} />

          {/* Transliteration */}
          <Text style={[styles.translit, { color: palette.gold }]}>
            {word.transliteration}
          </Text>

          {/* English meaning */}
          <Text style={[styles.englishBack, { color: colors.text }]}>
            {word.english}
          </Text>

          {/* Meta row */}
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

          {/* Bottom */}
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
    height:          CARD_HEIGHT,
    marginHorizontal: 16,
    marginBottom:    12,
  },

  // Both faces are absolutely stacked inside wrapper
  cardSurface: {
    ...StyleSheet.absoluteFillObject,
    borderRadius:  16,
    borderWidth:   1,
    overflow:      'hidden',
    paddingTop:    14,
    paddingBottom: 0,
    paddingHorizontal: 18,
    justifyContent: 'flex-start',
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
    marginBottom:      8,
  },
  catText: {
    fontSize:      9,
    fontWeight:    '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  arabicFront: {
    fontFamily:  'Amiri',
    fontSize:    54,
    textAlign:   'center',
    lineHeight:  72,
    flex:        1,
    textAlignVertical: 'center',
  },
  flipHint: {
    fontSize:      10,
    textAlign:     'center',
    letterSpacing: 0.5,
    marginBottom:  6,
  },

  // ── Back ──────────────────────────────────────────────────────────────────
  translit: {
    fontSize:      18,
    fontWeight:    '300',
    letterSpacing: 0.8,
    textAlign:     'center',
    marginTop:     6,
    marginBottom:  4,
  },
  englishBack: {
    fontSize:      15,
    fontWeight:    '400',
    letterSpacing: 0.2,
    textAlign:     'center',
    lineHeight:    22,
    flex:          1,
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
    fontSize:   9,
    textAlign:  'center',
    letterSpacing: 0.3,
    marginBottom: 6,
  },

  // ── Shared footer ─────────────────────────────────────────────────────────
  cardFooter: {
    borderTopWidth:    StyleSheet.hairlineWidth,
    paddingVertical:   8,
    alignItems:        'center',
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
