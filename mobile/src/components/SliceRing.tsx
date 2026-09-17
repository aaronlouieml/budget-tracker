import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface Props {
  /** Fraction (0-1) of the whole that is the "available" slice. */
  availableFraction: number;
  size?: number;
  strokeWidth?: number;
  availableColor: string;
  setAsideColor: string;
}

// The Pocketcakes brand's one abstract visual motif: a whole (your pocket)
// shown as a ring, split into the slice that's available to spend and the
// slice that's set aside - an abstract portion indicator, not a literal
// illustration. Purely presentational: the fraction is derived from figures
// already shown as text elsewhere on the screen, no new calculation.
export default function SliceRing({ availableFraction, size = 56, strokeWidth = 7, availableColor, setAsideColor }: Props) {
  const clamped = Number.isFinite(availableFraction) ? Math.max(0, Math.min(1, availableFraction)) : 1;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const availableLength = circumference * clamped;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={setAsideColor} strokeWidth={strokeWidth} fill="none" />
        {clamped > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={availableColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${availableLength} ${circumference - availableLength}`}
            strokeLinecap="round"
            rotation={-90}
            originX={size / 2}
            originY={size / 2}
          />
        )}
      </Svg>
    </View>
  );
}
