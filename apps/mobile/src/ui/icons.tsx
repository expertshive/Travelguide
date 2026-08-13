import type { ImageProps } from 'react-native';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

type IconProps = { color?: string; size?: number };

/** UI Kitten accessories are called with style props; only tint and size are honoured here. */
type Accessory = Partial<ImageProps>;

const DEFAULT_COLOR = '#2B3674';

function IconFrame({
  color = DEFAULT_COLOR,
  size = 22,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      {children}
    </Svg>
  );
}

export function BackIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <Path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
    </IconFrame>
  );
}

export function EditIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <Path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" strokeLinejoin="round" />
    </IconFrame>
  );
}

export function PersonIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <Circle cx="12" cy="8" r="4" />
      <Path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" strokeLinecap="round" />
    </IconFrame>
  );
}

export function LogoutIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <Path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" strokeLinecap="round" />
      <Path d="M10 8l-4 4 4 4M6 12h10" strokeLinecap="round" strokeLinejoin="round" />
    </IconFrame>
  );
}

export function CameraIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <Path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1.2-2h8.2l1.2 2h2.2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-9z" />
      <Circle cx="12" cy="13" r="3.2" />
    </IconFrame>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <Path d="M4 7h16M10 7V5h4v2M6 7l1 13h10l1-13" strokeLinecap="round" strokeLinejoin="round" />
    </IconFrame>
  );
}

export function LinkIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <Path
        d="M10 13a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 1 0-5.7-5.7L11.3 6"
        strokeLinecap="round"
      />
      <Path d="M14 11a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 1 0 5.7 5.7l1.3-1.3" strokeLinecap="round" />
    </IconFrame>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <Circle cx="11" cy="11" r="7" />
      <Path d="M20 20l-3.5-3.5" strokeLinecap="round" />
    </IconFrame>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <Path d="M4 11l8-6 8 6" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M6 10v9h12v-9" strokeLinecap="round" strokeLinejoin="round" />
    </IconFrame>
  );
}

export function CompassIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" strokeLinejoin="round" />
    </IconFrame>
  );
}

export function BookmarkIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <Path d="M6 4h12v16l-6-4-6 4V4z" strokeLinejoin="round" />
    </IconFrame>
  );
}

export function WorkIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <Path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h15A1.5 1.5 0 0 1 21 8.5V18a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18V8.5z" />
      <Path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" strokeLinecap="round" />
    </IconFrame>
  );
}

export function MapPinIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <Path d="M12 21c5-5.5 7-8.6 7-11.5A7 7 0 0 0 5 9.5C5 12.4 7 15.5 12 21z" strokeLinejoin="round" />
      <Circle cx="12" cy="9.5" r="2.5" />
    </IconFrame>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 7v5l3.5 2" strokeLinecap="round" strokeLinejoin="round" />
    </IconFrame>
  );
}

export function NavigationIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <Path d="M21 4L3 11l8 2 2 8 8-17z" strokeLinejoin="round" />
    </IconFrame>
  );
}

export function RouteIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <Circle cx="6" cy="18" r="2.4" />
      <Circle cx="18" cy="6" r="2.4" />
      <Path d="M8.4 18H14a3 3 0 0 0 0-6H10a3 3 0 0 1 0-6h5.6" strokeLinecap="round" strokeLinejoin="round" />
    </IconFrame>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <Path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </IconFrame>
  );
}

export function StarIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <Path
        d="M12 4l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.9 7.2 19l.9-5.4L4.2 9.7l5.4-.8L12 4z"
        strokeLinejoin="round"
      />
    </IconFrame>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <Path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </IconFrame>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <Path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </IconFrame>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <Path d="M5 12.5l4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </IconFrame>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <Circle cx="12" cy="12" r="3" />
      <Path
        d="M12 3v2M12 19v2M5 5l1.5 1.5M17.5 17.5L19 19M3 12h2M19 12h2M5 19l1.5-1.5M17.5 6.5L19 5"
        strokeLinecap="round"
      />
    </IconFrame>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <Path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z" strokeLinejoin="round" />
      <Path d="M10 20a2 2 0 0 0 4 0" strokeLinecap="round" />
    </IconFrame>
  );
}

export function CarIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <Path d="M4 16v-3l2-5h12l2 5v3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3 16h18v2a1 1 0 0 1-1 1h-2v-3M6 19H4a1 1 0 0 1-1-1v-2" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="7.5" cy="16" r="1.3" />
      <Circle cx="16.5" cy="16" r="1.3" />
    </IconFrame>
  );
}

export function SparkleIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <Path d="M12 3l1.8 4.9L18.7 9.7l-4.9 1.8L12 16.4l-1.8-4.9L5.3 9.7l4.9-1.8L12 3z" strokeLinejoin="round" />
      <Path d="M18.5 15l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z" strokeLinejoin="round" />
    </IconFrame>
  );
}

export function MicIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <Path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" strokeLinejoin="round" />
      <Path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" strokeLinecap="round" strokeLinejoin="round" />
    </IconFrame>
  );
}

export function LayersIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <Path d="M12 3l9 5-9 5-9-5 9-5z" strokeLinejoin="round" />
      <Path d="M3 12l9 5 9-5M3 16l9 5 9-5" strokeLinecap="round" strokeLinejoin="round" />
    </IconFrame>
  );
}

export function TrafficIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <Path d="M8 3h8a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" strokeLinejoin="round" />
      <Circle cx="12" cy="7.5" r="1.6" />
      <Circle cx="12" cy="12" r="1.6" />
      <Circle cx="12" cy="16.5" r="1.6" />
    </IconFrame>
  );
}

export function FoodIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <Path d="M5 3v8M8 3v8M5 11h3M6.5 11v10M17 3c-1.5 0-2.5 2-2.5 5s1 4 2.5 4v9" strokeLinecap="round" strokeLinejoin="round" />
    </IconFrame>
  );
}

export function CafeIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <Path d="M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8z" strokeLinejoin="round" />
      <Path d="M17 9h2.5a2.5 2.5 0 0 1 0 5H17M6 3v2M10 3v2M14 3v2M4 21h13" strokeLinecap="round" />
    </IconFrame>
  );
}

export function HotelIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <Path d="M3 18V7M3 11h13a4 4 0 0 1 4 4v3M21 18H3M7 11V9a1 1 0 0 1 1-1h3" strokeLinecap="round" strokeLinejoin="round" />
    </IconFrame>
  );
}

export function FuelIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <Path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h13" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 12h10M14 8l3 3v7a2 2 0 0 0 2-2v-6l-2.5-2.5" strokeLinecap="round" strokeLinejoin="round" />
    </IconFrame>
  );
}

export function CartIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <Path d="M3 4h2l2.5 12h10L20 8H6" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="9" cy="20" r="1.4" />
      <Circle cx="17" cy="20" r="1.4" />
    </IconFrame>
  );
}

export function MedicalIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <Path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </IconFrame>
  );
}

export function GlobeIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18" />
    </IconFrame>
  );
}

/** Wraps an icon so it can be passed to UI Kitten `accessoryLeft` / `accessoryRight`. */
export function accessory(Icon: (props: IconProps) => React.ReactElement, options: IconProps = {}) {
  return function Accessory(_props?: Accessory) {
    return (
      <View style={styles.accessory}>
        <Icon {...options} />
      </View>
    );
  };
}

const styles = StyleSheet.create({
  accessory: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
